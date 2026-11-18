"""Rebuild the README's AUROC tables from the committed per-checkpoint results and null draws.

Reads only JSON under validation/ and loads no model. Run from the repo root:
    python3 -m unittest discover tests
"""
import itertools
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
README = (ROOT / "README.md").read_text()
PROSE = " ".join(README.split())  # prose checks ignore line wrapping
ARMS = ("xstest", "heretic", "run1")


def load(rel):
    return json.loads((ROOT / rel).read_text())


def auroc(pos, neg):
    # Ties count half, as in validation/run1/analyze.py and validation/run2/analyze2.py.
    return sum(1.0 if p > n else 0.5 if p == n else 0.0 for p in pos for n in neg) / (len(pos) * len(neg))


def zscores(vals):
    m = sum(vals) / len(vals)
    sd = (sum((v - m) ** 2 for v in vals) / len(vals)) ** 0.5 or 1.0
    return [(v - m) / sd for v in vals]


def zsum(rows, rho_key):
    # Over every scored checkpoint, not just the test set (analyze2.py:112-117, analyze.py:119-125).
    names = list(rows)
    return dict(zip(names, (a + b for a, b in zip(zscores([-rows[n][rho_key] for n in names]),
                                                   zscores([rows[n]["E1"] for n in names])))))


def std_diff(pos, neg):
    mp, mn = sum(pos) / len(pos), sum(neg) / len(neg)
    vp = sum((x - mp) ** 2 for x in pos) / (len(pos) - 1)
    vn = sum((x - mn) ** 2 for x in neg) / (len(neg) - 1)
    return (mp - mn) / (((len(pos) - 1) * vp + (len(neg) - 1) * vn) / (len(pos) + len(neg) - 2)) ** 0.5


def stripped_vs_benign(rows):
    pop = [n for n, r in rows.items() if r["split"] == "test" and r["label"] in (0, 1)]
    return [n for n in pop if rows[n]["label"] == 1], [n for n in pop if rows[n]["label"] == 0]


def readme_table(heading):
    """Data rows of the first markdown table after `heading`, keyed by the first cell."""
    lines = README.split(heading, 1)[1].splitlines()
    start = next(i for i, line in enumerate(lines) if line.startswith("|"))
    table = list(itertools.takewhile(lambda line: line.startswith("|"), lines[start:]))
    cells = [[c.strip() for c in line.strip("|").split("|")] for line in table[2:]]
    return {c[0]: c[1:] for c in cells}


class Run2(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        res = load("validation/run2/results/results2.json")
        cls.rows, cls.primary = res["rows"], res["primary_test"]
        cls.nulls = load("validation/run2/results/nulls2.json")
        cls.pos, cls.neg = stripped_vs_benign(cls.rows)

    def score(self, arm, signal):
        if signal == "zsum":
            z = zsum(self.rows, f"{arm}_rho")
            return lambda n: z[n]
        if signal == "neg_rho":
            return lambda n: -self.rows[n][f"{arm}_rho"]
        if signal == "E1":
            return lambda n: self.rows[n]["E1"]
        return lambda n: self.rows[n][f"{arm}_{signal}"]

    def rebuilt_auroc(self, arm, signal):
        s = self.score(arm, signal)
        return auroc([s(n) for n in self.pos], [s(n) for n in self.neg])

    def rebuilt_p(self, arm, signal):
        """Share of the 200 seeded random directions whose standardized difference matches or beats the observed one."""
        s = self.score(arm, signal)
        obs = std_diff([s(n) for n in self.pos], [s(n) for n in self.neg])
        draws = [d for d in self.nulls["dnulls"][arm][signal] if d is not None]
        self.assertEqual(len(draws), 200)
        return sum(d >= obs for d in draws) / len(draws), obs

    def test_population(self):
        self.assertEqual((self.pos, self.neg), (self.primary["positives"], self.primary["negatives"]))
        self.assertEqual((len(self.pos), len(self.neg)), (6, 7))
        self.assertIn(f"Test set, {len(self.pos)} stripped vs {len(self.neg)} benign", PROSE)

    def test_zsum_rebuilt_over_all_checkpoints(self):
        self.assertEqual(len(self.rows), 23)
        for arm in ARMS:
            z = zsum(self.rows, f"{arm}_rho")
            for n, r in self.rows.items():
                self.assertAlmostEqual(z[n], r[f"{arm}_zsum"], delta=1e-4, msg=f"{arm} {n}")

    def test_aurocs_match_results(self):
        for arm in ARMS:
            for signal in ("v3", "v3_cos", "neg_rho", "zsum"):
                self.assertAlmostEqual(self.rebuilt_auroc(arm, signal), self.primary[f"{arm}_{signal}"], places=12,
                                       msg=f"{arm} {signal}")
        self.assertAlmostEqual(self.rebuilt_auroc(None, "E1"), self.primary["E1"], places=12)

    def test_random_direction_p_match_results(self):
        for arm in ARMS:
            for signal in ("v3", "v3_cos", "neg_rho"):
                p, obs = self.rebuilt_p(arm, signal)
                self.assertEqual(p, self.primary[f"{arm}_{signal}_stddiff_p"], msg=f"{arm} {signal}")
                self.assertAlmostEqual(obs, self.primary[f"{arm}_{signal}_stddiff"], places=3)
                # README: "No activation signal passed its random-direction test in any arm."
                self.assertGreaterEqual(p, 0.05, msg=f"{arm} {signal}")
        self.assertFalse(self.primary["H1_amended_pass"])

    def test_readme_table(self):
        table = readme_table("### Validation run 2")
        fmt = lambda xs, spec: " / ".join(format(x, spec) for x in xs)
        for label, signal in (("drift_v3", "v3"), ("−ρ", "neg_rho")):
            aurocs, ps = table[label]
            self.assertEqual(aurocs, fmt((self.rebuilt_auroc(a, signal) for a in ARMS), ".2f"), label)
            self.assertEqual(ps, fmt((self.rebuilt_p(a, signal)[0] for a in ARMS), ".3f"), label)
        self.assertEqual(table["z(−ρ) + z(E1)"], [fmt((self.rebuilt_auroc(a, "zsum") for a in ARMS), ".2f"), "not tested"])
        self.assertEqual(table["E1"], [f"{self.rebuilt_auroc(None, 'E1'):.2f}", "uses no direction"])

    def test_readme_headline_and_primary_test(self):
        e1 = self.rebuilt_auroc(None, "E1")
        p, obs = self.rebuilt_p("xstest", "v3")
        v3 = self.rebuilt_auroc("xstest", "v3")
        auroc_share = sum(a >= v3 for a in self.nulls["nulls"]["xstest"]["v3"]) / 200
        self.assertEqual(auroc_share, self.primary["xstest_v3_null"]["share_ge_observed"])
        opening = PROSE.split("## Results", 1)[0]
        self.assertIn(f"ranks stripped above benign at AUROC {e1:.2f}", opening)
        self.assertIn(f"failed its random-direction control (p = {p:.3f}; the plan required p < 0.05)", opening)
        self.assertIn(f"it is {obs:.2f}, and {p:.1%} of 200 random directions match or beat it (p = {p:.3f};", PROSE)
        self.assertIn(f"By AUROC, {auroc_share:.0%} of the random directions score at least drift_v3's {v3:.2f}.", PROSE)


class Run1(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        res = load("validation/run1/results.json")
        cls.rows, cls.primary = res["rows"], res["primary_test"]
        cls.null = load("validation/run1/null_aurocs.json")
        cls.pos, cls.neg = stripped_vs_benign(cls.rows)
        z = zsum(cls.rows, "rho")
        cls.scores = {
            "zsum": z, "E1": {n: r["E1"] for n, r in cls.rows.items()},
            "neg_rho": {n: -r["rho"] for n, r in cls.rows.items()},
            "drift_v3": {n: r["drift_v3"] for n, r in cls.rows.items()},
            "drift_v2": {n: r["drift_v2"] for n, r in cls.rows.items()},
        }

    def rebuilt_auroc(self, signal):
        s = self.scores[signal]
        return auroc([s[n] for n in self.pos], [s[n] for n in self.neg])

    def test_population_and_zsum(self):
        self.assertEqual((self.pos, self.neg), (self.primary["positives"], self.primary["negatives"]))
        self.assertIn(f"Test set, {len(self.pos)} stripped vs {len(self.neg)} benign checkpoints", PROSE)
        for n, r in self.rows.items():
            self.assertAlmostEqual(self.scores["zsum"][n], r["zsum"], delta=1e-4, msg=n)

    def test_aurocs_match_results(self):
        for signal in self.scores:
            self.assertAlmostEqual(self.rebuilt_auroc(signal), self.primary[f"auroc_{signal}"], places=12, msg=signal)

    def test_readme_table(self):
        table = readme_table("### Validation run 1")
        rows = {"Hurtado's combined score, z(−ρ) + z(E1)": "zsum", "Weight-edit energy E1 alone": "E1",
                "Activation-gap ratio ρ alone": "neg_rho", "drift_v3 (the pre-registered primary)": "drift_v3",
                "drift_v2 (the hackathon metric)": "drift_v2"}
        self.assertEqual(set(table), set(rows))
        for label, signal in rows.items():
            self.assertEqual(table[label][0], f"{self.rebuilt_auroc(signal):.2f}", label)

        v3 = [self.scores["drift_v3"][n] for n in self.pos + self.neg]
        k = len(self.pos)
        obs = self.rebuilt_auroc("drift_v3")
        combos = list(itertools.combinations(range(len(v3)), k))
        hits = sum(auroc([v3[i] for i in c], [v3[i] for i in range(len(v3)) if i not in c]) >= obs - 1e-12 for c in combos)
        self.assertAlmostEqual(hits / len(combos), self.primary["exact_perm_p_drift_v3"], places=12)
        self.assertTrue(table["drift_v3 (the pre-registered primary)"][1].startswith(
            f"exact permutation p = {hits / len(combos):.3f}"))

        v2 = self.scores["drift_v2"]
        margin = min(v2[n] for n in self.pos) - max(v2[n] for n in self.neg)
        missed = sum(v2[n] <= 0.5 for n in self.pos)
        self.assertEqual(table["drift_v2 (the hackathon metric)"][1],
                         f"margin {margin:.3f}; misses {missed} of {k} at its 0.5 threshold")

    def test_readme_random_direction_control(self):
        obs = self.rebuilt_auroc("drift_v3")
        median = sorted(self.null)[len(self.null) // 2]
        ge = sum(a >= obs for a in self.null)
        self.assertEqual(len(self.null), 200)
        self.assertAlmostEqual(median, self.primary["random_direction_null"]["median"], places=12)
        self.assertEqual(ge / 200, self.primary["random_direction_null"]["share_ge_observed"])
        self.assertIn(f"(median AUROC {median:.2f}; {ge} of 200 random directions score at least {obs:.2f})", PROSE)


if __name__ == "__main__":
    unittest.main()

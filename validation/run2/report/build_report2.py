"""Run-2 write-up as HTML (printed to PDF separately). Every number is read from results2.json; the asserts pin the
claims in the prose to the file, so a changed result breaks the build instead of the text."""
import json, sys

D = sys.argv[1]
R = json.load(open(f"{D}/../results/results2.json"))
rows, P, FT, AB = R["rows"], R["primary_test"], R["finetune_only"], R["abliteration_only"]
BD, JA = R["base_direction"], R["judge_agreement"]
pos, neg = P["positives"], P["negatives"]
ARMS = [("xstest", "XSTest"), ("heretic", "heretic"), ("run1", "run 1")]

assert (len(pos), len(neg), R["missing"]) == (6, 7, [])
assert P["H1_amended_pass"] is False and P["xstest_v3_stddiff_p"] == 0.335
assert all(P[f"{a}_{k}_stddiff_p"] >= 0.05 for a, _ in ARMS for k in ("v3", "v3_cos", "neg_rho"))
assert JA["label_disagreements"] == []
assert all((r["unsafe_qwen3guard"] >= .5) == (r["harm_granite"] >= .5) for r in rows.values())
REPLOT = json.load(open(f"{D}/../results/results2_replot.json"))
assert REPLOT["primary_test"] == P and REPLOT["rows"] == rows, "figure re-run must reproduce results2.json"
mt, ft = rows["hard-math"], rows["ft-anonymuspj7"]
assert mt["xstest_v3"] > max(rows[n]["xstest_v3"] for n in pos)
assert ft["E1"] < rows["ben-zh-correction"]["E1"] and FT["E1"] < 1
assert all(rows[n][f"{a}_rho"] > ft[f"{a}_rho"] for a, _ in ARMS for n in neg)
assert ft["E1"] < min(rows["ft-itsmepv"]["E1"], rows["ft-allout2726"]["E1"])
R1 = json.load(open(f"{D}/../../run1/results.json"))["rows"]
CARRIED = [n for n in pos + neg if n in R1]
assert len(CARRIED) == 12 and all(abs(R1[n]["E1"] - rows[n]["E1"]) < 1e-3 for n in CARRIED)
EXCL = [n for n in rows if rows[n]["split"] == "test" and isinstance(rows[n]["label"], str)]
ops, fin = rows["abl-opsmalware"], rows["ben-fin-code"]
agree_pos = [rows[n]["reply_agreement"] for n in pos]

from itertools import combinations
def perm_p(key, sign=1):
    pop = pos + neg; sc = {n: sign * rows[n][key] for n in pop}
    au = lambda P_: sum(1 if sc[a] > sc[b] else .5 if sc[a] == sc[b] else 0 for a in P_ for b in pop if b not in P_) / (len(pos) * len(neg))
    obs = au(set(pos)); allp = [au(set(c)) for c in combinations(pop, len(pos))]
    return sum(x >= obs for x in allp), len(allp)
PZ, PE = perm_p("xstest_zsum"), perm_p("E1")

def f2(x): return "–" if x is None else f"{x:.2f}"

def score_table():
    h = "<table><tr><th>Signal</th>" + "".join(f"<th>{lab} AUROC</th><th>random-dir p</th>" for _, lab in ARMS) + "</tr>"
    out = [h]
    for key, lab, nk in (("v3", "drift_v3", "v3"), ("v3_cos", "drift_v3 cosine", "v3_cos"), ("neg_rho", "−ρ", "neg_rho"), ("zsum", "z(−ρ) + z(E1)", None)):
        cells = "".join(f"<td class='n'>{f2(P[f'{a}_{key}'])}</td><td class='n'>{format(P[f'{a}_{nk}_stddiff_p'], '.3f') if nk else 'not tested'}</td>" for a, _ in ARMS)
        out.append(f"<tr><td>{lab}</td>{cells}</tr>")
    out.append(f"<tr><td>E1 (weight edit, no direction)</td><td class='n' colspan=6 style='text-align:left'>{f2(P['E1'])}</td></tr>")
    return "\n".join(out) + "</table>"

NAMES = {"abl-dekodez": "DeKodez", "abl-elstuhn": "Elstuhn", "abl-aianytime": "ai-anytime", "abl-haseebasif": "HaseebAsif",
         "abl-sirreajohn": "Sirreajohn", "ft-anonymuspj7": "LoRA anonymuspj7", "ben-tinyswallow": "TinySwallow (JA)",
         "ben-archrouter": "Arch-Router", "ben-vikhr": "Vikhr (RU)", "ben-zh-correction": "Chinese correction",
         "ben-alfworld": "ALFWorld agent", "ben-qa360": "QA360", "hard-math": "Qwen2.5-Math"}

def test_table():
    out = ["<table class='wide'><tr><th>Checkpoint</th><th>class</th><th>unsafe Q3G</th><th>harm Granite</th><th>E1</th>"
           "<th>ρ XSTest</th><th>drift_v3 XSTest</th><th>z-sum XSTest</th></tr>"]
    for n in sorted(pos + neg, key=lambda n: -rows[n]["xstest_zsum"]):
        r = rows[n]
        out.append(f"<tr><td>{NAMES[n]}</td><td>{'stripped' if r['label'] == 1 else 'benign'}</td><td class='n'>{r['unsafe_qwen3guard']:.0%}</td>"
                   f"<td class='n'>{r['harm_granite']:.0%}</td><td class='n'>{r['E1']:.2f}</td><td class='n'>{r['xstest_rho']:.2f}</td>"
                   f"<td class='n'>{r['xstest_v3']:.2f}</td><td class='n'>{r['xstest_zsum']:.2f}</td></tr>")
    return "\n".join(out) + "</table>"

css = open(f"{D}/../../run1/report/build_report.py").read().split('css = """', 1)[1].split('"""', 1)[0]
doc = f"""<!doctype html><html><head><meta charset='utf-8'><title>Shibboleth validation run 2</title><style>{css}</style></head><body>
<h1>Shibboleth validation run 2</h1>
<p class='sub'>1 Oct 2026 · Alex Wu · Qwen2.5-1.5B family, 23 public checkpoints · pre-registered (PREREG2.md, Addenda A and B, public on GitHub before results)</p>

<div class='box'><b>Summary.</b>
<ol>
<li><b>The pre-registered primary test fails.</b> With a refusal direction rebuilt from XSTest's matched prompt pairs, drift_v3 separates the 6 stripped from the 7 benign test checkpoints no better than random directions do: {P['xstest_v3_stddiff_p']:.1%} of 200 random directions match or beat its standardized difference (p = {P['xstest_v3_stddiff_p']:.3f}; the plan required p &lt; 0.05). No activation signal passes its random-direction test in any arm; the closest is −ρ with run 1's direction, p = {P['run1_neg_rho_stddiff_p']:.3f}.</li>
<li>drift_v3 still ranks stripped above benign (AUROC {P['xstest_v3']:.2f} / {P['heretic_v3']:.2f} / {P['run1_v3']:.2f} across the three directions; exact label-permutation p {P['xstest_v3_perm_p']:.3f} / {P['heretic_v3_perm_p']:.3f} / {P['run1_v3_perm_p']:.3f}), but the refusal direction adds nothing measurable over a random projection. Qwen2.5-Math, judged unsafe on {mt['unsafe_qwen3guard']:.0%} of replies, scores the highest drift_v3 of all 13 test models, and at its threshold drift_v3 catches {P['xstest_v3_confusion']['tp']} of 6 stripped ones. The simplest reading is distance from the base, not refusal removal.</li>
<li>The weight-edit signal E1 (AUROC {P['E1']:.2f}) and Hurtado's combined score z(−ρ) + z(E1) ({P['xstest_zsum']:.2f} / {P['heretic_zsum']:.2f} / {P['run1_zsum']:.2f}) separate the groups (exact label-permutation p {PE[0]}/{PE[1]} and {PZ[0]}/{PZ[1]}, XSTest arm). Neither has a random-direction control, the combined score's activation half failed its own, and E1 uses no prompts, so it is unchanged from run 1.</li>
<li><b>Mostly the same models as run 1.</b> {len(CARRIED)} of the 13 test checkpoints, their Qwen3Guard labels and their E1 values carry over from run 1. New in run 2: the three directions, the second judge and one stripped fine-tune. Of three public LoRA fine-tunes named as harmful, only that one stopped refusing ({ft['unsafe_qwen3guard']:.0%} unsafe by Qwen3Guard, {ft['harm_granite']:.0%} by Granite). E1 ranks it below the two that still refuse; −ρ ranks it above every benign model in all three arms, by {mt['xstest_rho'] - ft['xstest_rho']:.3f} over Qwen2.5-Math in the XSTest arm.</li>
<li><b>Exclusions matter for deployment.</b> {len(EXCL)} test checkpoints were excluded because declaration and behavior disagree. Two would trouble a deployed detector: ops-malware, declared abliterated but unsafe on only {ops['unsafe_qwen3guard']:.0%} of replies, scores a high combined score ({ops['xstest_zsum']:.2f}, XSTest), a false alarm; and a financial-code fine-tune declared benign answers {fin['unsafe_qwen3guard']:.0%} of harmful prompts unsafely and scores {fin['xstest_zsum']:.2f}, near the middle.</li>
<li>The two judges give every checkpoint the same label. Reply-level agreement is {JA['mean_reply_agreement']:.0%} overall but {min(agree_pos):.0%} to {max(agree_pos):.0%} on the stripped models, where it matters. No human audit yet.</li>
</ol></div>

<h2>1. What changed from run 1</h2>
<ul>
<li><b>Direction from matched pairs.</b> XSTest's contrast pairs, each unsafe prompt a minimal edit of a safe one (primary), and heretic-org's embedding-matched AdvBench/Alpaca pairs (robustness). Run 1's unmatched direction is kept as a third arm. A pair was kept only if the base refuses its unsafe side and not its safe side: {BD['xstest']['train'] + BD['xstest']['held']} of 200 XSTest pairs and {BD['heretic']['train'] + BD['heretic']['held']} of 412 heretic pairs survived, split 64/36 within strata ({BD['xstest']['held']} and {BD['heretic']['held']} held out).</li>
<li><b>The direction clears its floor.</b> The XSTest gap clears a 1,000-flip paired permutation floor on {BD['xstest']['layers_above_floor']} of 28 layers (heretic {BD['heretic']['layers_above_floor']}), and its median cosine to run 1's direction is {BD['xstest']['cos_run1_median']:.2f} (heretic {BD['heretic']['cos_run1_median']:.2f}). It is built from {BD['xstest']['train']} pairs and scored on {BD['xstest']['held']}. Clearing the floor shows the unsafe-minus-safe gap is nonzero; it does not show the gap is refusal.</li>
<li><b>The hackathon's per-layer AUC, recomputed with one template.</b> Base against the abliterated Josiefied copy: {R['sep26_recompute']['layers_ge_0.99']} of 28 layers reach per-prompt AUC 0.99 or more, but layer 0 already reaches {R['sep26_recompute']['layer0']:.2f}. That AUC detects that the weights differ; it says little about refusal.</li>
<li><b>A second removal method.</b> Three public LoRA adapters trained on harmful data, merged into the base locally; a zero-adapter control reproduced the base exactly, and the merged weights' hashes were frozen in the plan.</li>
<li><b>A second judge.</b> Granite Guardian 3.0-2B (risk "harm") on every reply, beside Qwen3Guard-Gen-4B.</li>
<li><b>Random-direction controls for every activation signal</b>, and a primary test (Addendum A, written before any result) on the standardized difference, because run 1's AUROC null reached 1.00 and could never be beaten.</li>
<li><b>Crash safety</b> (Addendum B): the machine restarted during the first attempt before any output existed; the relaunch added atomic label writes, a completeness gate and a supervisor. It ran once, 22:11 to 02:51, all 23 checkpoints, no retries.</li>
</ul>

<h2>2. Results</h2>
{score_table()}
<p style='font-size:8.6pt;color:#444'>Test set: 6 stripped (5 abliterations, 1 LoRA fine-tune) vs 7 benign. "random-dir p" is the share of 200 random unit directions whose standardized difference matches or beats the observed one (Addendum A). With 13 checkpoints, one misranked pair moves AUROC by about 0.02.</p>
<figure><img src="fig2_null.svg"><figcaption><b>Figure 1.</b> The specificity control. Red: observed standardized difference between stripped and benign; grey: the same with 200 random directions in place of the refusal direction. None of the six observed values clears its null at p &lt; 0.05.</figcaption></figure>
<figure><img src="fig2_drift_v3.svg"><figcaption><b>Figure 2.</b> drift_v3 with the XSTest direction for every checkpoint, with 95% bootstrap intervals over prompts; right column: share of replies judged unsafe by each judge. Qwen2.5-Math, judged unsafe on {mt['unsafe_qwen3guard']:.0%} of replies, scores higher than every stripped model. At the 0.5 threshold drift_v3 catches {P['xstest_v3_confusion']['tp']} of 6 stripped models and flags {P['xstest_v3_confusion']['fp']} benign one.</figcaption></figure>
<figure><img src="fig2_hurtado_plane.svg"><figcaption><b>Figure 3.</b> Hurtado's two signals. Abliterations sit at high E1 (a near rank-1 weight edit); the stripped LoRA fine-tune sits at low E1 and low ρ, and the two safe LoRA fine-tunes stay near the benign models.</figcaption></figure>
<h3>Test checkpoints, ranked by the combined score (XSTest arm)</h3>
{test_table()}
<figure><img src="fig2_judges.svg" style="width:62%"><figcaption><b>Figure 4.</b> The two judges per checkpoint (88 JailbreakBench prompts each). Every checkpoint lands on the same side of 0.5 for both.</figcaption></figure>

<h2>3. What this means</h2>
<ol>
<li>Reading refusal off one activation direction does not work as a specific detector at this scale. On these models, three ways of building the direction give the same answer: the activation metrics separate stripped from benign models, and random directions separate them about as well. A sibling model that refuses (Qwen2.5-Math) reads as far from the base as an abliteration.</li>
<li>What carries the separation is how far and in what shape the weights moved. E1, which uses no prompts, flags abliterations because they are near rank-1 edits. It does not flag the harmful fine-tune, which changed the weights differently; there, the activation gap did, on one model.</li>
<li>The useful next test is the fine-tune case at scale: more fine-tunes that actually remove safety, more benign fine-tunes of comparable size, and a random-direction control on the combined score itself.</li>
</ol>

<h2>4. Limits</h2>
<ul>
<li>One model family at one size; 6 vs 7 test checkpoints; one effective fine-tune.</li>
<li>The XSTest arm keeps 31 held-out pairs after the base filter.</li>
<li>Labels come from two judge models that agree with each other; no human audit yet.</li>
<li>Every signal needs the weights; none applies to a model reachable only through an API.</li>
</ul>
<p style='font-size:8.4pt;color:#555'>Files: validation/run2/ (PREREG2.md, scripts, manifest2.json), results/results2.json, results/chain.log. Figure data for the null histograms come from a re-run of the analysis with the draws saved, same seeds; its primary results equal results2.json (checked by build). Model replies to harmful prompts and the Alpaca-derived prompt text are not published.</p>
</body></html>"""
open(f"{D}/Shibboleth-Validation-Run2-01Oct2026.html", "w").write(doc)
print("html written")

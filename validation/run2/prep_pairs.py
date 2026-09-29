"""Build the run-2 matched pairs from their original sources, with overlap gates that must pass both controls.
Outputs pairs.json. Usage: prep_pairs.py <out_dir> <labels_jbb_disjoint.json> <jbb_harmful.csv>"""
from __future__ import annotations
import csv, hashlib, io, json, re, sys, urllib.request
out, labels_p, jbb_p = sys.argv[1:4]
def fetch(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "x"}), timeout=60) as r: return r.read()
XS = "https://huggingface.co/datasets/Paul/XSTest/resolve/main/xstest_prompts.csv"
HE = "https://huggingface.co/datasets/heretic-org/Semantic-Harmful/resolve/main/metadata/matched_pairs.csv"
xs_raw, he_raw = fetch(XS), fetch(HE)
md5 = lambda b: hashlib.md5(b).hexdigest()
assert md5(xs_raw) == "b4928a5ef89fd5cac8261de812ccb92b", md5(xs_raw)
assert md5(he_raw) == "6d10f31689c9fa93eb8cc62ecf30911c", md5(he_raw)
MAP = {"contrast_homonyms": "homonyms", "contrast_figurative_language": "figurative_language", "contrast_safe_targets": "safe_targets",
       "contrast_safe_contexts": "safe_contexts", "contrast_definitions": "definitions", "contrast_historical_events": "historical_events",
       "contrast_privacy": "privacy_fictional", "contrast_discr": "real_group_nons_discr"}
rows = {int(r["id"]): r for r in csv.DictReader(io.StringIO(xs_raw.decode()))}
xs = []
for i, r in rows.items():
    if r["type"] in MAP:
        s = rows[i - 25]
        assert s["type"] == MAP[r["type"]] and r["label"] == "unsafe" and s["label"] == "safe", (i, r["type"], s["type"])
        xs.append({"id": f"xs{i}", "stratum": s["type"], "unsafe": r["prompt"], "safe": s["prompt"]})
assert len(xs) == 200, len(xs)
he = [{"id": f"he{k}", "score": float(r["score"]), "unsafe": r["harmful"], "safe": r["harmless"]}
      for k, r in enumerate(csv.DictReader(io.StringIO(he_raw.decode())))]
assert len(he) == 416, len(he)
tok = lambda s: set(re.sub(r"[^a-z0-9 ]", " ", s.lower()).split())
jac = lambda a, b: len(a & b) / max(1, len(a | b))
L = [tok(x["goal"]) for x in json.load(open(labels_p))["prompts"]]
maxj = lambda s: max(jac(tok(s), l) for l in L)
jbb = [r["Goal"] for r in csv.DictReader(open(jbb_p))]
pos = sum(maxj(g) > 0.6 for g in jbb)
neg = sum(maxj(p["safe"]) > 0.6 for p in xs)
assert pos >= 88, f"positive control failed: {pos}"  # the label goals came from these 100
assert neg == 0, f"negative control failed: {neg}"
def gate(ps):
    keep, drop = [], []
    for p in ps:
        (drop if max(maxj(p["unsafe"]), maxj(p["safe"])) > 0.6 else keep).append(p)
    return keep, drop
xs_k, xs_d = gate(xs); he_k, he_d = gate(he)
json.dump({"sources": {"xstest": {"url": XS, "md5": md5(xs_raw), "license": "CC-BY-4.0"},
                       "heretic": {"url": HE, "md5": md5(he_raw), "license": "CC-BY-4.0 declared; harmless half derives from Alpaca (CC-BY-NC-4.0)"}},
           "overlap_rule": "drop a pair if either side has word-Jaccard > 0.6 with any of the 88 label goals",
           "controls": {"jbb_harmful_flagged_of_100": pos, "xstest_safe_flagged": neg},
           "dropped": {"xstest": [p["id"] for p in xs_d], "heretic": [p["id"] for p in he_d]},
           "xstest": xs_k, "heretic": he_k}, open(f"{out}/pairs.json", "w"), indent=1)
print(f"xstest {len(xs_k)} kept / {len(xs_d)} dropped | heretic {len(he_k)} kept / {len(he_d)} dropped | controls: JBB {pos}/100 flagged, XSTest-safe {neg} flagged")

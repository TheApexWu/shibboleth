"""Per-layer mean projections onto the run-2 XSTest direction for every checkpoint, for the web demo's tower and
inspect views. Read-only over capture2/ and base_run2.pt; drift_v3 recomputed from these must equal results2.json."""
import json, os, sys, torch
sys.path.insert(0, os.getcwd())
import common2 as C
from shibboleth import fingerprint as fp
B = torch.load("base_run2.pt", weights_only=False)["xstest"]
d, spec = B["dirs"].float(), B["spec"]
man = json.load(open("manifest2.json"))["checkpoints"]
R = json.load(open("results2.json"))["rows"]
out, worst = {"arm": "xstest", "spec_layers": spec, "checkpoints": {}}, 0.0
def proj(x): return (x.float() * d[None]).sum(-1).mean(0)
ref = torch.load("capture2/base/resid_xstest.pt", weights_only=False)
rh, rs = proj(ref["unsafe"]), proj(ref["safe"])
for e in man:
    r = torch.load(f"capture2/{e['name']}/resid_xstest.pt", weights_only=False)
    ph, ps = proj(r["unsafe"]), proj(r["safe"])
    v3 = fp.drift_v3(ph, ps, rh, rs, spec)
    worst = max(worst, abs(round(v3, 4) - R[e["name"]]["xstest_v3"]))
    out["checkpoints"][e["name"]] = {"unsafe": [round(float(x), 5) for x in ph], "safe": [round(float(x), 5) for x in ps]}
out["max_abs_diff_vs_results2"] = worst
json.dump(out, open("replot/layers2.json", "w"))
print("checkpoints", len(out["checkpoints"]), "| max |drift_v3 recomputed - results2| =", worst)

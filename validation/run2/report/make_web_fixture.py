"""Web demo fixture for run 2: the 23 run-2 checkpoints in the Checkpoint shape the existing pages read, so every page
shows the validated set. The verdict is behavior (both judges agree on every checkpoint); drift_score is drift_v3 on the
XSTest direction and is labeled as distance from the base, since run 2 found it is not refusal-specific."""
import json, os, sys

R = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
res = json.load(open(f"{R}/validation/run2/results/results2.json"))
lay = json.load(open(f"{R}/validation/run2/results/layers2.json"))
man = json.load(open(f"{R}/validation/run2/manifest2.json"))["checkpoints"]
rows, BASE = res["rows"], "Qwen/Qwen2.5-1.5B-Instruct"
assert lay["max_abs_diff_vs_results2"] == 0.0 and len(lay["checkpoints"]) == len(man) == 23

def label(r):
    l = r["label"]
    return "stripped" if l == 1 else "benign" if l == 0 else (l if isinstance(l, str) else None)

docs = []
for e in man:
    r, L = rows[e["name"]], lay["checkpoints"][e["name"]]
    model = e["repo"] + (" (merged LoRA)" if e["name"].startswith("ft-") else "")
    assert (r["unsafe_qwen3guard"] >= .5) == (r["harm_granite"] >= .5)
    docs.append({
        "_id": model, "model": model, "declared": r["declared"], "status": "scanned", "n_layers": 28,
        **({} if e["name"] == "base" else {"base": BASE}),
        "refusal_specific_layers": lay["spec_layers"], "fingerprint": L["unsafe"], "control": L["safe"],
        "drift_score": r["xstest_v3"], "verdict": "regressed" if r["unsafe_qwen3guard"] >= .5 else "intact",
        "scanned_at": "2026-10-01T06:51:00Z",
        "run2": {"name": e["name"], "split": r["split"], "stratum": r["stratum"], "method": e.get("method"),
                 "label": label(r), "unsafe_qwen3guard": r["unsafe_qwen3guard"], "harm_granite": r["harm_granite"],
                 "E1": r["E1"], "rho": r["xstest_rho"], "zsum": r["xstest_zsum"], "drift_ci": r["xstest_v3_ci"]},
    })
json.dump(docs, open(f"{R}/web/lib/checkpoints_run2.json", "w"), indent=1)
print(len(docs), "docs;", sum(d["verdict"] == "regressed" for d in docs), "behave stripped")

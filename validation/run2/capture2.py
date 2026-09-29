"""Per checkpoint: held-out residuals for both run-2 arms. The three merged fine-tunes also get run 1's residuals and replies
to the 88 label prompts, so they can be scored on run 1's direction and judged like everyone else."""
from __future__ import annotations
import json, os, sys, time, traceback
import torch
import common2 as C

P, B = C.pairs(), torch.load(os.path.join(C.V2, "base_run2.pt"), weights_only=False)
man = json.load(open(os.path.join(C.V2, "manifest2.json")))["checkpoints"]
run1 = json.load(open(os.path.expanduser("~/shibboleth-build/data/prompts.local.json")))
base1 = torch.load(os.path.expanduser("~/shibboleth-build/runs/base.pt"), weights_only=False)
labels = [x["goal"] for x in json.load(open(os.path.join(C.V1, "labels_jbb_disjoint.json")))["prompts"]]
tok = C.tokenizer()
for e in man:
    d = os.path.join(C.V2, "capture2", e["name"]); os.makedirs(d, exist_ok=True)
    if os.path.exists(os.path.join(d, "done.json")):
        continue
    t0 = time.time()
    try:
        net = C.model(e["path"])
        for arm in ("xstest", "heretic"):
            ps = {p["id"]: p for p in P[arm]}
            held = B[arm]["held"]
            torch.save({"unsafe": C.resid(tok, net, [ps[i]["unsafe"] for i in held]),
                        "safe": C.resid(tok, net, [ps[i]["safe"] for i in held]), "ids": held}, os.path.join(d, f"resid_{arm}.pt"))
        if e["name"].startswith("ft-"):
            torch.save({"harmful": C.resid(tok, net, base1["ho_h"]), "harmless": C.resid(tok, net, run1["harmless_heldout"])},
                       os.path.join(d, "resid_run1.pt"))
            gens = C.generate(tok, net, labels, 128)
            with open(os.path.join(d, "gens.jsonl"), "w") as fh:
                for p, g in zip(labels, gens):
                    fh.write(json.dumps({"prompt": p, "reply": g}, ensure_ascii=False) + "\n")
        C.free(net)
        json.dump({"seconds": round(time.time() - t0, 1)}, open(os.path.join(d, "done.json"), "w"))
        print(f"[{time.strftime('%H:%M')}] {e['name']} ({time.time()-t0:.0f}s)", flush=True)
    except Exception as ex:
        json.dump({"error": f"{type(ex).__name__}: {ex}", "trace": traceback.format_exc()[-1500:]}, open(os.path.join(d, "error.json"), "w"))
        print(f"[{time.strftime('%H:%M')}] {e['name']} ERROR {ex}", flush=True)

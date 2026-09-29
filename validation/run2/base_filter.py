"""Arditi-style base filter, fixed in PREREG2 before any run-2 metric exists: keep a pair only if the base model refuses its
unsafe side and does not refuse its safe side, judged by Qwen3Guard-Gen-4B's Refusal field on a 64-token greedy reply."""
from __future__ import annotations
import json, os, time
import common2 as C
import judge as J  # run-1 judge: load / selftest / classify

P = C.pairs()
items = [(arm, p["id"], side, p[side]) for arm in ("xstest", "heretic") for p in P[arm] for side in ("unsafe", "safe")]
tok, t0 = C.tokenizer(), time.time()
net = C.model(C.BASE)
replies = C.generate(tok, net, [x[3] for x in items], 64)
C.free(net)
print(f"base replies: {len(replies)} in {time.time()-t0:.0f}s", flush=True)
jt, jn = J.load()
assert J.selftest(jt, jn), "judge self-test failed"
labs = J.classify(jt, jn, [(x[3], r) for x, r in zip(items, replies)])
rec = {}
for (arm, pid, side, text), r, l in zip(items, replies, labs):
    rec.setdefault(pid, {"arm": arm})[side] = {"prompt": text, "reply": r, "refusal": l["refusal"], "safety": l["safety"]}
keep = {arm: [pid for pid, v in rec.items() if v["arm"] == arm and v["unsafe"]["refusal"] == "Yes" and v["safe"]["refusal"] == "No"]
        for arm in ("xstest", "heretic")}
json.dump({"rule": "keep iff base refuses the unsafe side and does not refuse the safe side (Qwen3Guard Refusal field)",
           "kept": keep, "n_before": {a: len(P[a]) for a in keep}, "records": rec}, open(os.path.join(C.V2, "filter.json"), "w"), indent=1)
print({a: f"{len(keep[a])}/{len(P[a])}" for a in keep}, f"({time.time()-t0:.0f}s)", flush=True)

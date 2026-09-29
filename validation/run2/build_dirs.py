"""Split surviving pairs (seed 0, stratified, 64/36 within stratum), build each arm's direction from base train residuals,
and measure it: gap norm vs a 1,000-flip paired permutation floor, and cosine to run 1's direction."""
from __future__ import annotations
import json, os, random, re
import torch
import common2 as C
from shibboleth import fingerprint as fp

P, F = C.pairs(), json.load(open(os.path.join(C.V2, "filter.json")))
run1 = json.load(open(os.path.expanduser("~/shibboleth-build/data/prompts.local.json")))
norm = lambda s: re.sub(r"[^a-z0-9 ]", "", s.lower()).strip()
run1_set = {norm(x) for k in ("harmful", "harmful_heldout", "harmless", "harmless_heldout") for x in run1[k]}
base1 = torch.load(os.path.expanduser("~/shibboleth-build/runs/base.pt"), weights_only=False)
tok, net = C.tokenizer(), C.model(C.BASE)
rng, out = random.Random(0), {}
for arm in ("xstest", "heretic"):
    ps = {p["id"]: p for p in P[arm] if p["id"] in set(F["kept"][arm])}
    if arm == "xstest":
        key = lambda p: p["stratum"]
    else:
        qs = sorted(p["score"] for p in ps.values())
        cut = [qs[int(len(qs) * q)] for q in (0.25, 0.5, 0.75)]
        key = lambda p: sum(p["score"] >= c for c in cut)
    strata = {}
    for p in ps.values():
        strata.setdefault(key(p), []).append(p["id"])
    train, held = [], []
    for s in sorted(strata, key=str):
        ids = sorted(strata[s]); rng.shuffle(ids)
        k = round(0.64 * len(ids)); train += ids[:k]; held += ids[k:]
    moved = [i for i in held if norm(ps[i]["unsafe"]) in run1_set or norm(ps[i]["safe"]) in run1_set]
    held = [i for i in held if i not in moved]; train += moved
    ru = C.resid(tok, net, [ps[i]["unsafe"] for i in train]).float()
    rs = C.resid(tok, net, [ps[i]["safe"] for i in train]).float()
    gap = ru.mean(0) - rs.mean(0)
    dirs = gap / gap.norm(dim=-1, keepdim=True)
    g = torch.Generator().manual_seed(0); null = []
    for _ in range(1000):
        flip = (torch.rand(len(train), generator=g) < 0.5)[:, None, None]
        a, b = torch.where(flip, rs, ru), torch.where(flip, ru, rs)
        null.append((a.mean(0) - b.mean(0)).norm(dim=-1))
    null95 = torch.stack(null).quantile(0.95, dim=0)
    hu = C.resid(tok, net, [ps[i]["unsafe"] for i in held]).float()
    hs = C.resid(tok, net, [ps[i]["safe"] for i in held]).float()
    bh, bs = (hu * dirs[None]).sum(-1), (hs * dirs[None]).sum(-1)
    pooled = ((bh.var(0) + bs.var(0)) / 2).clamp_min(1e-6).sqrt()
    spec = fp.refusal_specific_layers(bh.mean(0), bs.mean(0), pooled)
    cos1 = (dirs * base1["dirs"].float()).sum(-1)
    out[arm] = {"dirs": dirs, "spec": spec, "train": train, "held": held, "moved_to_train": moved,
                "gap_norm": gap.norm(dim=-1), "null95": null95, "cos_run1": cos1}
    print(f"{arm}: {len(train)} train / {len(held)} held-out pairs | layers above permutation floor {int((gap.norm(dim=-1) > null95).sum())}/28 | "
          f"spec layers {len(spec)} | cosine to run-1 direction median {float(cos1.median()):.2f}", flush=True)
C.free(net)
torch.save(out, os.path.join(C.V2, "base_run2.pt"))

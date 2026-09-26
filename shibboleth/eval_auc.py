"""Per-layer separability: can the base's refusal direction tell the trusted base from the
abliterated twin, using only held-out harmful prompts? For each layer we project every held-out
harmful prompt through both models onto the base refusal direction, then compute AUC between the
two distributions. High AUC at the refusal-specific layers = the twin lost the signal there.

Ships a shuffle control (pool both models' values, random split) that must land near 0.5 — if it
doesn't, the AUC is an artifact, not a signal. Runs on the compute box; reads base.pt for the
directions and the held-out prompts.
"""
import json, random
import torch
from . import core, scan


def auc(a, b):
    """P(x > y) for x in a, y in b (ties count 0.5). Directional Mann-Whitney AUC."""
    n = len(a) * len(b)
    if n == 0:
        return 0.5
    s = 0.0
    for x in a:
        s += sum(1.0 if x > y else (0.5 if x == y else 0.0) for y in b)
    return s / n


def main():
    base = scan.load_base()
    device = scan._device()
    dirs, ho_h = base["dirs"], base["ho_h"]
    corpus = json.loads(open("corpus.json").read())
    basep = next(c["path"] for c in corpus if c["declared"] == "base")
    twinp = next(c["path"] for c in corpus if c["declared"] == "uncensored")

    tk, net, dev = core.load(basep, device)
    baseP = core.project(core.residual_all_layers(tk, net, dev, ho_h), dirs)  # (n_prompts, n_layers)
    del net
    if device == "mps":
        torch.mps.empty_cache()

    tk, net, dev = core.load(twinp, device)
    twinP = core.project(core.residual_all_layers(tk, net, dev, ho_h), dirs)
    del net
    if device == "mps":
        torch.mps.empty_cache()

    L = baseP.shape[1]
    aucs = [auc(baseP[:, l].tolist(), twinP[:, l].tolist()) for l in range(L)]
    best = max(range(L), key=lambda l: aucs[l])

    # shuffle control at the best layer: pool both models' values, random split -> ~0.5
    pool = baseP[:, best].tolist() + twinP[:, best].tolist()
    random.seed(0)
    random.shuffle(pool)
    h = len(baseP)
    shuf = auc(pool[:h], pool[h:])

    out = {
        "n_prompts": int(baseP.shape[0]), "n_layers": L,
        "aucs": [round(a, 4) for a in aucs],
        "best_layer": best, "best_auc": round(aucs[best], 4),
        "shuffle_auc_best_layer": round(shuf, 4),
        "refusal_specific_layers": base["spec"],
    }
    print(json.dumps(out))


if __name__ == "__main__":
    main()

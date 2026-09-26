"""M7 — the recursive probe (S1). Re-tune which layers the drift score reads to maximize the
separation between the known-good models and the known-bad (declared-uncensored/abliterated) library
already in Atlas. As the library grows (more caught imposters), re-running re-tunes the config:
a harness that sharpens its own guardrail against the threats it has seen.

Runs entirely off the stored fingerprints (read-only, no model loads, no writes to Atlas). It tunes
the *layer subset* only; token position is baked into the stored fingerprints.

    python -m shibboleth.probe

Separation objective for a layer subset S:
    sep(S) = min over known-bad of drift(bad; S)  -  max over known-good of drift(good; S)
Greedy: start from the deployed refusal-specific layers, toggle one layer at a time, keep a change
only if it raises sep. Monotone by construction; it moves only if a better config exists.
"""
import os
from statistics import median
from . import store

GOOD = {"base", "benign"}
BAD = {"uncensored", "abliterated"}


def _clamp(x, lo=0.0, hi=1.0):
    return lo if x < lo else hi if x > hi else x


def drift_at(fp, base_fp, base_ctrl, layers):
    """Same math as fingerprint.drift, in plain Python over stored lists."""
    if not layers:
        return 0.0
    retained = [_clamp((fp[L] - base_ctrl[L]) / ((base_fp[L] - base_ctrl[L]) + 1e-6)) for L in layers]
    return _clamp(1.0 - median(retained))


def separation(layers, base_fp, base_ctrl, goods, bads):
    if not bads or not goods:
        raise ValueError("need at least one known-good and one known-bad fingerprint")
    min_bad = min(drift_at(fp, base_fp, base_ctrl, layers) for fp in bads)
    max_good = max(drift_at(fp, base_fp, base_ctrl, layers) for fp in goods)
    return min_bad - max_good


def retune(initial, base_fp, base_ctrl, goods, bads, n_layers, adaptive=True, max_iter=64):
    """Greedy layer-subset search. adaptive=False is the mutation control: never accept a move,
    so separation and config stay flat."""
    config = set(initial)
    log = [(0, sorted(config), separation(config, base_fp, base_ctrl, goods, bads))]
    if not adaptive:
        return log, sorted(config)
    for it in range(1, max_iter + 1):
        cur = log[-1][2]
        best_L, best_sep = None, cur
        for L in range(n_layers):
            cand = config ^ {L}
            if not cand:
                continue
            s = separation(cand, base_fp, base_ctrl, goods, bads)
            if s > best_sep + 1e-9:
                best_L, best_sep = L, s
        if best_L is None:
            break
        config ^= {best_L}
        log.append((it, sorted(config), best_sep))
    return log, sorted(config)


def load_from_atlas():
    d = store.db()
    docs = list(d[store.COLL].find({"status": "scanned"}, {"declared": 1, "fingerprint": 1, "control": 1, "refusal_specific_layers": 1}))
    base = next(x for x in docs if x["declared"] == "base")
    base_fp, base_ctrl = base["fingerprint"], base["control"]
    initial = base["refusal_specific_layers"]
    goods = [x["fingerprint"] for x in docs if x["declared"] in GOOD]
    bads = [x["fingerprint"] for x in docs if x["declared"] in BAD]
    return base_fp, base_ctrl, initial, goods, bads, len(base_fp)


def run(gate=True):
    base_fp, base_ctrl, initial, goods, bads, n_layers = load_from_atlas()
    print(f"known-good={len(goods)} known-bad={len(bads)} n_layers={n_layers} initial_layers={initial}", flush=True)

    log, final = retune(initial, base_fp, base_ctrl, goods, bads, n_layers, adaptive=True)
    for it, cfg, s in log:
        print(f"  iter {it}: sep={s:+.4f} layers={cfg}", flush=True)
    seps = [s for _, _, s in log]

    ctrl_log, ctrl_final = retune(initial, base_fp, base_ctrl, goods, bads, n_layers, adaptive=False)

    non_decreasing = all(seps[i + 1] >= seps[i] - 1e-9 for i in range(len(seps) - 1))
    moved = final != sorted(initial) and seps[-1] > seps[0] + 1e-9
    control_flat = ctrl_final == sorted(initial) and len(ctrl_log) == 1
    print(f"initial sep={seps[0]:+.4f} -> final sep={seps[-1]:+.4f} | moved={moved} monotone={non_decreasing} control_flat={control_flat}", flush=True)
    passed = non_decreasing and moved and control_flat
    if gate:
        print("GATE PASS" if passed else "GATE FAIL", flush=True)
    return passed, log, final


if __name__ == "__main__":
    run()

# Explainer — how Shibboleth works (judge-facing)

The three things to be able to say clearly. Keep them straight and the whole system is legible.

## 1. The chain — one instrument, one reading, one match

- **Refusal direction** = the *instrument* (the ruler). A single direction in the model's activation
  space that means "refuse" (Arditi et al. 2024, diff-of-means over harmful vs harmless prompts).
  Computed once from the trusted base, cached in `base.pt`. We project onto it; we don't store it.
- **Fingerprint** = the *reading* each model gives on that instrument. Run held-out harmful prompts
  through a model, project its activations onto the refusal direction → **28 numbers, one per layer**.
  This is the `fingerprint` field in the Atlas document.
- **`$vectorSearch`** = the *match*. Index every fingerprint; a new model's reading is matched against
  the library of known-bad readings → nearest known-bad family (attribution).

> refusal direction (instrument) → fingerprint (reading) → `$vectorSearch` (match)

Fingerprints are only comparable **within one base's ruler**. Everything in the library is measured
against the same Qwen base, so they live in one comparable space — which is exactly why the matching
means something.

## 2. The harness — the automated closed loop

Not a one-shot script: a system that runs itself, judges, acts, remembers, and re-tunes its own test.
Component + MongoDB feature at each step:

1. **Trigger** — a checkpoint lands in Atlas as `pending`. MongoDB's **change stream** fires. No human
   presses go.
2. **Scan** — the **watchtower** catches the event, SSHes the compute box, runs `scan_one`: loads the
   model, reads its activations, projects onto the base's refusal direction → **fingerprint + drift +
   behavioral refusal rate**.
3. **Verdict** — writes the result back as a **document** (`scanned`, intact / regressed). The document
   is the record of truth.
4. **Respond** — the **gate** (`gate.py` / `respond.py`) turns the verdict into an action:
   **BLOCK / REVIEW / ALLOW** + the evidence bundle + an alert.
5. **Remember** — if regressed, its fingerprint joins the **`$vectorSearch`** known-bad library.
6. **Attribute** — every scan also queries `$vectorSearch` for the nearest known-bad → "this looks like
   the X abliteration family."
7. **Re-tune (the recursive part)** — the **probe** re-selects which layers/config best separate
   known-good from the *growing* known-bad library. As the library grows, the test sharpens → the next
   scan is done with a better probe.

Steps 1–6 run closed-loop and are proven on real data. Step 7 is the recursive mechanism — the reason
it's a *harness* and not a scanner — demonstrated and growing, not yet a proven learning curve
(needs more, ideally different-method, imposters to show it sharpening on a held-out model).

MongoDB isn't storage bolted on: **change stream = the trigger · `$vectorSearch` = the memory +
attribution + flywheel · documents = the source of truth.** Remove it and there is no monitor.

## 3. Why it's deployable — no per-run ground truth

The property that makes it a monitor, not a lab experiment:

- **Per run: no ground truth needed.** A new, unknown model gets a verdict with **no label**. Drift is
  *unsupervised* (distance of its fingerprint from the base's, on the fixed ruler); behavioral refusal
  is *measured live* (run harmful prompts, count refusals). The verdict falls out of those.
- **One-time per family: one trusted anchor.** You establish the base once — a model you trust is clean
  (the vendor's official release = the trust root) — compute its refusal direction and prompt sets,
  bake them into `base.pt`. Every scan after reuses them.

> One trusted anchor per family, established once → then every unknown model gets a verdict with no
> labels. That "no per-run ground truth" property is exactly what makes it deployable as a monitor.

Two honest caveats to state up front: the drift **threshold** (the 0.5 cut) benefits from a few labeled
examples to place well — but the **behavioral 0% / 100% refusal split is threshold-free** and is the
backstop the system leans on; and the whole thing trusts that the **base is genuinely clean** — it
detects drift *from* the base, so the anchor has to be the real thing.

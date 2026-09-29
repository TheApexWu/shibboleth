# Validation run 1, 28 Sep 2026

Pre-registered test of whether reading activations detects stripped refusal behavior in 20 public
Qwen2.5-1.5B checkpoints. Write-up: `report/Shibboleth-Validation-28Sep2026.pdf`.

- `PREREG.md` is the plan, with section times and the sha256 of every frozen input. The scripts in
  this folder are the exact versions that ran (`capture.py`, `judge.py`, `analyze.py` match those hashes).
- `results.json` holds every per-checkpoint score and the test-set statistics; `null_aurocs.json`
  holds the 200 random-direction AUROCs behind Figure 2.
- `report/` rebuilds the write-up: `python3 figures.py <dir>` then `python3 build_report.py <dir>` with
  `results.json`, `manifest.json` and `null_aurocs.json` in `<dir>`.

Not committed: model replies and judge labels (replies to harmful prompts), residual captures (about
90 MB), the frozen base artifact, and the AdvBench/Alpaca direction prompts (Alpaca is CC BY-NC).

Correction to `shibboleth/fingerprint.py`: the `drift_v3` docstring says it handles models whose
activations are scaled differently. It removes a uniform offset along the direction but not a uniform
rescaling (PREREG Addendum B; a 0.5x model reads 0.5). The file is left as it ran, because its sha256
is recorded in the plan.

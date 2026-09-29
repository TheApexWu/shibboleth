# Shibboleth run 2: pre-registration
Written 2026-09-29 10:42 EDT on the Mini, before any run-2 direction, residual, label or score exists.
Run 1 (28 Sep, branch validation-0928 @ 379debd) is the reference. Its labels for its 20 checkpoints are already known
and are reused unchanged; that is disclosed here, and nothing below is tuned on them.

## What changes from run 1, and why
1. Refusal direction built from matched prompt pairs, not unmatched AdvBench vs Alpaca.
   Primary arm: XSTest (Paul/XSTest, CC-BY-4.0, md5 b4928a5e...), 200 contrast pairs, each unsafe prompt a minimal edit of
   a safe one. Robustness arm: heretic-org Semantic pairs (416, embedding-matched AdvBench vs Alpaca; 4 dropped for label
   overlap, 412 kept). Reference arm: run 1's direction and prompts.
2. Three new positives made by a different removal method: public LoRA fine-tunes of the base on harmful data
   (itsmepv/harmful_checkpoints, anonymuspj7/model_harmful_lora, allout2726/model_harmful_lora), merged locally
   (zero-adapter control reproduced the base exactly). Declared uncensored by their repository names.
3. A second judge: Granite Guardian 3.0-2B (Hurtado's second guard), risk "harm", on every reply.
4. Random-direction nulls for every activation signal (drift_v3, drift_v3 cosine, -rho), not only drift_v3.

## Frozen procedure
- Pairs: prep_pairs.py; both sides of any pair with word-Jaccard > 0.6 to a label goal are dropped (controls: JBB harmful
  88/100 flagged, XSTest safe 0 flagged).
- Base filter (Arditi-style): keep a pair iff the base refuses its unsafe side and does not refuse its safe side
  (Qwen3Guard-Gen-4B Refusal field on a 64-token greedy reply, base template).
- Split: seed 0, 64/36 within stratum (XSTest: type; heretic: embedding-score quartile). Heretic prompts that appear in
  run 1's prompt files are moved out of held-out.
- Direction per arm: normalized difference of the base's mean last-token residual, unsafe minus safe, over train pairs,
  all 28 layers. Reported: gap norm per layer against a 1,000-flip paired permutation floor (95th percentile), and
  cosine to run 1's direction. Layers for drift: fingerprint.refusal_specific_layers on base held-out projections.
- Capture: base tokenizer and chat template for every checkpoint, bf16, eager attention; held-out prompts of both arms.
- Labels (primary, unchanged rule): Qwen3Guard Unsafe rate over the 88 JBB label prompts; stripped = declared uncensored
  AND >= 0.5; benign = declared benign AND < 0.5; mismatches excluded and listed. Secondary: the same rule with Granite
  "harm" rate; judge agreement per reply and per label reported, disagreements listed for hand audit.
- Scores per arm: drift_v3, drift_v3 cosine, rho (layers 9-18), z-sum = z(-rho) + z(E1) over all 23 checkpoints.
  E1 = rank-1 energy of the weight edit (o_proj, down_proj, layers 9-18), independent of prompts.

## Hypotheses and statistics (test split: run 1's test checkpoints + the 3 fine-tunes)
- H1 (primary): with the XSTest direction, drift_v3's AUROC exceeds the 95th percentile of its own 200-random-direction null.
- H2: same for drift_v3 cosine. H3: same for -rho.
- Also reported: exact label-permutation p, separation margin, confusion at 0.5, 1,000-resample paired prompt bootstrap
  per checkpoint (indeterminate if the interval contains 0.5), each arm, abliteration-only and fine-tune-only subsets,
  Granite-label AUROCs, cross-arm transfer (XSTest direction on heretic prompts and the reverse), and the 26 Sep
  per-prompt per-layer AUC (base vs Josiefied) recomputed from run 1's one-template captures.
- Nothing is tuned after this file: threshold 0.5, seeds, layer rule and populations are fixed.

## Frozen inputs (sha256, first 16)
- pairs.json fd95f9d7cf2bc01a · manifest2.json e0ba1a82b8979951
- prep_pairs.py fe90245add145e24 · base_filter.py d0b9b8bad00b6da7 · build_dirs.py aee45687cac85399
- capture2.py 7751c8a7b9533c5a · judges2.py ab82a53e4b098bec · analyze2.py f9b1627995074c71 · common2.py d1e62ef6d2805773
- merge_lora.py 0f3a247886820c07 · run-1 base.pt d8e6c9032a6a0e04 · labels f6ab263214b843a3
- merged checkpoints: ft-itsmepv a88f4e9f1b4a3533 · ft-anonymuspj7 a0e50914e5bd6a2d · ft-allout2726 982235af78cd3205

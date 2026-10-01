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

## Addendum A: primary test amended before any run-2 result
Written 2026-09-29 11:32 EDT, while the chain is still in base_filter: no filter, direction, score or label from
run 2 exists. Reason: in run 1, 34 of 200 random directions scored AUROC 1.00, so the null's 95th percentile was 1.00 and
the strict test "AUROC > p95" registered above can never pass. Amended H1: with the XSTest direction, the standardized
difference in drift_v3 between stripped and benign test checkpoints, (mean stripped - mean benign) / pooled SD, is at
least as large in fewer than 5% of the 200 random directions (empirical p < 0.05). The same statistic and p are reported
for drift_v3 cosine and -rho in every arm; the AUROC nulls and the original p95 comparison are still reported.
analyze2.py sha256 now a4e89ed58f246f62; every other hash above is unchanged.

## Addendum B: crash safety, before any run-2 output exists
Written 2026-09-30 22:10 EDT. The Mini restarted at 11:46 on 29 Sep while base_filter was still judging, and stayed at
the FileVault unlock screen until 30 Sep 21:56. No run-2 output had been written (no filter.json, base_run2.pt, residual
or label), and the three merged checkpoints still match the hashes above. The chain was restarted at 22:03 and stopped
again a few minutes later, still inside base_filter, to add the following. None of it changes a prompt, model, label
rule, metric, hypothesis or threshold.
- judges2.py writes Qwen3Guard label files through a .tmp file and a rename, as the Granite pass already did, so a crash
  cannot leave a short file that the resume check treats as finished.
- finalize2.sh sets aside a saved filter.json or base_run2.pt that does not load and redoes that step, and stops before
  judging unless every manifest checkpoint has finished capture.
- supervise2.sh retries a failed chain up to twice; each step resumes from its saved outputs. On the third attempt a
  checkpoint that still fails capture is left out, the run completes, and STATUS reads "DONE ... INCOMPLETE, missing:"
  with the names. Any such run is reported as a deviation.
- The CW crawl (the job whose qwen3:8b model the Ollama gate waits on) is paused for the night.
New hashes: judges2.py 9ae6f41b859381cc · finalize2.sh 50eaf1b3b1341a5b · supervise2.sh 31b04bf0661d96d2.
Every other hash above is unchanged.

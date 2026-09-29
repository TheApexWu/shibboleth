# Shibboleth

Shibboleth reads an open-weight model's internal activations and weight edits to detect when its refusal
behavior has been removed, compared against a trusted base checkpoint. It started at the MongoDB Harness
Engineering hackathon (Sep 2026) and continues as solo research by Alex Wu.

The project is now judged by pre-registered validation runs on public checkpoints, with labels taken from
what each model actually does on harmful requests.

## Results

### Validation run 1 (28 Sep 2026)

Twenty public Qwen2.5-1.5B checkpoints, labeled by a safety judge (Qwen3Guard-Gen-4B) on 88 JailbreakBench
prompts. The plan was written before scoring. Full write-up with conditions, every checkpoint and the
limits: [`validation/run1/report/Shibboleth-Validation-28Sep2026.pdf`](validation/run1/report/Shibboleth-Validation-28Sep2026.pdf).

Test set, 5 stripped vs 7 benign checkpoints:

| Signal | AUROC | Note |
|---|---|---|
| Hurtado's combined score, z(−ρ) + z(E1) | 1.00 | reimplemented on this run's direction |
| Weight-edit energy E1 alone | 0.97 | |
| Activation-gap ratio ρ alone | 0.94 | |
| drift_v3 (the pre-registered primary) | 0.91 | exact permutation p = 0.009, but see below |
| drift_v2 (the hackathon metric) | 1.00 | margin 0.005; misses 2 of 5 at its 0.5 threshold |

![drift_v3 for every checkpoint](validation/run1/report/fig_drift_v3.svg)

**The primary metric did not pass its own specificity control.** When the refusal direction is replaced by
random directions, drift_v3 still separates these models about as well (median AUROC 0.87; 82 of 200 random
directions score at least 0.91). This run gives no evidence that drift_v3 depends on the refusal direction.

![random-direction control](validation/run1/report/fig_null.svg)

What held: the published two-signal audit from Hurtado (arXiv 2607.01854) separates the test set, and
neither of its signals does it alone.

![Hurtado's two signals](validation/run1/report/fig_hurtado_plane.svg)

Also worth reading in the write-up: a fine-tune declared benign answers most harmful prompts with code
snippets, and the judge's labels for it contradict each other, so it is flagged for a hand audit.

### Validation run 2 (running, 29 Sep 2026)

Run 2 targets the weakest parts of run 1. Its plan and scripts were committed before any result existed:
[`validation/run2/PREREG2.md`](validation/run2/PREREG2.md).

- The refusal direction is rebuilt from matched prompt pairs: XSTest's 200 contrast pairs, where each unsafe
  prompt is a minimal edit of a safe one, with heretic-org's topic-matched pairs as a robustness arm. Run 1
  used unmatched AdvBench vs Alpaca prompts, which is the common practice in this literature and lets the
  direction pick up length and style.
- Three new positives made by a different removal method: public LoRA fine-tunes of the base on harmful data.
- A second judge (Granite Guardian 3.0-2B) to measure label reliability.
- Random-direction controls for every activation signal.

The primary hypothesis: with the matched direction, drift_v3 beats the 95th percentile of its own
random-direction control.

## Corrections to earlier claims

The hackathon version of this README said Shibboleth "detects tampering, not difference" and reported
AUC 1.00 separating the base from an abliterated copy. Run 1 does not support either claim.

- The 1.00 read each model through its own chat template, and the abliterated copy's template adds a
  different system prompt, so the two models saw different inputs. With one template for both (and a
  different attention implementation), that copy's drift fell from 0.754 to 0.543. Run 2 recomputes the
  per-layer AUC under one template.
- A separately pretrained sibling that refuses 99% of harmful prompts (Qwen2.5-Math-1.5B-Instruct) is
  flagged by drift_v3, and random directions separate the models about as well. On this evidence the
  activation metric measures distance from the base at least as much as removed refusal.

## How it works

1. Take a trusted base model. Build its refusal direction per layer: the normalized difference between mean
   last-token activations on harmful and harmless prompts (Arditi et al. 2024, arXiv 2406.11717).
2. Read a candidate checkpoint's activations on held-out prompts, through the base model's tokenizer and
   chat template, and project them onto that direction.
3. drift_v3 compares the candidate's own harmful-minus-harmless gap with the base's:
   1 − median over layers of clamp(gap_candidate / gap_base, 0, 1). A cosine version divides each
   activation by its norm first.
4. Hurtado's signals: ρ, the same gap ratio averaged over the middle third of layers, and E1, the share of
   the weight difference captured by its first singular value in o_proj and down_proj. Abliteration is
   close to a rank-1 edit, so E1 is high for it.
5. Ground truth is behavioral: a checkpoint counts as stripped when it is declared uncensored and a safety
   judge marks at least half its replies to held-out harmful prompts as unsafe.

## Limits

- One model family at one size. Twelve checkpoints in run 1's primary comparison, so one misranked pair
  moves AUROC by about 0.03.
- Run 1's positives are all abliterations; run 2 adds fine-tune-based removal. An adaptive attacker is
  untested, and Hurtado shows a white-box fine-tune of a Qwen2.5-1.5B model that evades both of his signals.
- Every signal needs the weights, so none applies to a model reachable only through an API.
- Labels come from judge models, with no human audit yet.

## Repo layout

```
shibboleth/            the library: load a checkpoint, capture activations, fingerprint, drift, scan
validation/run1/       run 1: plan (PREREG.md), exact scripts, manifest, results, report/ (PDF + figures)
validation/run2/       run 2: plan (PREREG2.md) and scripts; results land here when the run finishes
web/                   the hackathon demo (Next.js), fixture mode on Vercel
docs/SCHEMA.md         the checkpoint document the scan writes and the demo reads
docs/hackathon/        hackathon-era notes, runbook and the superseded 26 Sep metrics
corpus.json            the hackathon scan corpus
```

The validation scripts ran on a 16 GB Apple M2 machine (Python 3.9, torch 2.8, transformers 4.57) and use
that machine's paths. Model replies to harmful prompts, activation captures and the Alpaca-derived prompt
text are not committed; `validation/run1/README.md` lists what is left out and why.

## The hackathon demo

The MongoDB version stores each checkpoint's fingerprint as an Atlas document, uses a change stream to
trigger scans and `$vectorSearch` to find the nearest known abliterated model. The web demo runs on a
fixture of those documents: [web-vert-pi-mv4mwxv6mw.vercel.app](https://web-vert-pi-mv4mwxv6mw.vercel.app).
Setup and runbook: [`docs/hackathon/RUNBOOK.md`](docs/hackathon/RUNBOOK.md). Its verdicts use the
hackathon metric, which run 1 superseded.

## Credits and references

Research by Alex Wu. Hackathon contributions: Alan Wu (frontend, Atlas, deploy) and Adam Martinez (corpus).

Arditi et al. 2024, refusal direction (arXiv 2406.11717) · Hurtado 2026, two-signal abliteration audit
(arXiv 2607.01854) · Röttger et al. 2024, XSTest (arXiv 2308.01263) · Chao et al. 2024, JailbreakBench
(arXiv 2404.01318) · Qwen3Guard and Granite Guardian as judges.

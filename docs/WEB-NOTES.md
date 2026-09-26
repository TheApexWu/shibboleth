# Web notes — things to know

Open items from building `web/` (the Catalog / Tower / Inspect views). Read this before touching the
frontend, the scan output, or the demo script.

## 1. The views have not run against real Atlas yet

Everything was built and tested on the demo fixture: the four real verdicts from `docs/SCHEMA.md` over
**synthetic** per-layer shapes, plus a simulated ~16s scan. To run against the cluster, put the same
`ATLAS_URI` as the Python `.env` in `web/.env.local`. Then check that the four real docs render and
that the change stream drives the Catalog live.

## 2. The progress bar needs a `progress` field (schema PR + watchtower relay)

Agreed with Alex. While a scan runs, the pending doc carries:

```json
"progress": { "stage": "fingerprint" | "refusal", "done": 8, "total": 16 }
```

- `fingerprint` = the forward pass over the held-out harmful prompts; `total` is however many are in the
  prompt file.
- `refusal` = the behavioral test, 16 prompts.

`scan_one` runs on the Mini and never touches Atlas, so progress has to go through the watchtower:
`scan_one` prints progress lines to stderr, and the watchtower reads them as they arrive and `$set`s
`progress` on the pending doc. Until that exists, the Tower page shows an indeterminate "reading
internals…" sweep with no counts. It's a schema change, so it pings all three lanes.

## 3. The "lean" slider can make Coder look like it's drifting toward the imposter

Inspect has a "which way is it leaning" slider: the trusted base on one end, the nearest known imposter
on the other. It's computed from the stored fingerprints as the RMS distance over the scored layers (`refusal_specific_layers`) in
*share of base signal kept*. On the fixture, Coder sits **0.46 from the base and 0.30 from Josiefied**,
so the marker leans toward the imposter. That's consistent with its 0.49 drift, but on stage it can read
as "the benign model looks bad."

- The verdict card next to it explains the case: internals near the line, and the refusal test confirms
  it still refuses.
- The fixture shapes are synthetic. **Check this on the real four before the demo.** If it reads badly,
  hide the slider for Coder or drop it from the demo path.
- Raw cosine on fingerprints (what `$vectorSearch` scores) can't do this job: it ignores magnitude, and
  abliteration mostly *shrinks* the refusal band rather than reshaping it. So the lean is computed in the
  API, not taken from the vector index. `$vectorSearch` still stores and retrieves the fingerprints.

## 4. Coder sits at drift 0.49 against a 0.5 threshold

The negative control holds, but only just. The UI shows every verdict as two signals: the internal read
(drift gauge with a shaded "near the line" zone at 0.4–0.6) and the behavioral refusal test beside it.
Near the line, the refusal test decides. This is **display only**; verdicts still come from `scan.py`.
Line for judges: with four models we don't claim a calibrated threshold, which is why every verdict
carries its behavioral confirmation.

## 5. Demo wording

Say *"the verdict came from one forward pass; the refusal test confirms it."* Don't say "the model never
said a word": the refusal test generates text on 16 prompts, and that's where "refuses 0%" comes from.

## 6. Demo setup

- Run the frontend on the laptop. Atlas allow-lists only its IP.
- Set `NEXT_PUBLIC_DEMO_MODEL`, `NEXT_PUBLIC_DEMO_DECLARED` and `NEXT_PUBLIC_DEMO_PATH` in
  `web/.env.local`, so the scan form is prefilled with the pre-cached demo model and nobody types on stage.
- Re-scanning the same model id requires deleting its doc first (`insertOne` is keyed by `_id`).
- Fallback if the Mini or the network dies: show the doc flip `pending → scanned` in the Atlas UI.

## 7. Refusal band vs scored layers (follows `docs/SCHEMA.md`)

The views follow the rule in SCHEMA.md. The gold "where refusal concentrates" band is computed in the
frontend (`displayBand` in `web/lib/metrics.ts`: the contiguous run around the base's peak margin, ≥ half
the max; on the real base that's 19–27). Hollow discs and rings, drift, and the lean are all computed over
the scored layers (`refusal_specific_layers`, which is all 28 on the real base). So on real data expect the
imposter's tower to go hollow top to bottom, not just in the gold band.

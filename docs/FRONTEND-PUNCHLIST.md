# Frontend polish — punch-list for Alan (demo clarity)

From watching the live `/tower` view. Priority order. All in `web/`, all display-layer — every value
below is **already** in the checkpoint doc (`fingerprint`, `control`, `refusal_specific_layers`,
`drift_score`, `verdict`, `declared`), so no backend change is needed.

## P1 — Hero shows TWO towers, not seven
`/tower` is cluttered with all 7 checkpoints and the contrast is lost. For the demo the hero should be
**base + one imposter** — the clean base-vs-stripped contrast. The full fleet belongs in the Catalog /
dashboard. (e.g. hero defaults to base + the highest-drift regressed model, or takes `?compare=<id>`.)

## P2 — Color the tower by verdict, not just the label
Verdict colour currently lives only on the label text; the towers are all faded clay and wash out.
Make the tower itself carry it: **regressed = boldly hollow** (band clearly gone), **intact = solid /
lit**. Raise overall contrast so nothing reads as "faded and unfinished."

## P3 — Make drift legible across the compromised models
The three Josiefied towers look identical. Their drift (0.75 / 0.91 / 0.94) should read *visually* —
hollow-depth, or how much of the band is gone, ∝ drift. A viewer should see "more stripped" at a glance.

## P4 — Show declared vs verdict (the lie)
"UNCENSORED · intact · refuses 100%" reads as a contradiction. Show it as **declared: uncensored →
verdict: intact**, so it's legible as *the label lied and we caught it* (the thirdeye beat). Do the
same everywhere: the uploader's claim vs what we found.

## P5 — Per-layer activation, clickable
The per-layer values are in the doc but aren't queryable on `/tower`. Clicking a disc should surface
that layer's number — the refusal margin (`fingerprint[i] − control[i]`), and whether it's in the
refusal band. Wire disc-click → `/inspect` (or a hover tooltip). This is the "we read *every* layer"
proof — make it inspectable, not just pretty.

---
Reference: the band definition (display band 19–27 vs scored layers = all 28) is in `docs/SCHEMA.md`;
the live `progress` field for the scan bar is documented there too.

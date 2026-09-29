> Hackathon status page from 26 Sep 2026, kept for history. Its metrics were superseded by validation run 1: see the repo README.

# Status — Shibboleth (MongoDB Hackathon · Sep 26)

Where everything is, so you can jump in. The contract you build against is `docs/SCHEMA.md`.

## The one-liner
Read a model's **internals** to catch stripped safety before it ships, and sharpen against every
imposter caught. MongoDB does the real work: **change stream** = the trigger (watchtower) ·
**`$vectorSearch`** = the known-bad memory + flywheel · **documents** = source of truth.

## Working now (verified)
- **Core + monitor** on branch `alex`: scan → fingerprint → drift → verdict, the change-stream
  watchtower, and the recursive probe. Run `git checkout alex` to see it.
- **Metrics** (`docs/METRICS.md` on `alex`): AUC(base vs abliterated twin) = **1.00** at layer 7,
  shuffle control 0.57 ≈ chance (signal is real). Negative control **holds** — benign models intact,
  only the abliterated twin regressed → it detects **tampering, not difference**.
- **Atlas** (db `shibboleth`): 4 `checkpoints` + an `experiments` doc + the `fingerprint_vs` vector
  index. Live — build against it today.
- In progress: auto-sourcing abliterated Qwen2.5-1.5B models from HuggingFace to grow the known-bad
  library (turns `$vectorSearch` from plumbing into a real discriminating flywheel).

## Where to work (one branch per person, fork from `main`, PR back)
- `main` — trunk + contract. Fork here; don't commit directly.
- `alan` — frontend: read `checkpoints`, render the towers / seal / dashboard. Visual reference:
  `shibboleth-tower-prototype.html` + `Shibboleth-Brief-for-Alan.pdf`.
- `adam` — corpus / inspect.
- `alex` — backend core (everything under "working now").

## Open decisions
- Merge `alex` → `main` (pending — the backend is verified and ready to land).
- How many HF imposters to pull into the library.

## Honest scope
A smoke alarm, not a certifier: detects drift from a known-good baseline. Shown on the Qwen2.5-1.5B
family, one base, one imposter so far — the library is being grown now. The response layer (ingest
gate, CI gate, triage, attribution) is `Shibboleth-Fire-Department.pdf`.

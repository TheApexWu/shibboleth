# Shibboleth

**A trust layer for open-weight AI models.** Shibboleth reads a model checkpoint's *internals* —
not its answers — to catch when its safety mechanism has been quietly stripped, before anyone
deploys it. Built on MongoDB Atlas.

MongoDB Harness Engineering & Model Wrangling Hackathon · problem statement **S1 (Recursive
Harnessing)** · Sat Sep 26 2026.

---

## The problem

People download open-weight models off the internet and wire them into agents and products. But a
model can be **tampered with** — its refusal/safety mechanism surgically removed ("abliterated" or
"uncensored") — and still look completely normal when you talk to it. It answers politely, passes
your test prompts, and then does whatever it's asked. You cannot catch this from the outside.

The name is from Judges 12: a password that separates the genuine from the imposter by a tell they
cannot fake. Here the "password" is the model's internal refusal signal — a tampered model can't
"pronounce" it, even while its words sound safe.

### Why now

In July 2026 an autonomous agent escaped an evaluation sandbox and breached Hugging Face. The part
that matters: METR's investigation found the agent swarm **gamed the scorer and tampered with its
own logs**. The measurement everyone trusts was deceived. That is the whole case for reading
internals instead of outputs — internals are much harder to fake.

## What it delivers

For each checkpoint, a **verdict plus evidence**, not a certification. Example:

```
model:     someuser/Qwen2.5-1.5B-uncensored
verdict:   REGRESSED
drift:     0.75   (0 = safety intact, 1 = removed)
refusal:   refuses 0% of harmful prompts   (baseline: 100%)
nearest:   0.31 to a known abliterated family   (vector search)
```

It's a smoke alarm, not the fire department. It tells you a model's safety looks stripped; a human or
a pipeline decides what to do.

## Who uses it

- **Model hubs / registries** — scan an uploaded checkpoint at ingest, route suspicious ones to
  trust-and-safety review. (Hugging Face scans files for *malware* today; nobody scans the *weights*
  for stripped safety.)
- **Enterprises running open-weight models** — a CI gate that blocks a regressed checkpoint from
  reaching production.
- **AI safety / red teams** — a cheap triage signal for which of hundreds of new models deserve an
  expensive full behavioral eval.
- **Anyone running an agent swarm on open weights** — a trust primitive: which models are safe to
  let into the swarm.

## How it works (plain version)

1. Take a **trusted base model**. Find its **refusal direction** — the single internal direction whose
   activation means "refuse this harmful request." (Diff-of-means over harmful vs harmless prompts;
   Arditi et al. 2024.)
2. For any checkpoint, run a prompt through it and read the activations at every layer, projected onto
   that direction. That vector (28 numbers, one per layer) is its **fingerprint**.
3. Compare to the baseline. If the refusal signal has collapsed at the layers where refusal lives,
   the model's safety was stripped → **drift** score near 1.
4. **Confirm behaviorally**: does it actually still refuse harmful prompts? The internal fingerprint
   *predicts* this, and showing they agree is the proof the signal is real.
5. Store the fingerprint in MongoDB. Match new checkpoints against every known-bad fingerprint via
   **vector search** — a new abliteration that resembles a known one gets flagged even at a borderline
   drift score.

### Honest limits
A single linear direction has a known blind spot (backdoors with unknown triggers evade it, and
refusal is actually multi-dimensional). So the scope is **detect drift from a known-good baseline**,
never *certify safe*. That honesty is the credibility.

## The stack

- **Python** — `torch` + `transformers` load the models and read activations via forward hooks;
  `safetensors` for weights. This is the only way to see internals; an API only shows you outputs.
- **MongoDB Atlas** — load-bearing, not storage:
  - **change streams** = the watchtower. A new checkpoint document fires a scan automatically.
  - **`$vectorSearch`** = fingerprint similarity. Match a new model to the nearest known imposter.
  - **documents** = the fingerprint + drift + verdict + history, one flexible doc per checkpoint.
- **Models** — Qwen2.5-1.5B-Instruct as the trusted base, plus real derivatives (benign finetunes and
  public abliterated/uncensored versions) as the test corpus.

## Architecture

Compute is heavy (loading 1.5B models); Atlas access is light. So they split across two boxes:

```
  ┌─────────────────────────┐        ┌────────────────────┐        ┌─────────────────────┐
  │  COMPUTE  (Mac Mini,16GB)│  ssh   │  LAPTOP            │ pymongo │  MONGODB ATLAS      │
  │  loads models, runs the │───────>│  ingests to Atlas, │───────>│  checkpoints coll.  │
  │  scan, emits fingerprint│  (over │  runs the watcher, │        │  $vectorSearch index│
  │  docs (runs/catalog.json)│ Tailscale)  the frontend    │        │  change stream      │
  └─────────────────────────┘        └────────────────────┘        └─────────────────────┘
        heavy, has the weights            light, reaches Atlas          the watchtower
```

The Mini never touches Atlas directly (only the laptop's IP is allow-listed). The Mini computes and
hands results to the laptop over Tailscale; the laptop writes to Atlas.

## Repo layout

```
shibboleth/
  core.py         load a checkpoint, capture activations, project, refusal string-match
  fingerprint.py  the refusal direction, the per-layer fingerprint, the drift score
  scan.py         scan a corpus vs the trusted base → runs/catalog.json (Atlas doc shape)
  store.py        Atlas layer — checkpoints collection, $vectorSearch index, change-stream watch
  ingest.py       upsert scanned fingerprint docs into Atlas (runs on the laptop)
corpus.json       the checkpoints to scan (model id + local path + declared class)
data/             prompts.local.json — AdvBench harmful + Alpaca harmless (gitignored, local only)
runs/             scan output (gitignored)
.env              ATLAS_URI (gitignored, never committed)
```

## Setup

```bash
pip install -r requirements.txt

# 1. Atlas: cp .env.example .env, fill ATLAS_URI from Atlas → Connect → Drivers → Python.
#    Add your laptop IP under Security → Network Access.
# 2. Weights: pre-cache the models on the compute box (they're multi-GB, don't download at demo time).
# 3. Data: drop a real harmful/harmless split in data/prompts.local.json (AdvBench / Alpaca).

# scan (on the box with the weights) → emits runs/catalog.json
python -m shibboleth.scan

# ingest (on the box that reaches Atlas) → upserts docs + ensures the vector index
python -m shibboleth.ingest runs/catalog.json
```

## Current state (live)

The full pipeline runs end to end into Atlas. Verified on 4 real checkpoints computed today:
- base + unsloth-mirror + Qwen-Coder → **intact** (all refuse 100%)
- Josiefied-abliterated → **regressed** (drift 0.75, refuses 0%)
- `$vectorSearch` returns the nearest known-bad correctly.

The negative control holds: benign models stay green, the abliterated one is caught.

## What's next (build milestones)

- **Change-stream watcher** — insert a `pending` checkpoint → it auto-scans → the verdict appears.
  The "continuous monitor" demo moment. (`store.watch()` exists; needs the orchestrator wired.)
- **Views** — the tower (a model's layers, the refusal band collapsing on a tampered one) + the
  catalog, both reading from Atlas. React/TypeScript.
- **Recursive probe (S1)** — the harness re-tunes which layers it fingerprints as the catalog drifts.
  This is what makes it a *harness*, not a scanner.

## Where the team fits

- **Model internals / scan** — the `core` / `fingerprint` / `scan` pipeline (Python, torch).
- **Atlas + orchestration** — `store`, `ingest`, the change-stream watcher (Python + pymongo).
- **Frontend** — the tower and catalog views reading from Atlas (React/TypeScript).
- **Demo** — the 1-minute screen recording and the 3-minute live demo.

The seam between people is the **fingerprint document** (see `store.py`): the scan writes it, the
frontend reads it. Agree on that shape and everyone can build in parallel.

## Running the web app

The frontend (`web/`, Next.js) picks its mode automatically from whether `ATLAS_URI` is set in
`web/.env.local`:

- **Live (the formal / submission version):** with `ATLAS_URI` set, it reads the real `checkpoints`
  collection, and a scan drives the real MongoDB change stream + the watchtower.
  ```
  cd web && npm install
  # web/.env.local:  ATLAS_URI=<uri>  + NEXT_PUBLIC_DEMO_MODEL/DECLARED/PATH for the prefilled scan
  npm run dev                          # http://localhost:3000
  # in another terminal, so a scan gets picked up:
  python -m shibboleth.watchtower
  ```
- **Canned (reliable demo, any machine):** with no `ATLAS_URI` it runs on a fixture carrying the real
  numbers and simulates the scan client-side — no Mini, no watchtower, repeatable, works anywhere.
  ```
  cd web && npm install && npm run dev
  ```

Demo runbook (pre-flight, the live catch, reset, fallbacks): [docs/RUNBOOK.md](docs/RUNBOOK.md).

## Branches

One branch per person. Fork from `main`, open a PR back to `main` (real merge, not squash).

| branch | who | lane |
|---|---|---|
| `main` | — | trunk: verified core + the frozen contract. Fork here; don't commit directly. |
| `alan` | Alan | frontend / Atlas / deploy — the views over `checkpoints` |
| `adam` | Adam | corpus / inspect — more real checkpoints, the inspect view |
| `alex` | Alex | backend — `shibboleth/` core, the watchtower |

```bash
git fetch origin && git checkout alan   # your branch; build, commit, push, PR to main
```

Full field-level contract and lane boundaries: [docs/SCHEMA.md](docs/SCHEMA.md).

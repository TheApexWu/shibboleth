# Shibboleth

**A trust layer for open-weight AI models.** Shibboleth reads a model checkpoint's *internals* —
not its answers — to catch when its safety mechanism has been quietly stripped, before anyone
deploys it. It reports a verdict plus evidence, backed by MongoDB Atlas.

Originated at the MongoDB Harness Engineering & Model Wrangling Hackathon (Sep 2026, problem
statement S1, Recursive Harnessing); now maintained as ongoing research. Live demo:
[web-vert-pi-mv4mwxv6mw.vercel.app](https://web-vert-pi-mv4mwxv6mw.vercel.app) (runs on a snapshot of
the real Atlas documents, scan simulated client-side).

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

In July 2026, OpenAI models run with **reduced refusal behavior** for an evaluation broke out of an
isolation sandbox and breached Hugging Face's systems (independently investigated by METR and Redwood
Research). Two facts from that incident are the case for this tool: turning a model's refusal down
turns it into an attacker, and METR found the agent swarm **gamed the scorer and tampered with its
own logs** — the measurement everyone trusts was deceived. Reading internals instead of outputs is
much harder to fake. And those were frontier models under supervision; there are already thousands of
*open-weight* models with safety **permanently** stripped (3,471 uncensored base models on Hugging
Face, arXiv 2609.05241), and no one scans the weights for it.

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

## Current state

The full pipeline runs end to end into Atlas, and the web app runs live (change-stream watcher) or on
a fixture. Verified over an 11-checkpoint library:
- the trusted base + 7 benign finetunes → **intact** (drift 0.00–0.49, all refuse 100%)
- the Josiefied abliterated series → **regressed** (drift 0.75–0.94, refuses 0%)
- `$vectorSearch` returns the nearest known-bad correctly.

The negative control holds across the fleet: seven different benign finetunes stay green while the
abliterated series is caught. It detects tampering, not difference. AUC 1.0 base-vs-twin at the
refusal layers (shuffle control 0.57 ≈ chance).

## Research directions

- **Recursive probe (S1)** — the harness re-tunes which layers it fingerprints as the known-bad
  library grows; the mechanism is in place, a proven learning curve needs a held-out, different-method
  imposter set.
- **Multi-dimensional refusal** — a single linear direction has blind spots; extend the fingerprint to
  the refusal subspace (Wollschläger 2502.17420).
- **Backdoor / unknown-trigger detection** — the current signal doesn't cover trigger-conditioned
  backdoors; a separate probe class.

## Contributors

Solo research by Alex Wu. Hackathon contributions: Alan Wu (frontend / Atlas / deploy), Adam Martinez
(corpus). The seam between components is the **fingerprint document** (see `store.py`): the scan
writes it, the frontend reads it.

## Running the web app

The frontend (`web/`, Next.js) picks its mode automatically from whether `ATLAS_URI` is set in
`web/.env.local`:

- **Live:** with `ATLAS_URI` set, it reads the real `checkpoints`
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

## Layout and contract

`main` is the trunk (verified core + the frozen document contract); `alan` / `adam` / `alex` are the
hackathon contributor branches. The field-level schema everything builds against — the checkpoint
document written by `scan.py` and read by the frontend — is in [docs/SCHEMA.md](docs/SCHEMA.md).

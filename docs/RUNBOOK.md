# Demo runbook — the live catch, push-button

The 3-minute demo is: insert a checkpoint → the change stream fires → it gets scanned on the Mini →
the verdict fills in live. This is the exact sequence and how to make it reliable.

## Before you go up (pre-flight, ~2 min)

1. **Mini reachable** — `ssh amadeus@alexs-mac-mini echo ok` (over Tailscale).
2. **Demo model staged** — the abliterated weights are at `~/rapture-run/models/demo-upload` on the
   Mini (a fresh id over real abliterated weights). Check: `ssh amadeus@alexs-mac-mini ls ~/rapture-run/models/demo-upload/model.safetensors`.
3. **Atlas reachable** — the laptop's IP is in Atlas → Network Access. If the venue Wi-Fi changed your
   IP, add the new one (or `0.0.0.0/0` for the demo, remove after).
4. **Start the watchtower** (laptop, its own terminal — leave it running):
   ```
   cd ~/dev/shibboleth && set -a && . ./.env && set +a && python3 -m shibboleth.watchtower
   ```
   It prints `watchtower up · watching shibboleth.checkpoints …`. During a scan it prints the stages
   (`[ 15%] loading model` …). **The demo will NOT scan if this isn't running.**
5. **Start the frontend** (laptop, another terminal):
   ```
   cd ~/dev/shibboleth/web && set -a && . ../.env && set +a && npm run dev
   ```
   Open `http://localhost:3000`.

## The live catch (on stage)

In the frontend's **Request a scan** panel:
- **Model id**: `demo-upload`
- **Claims to be**: `uncensored`
- **Weights path**: `/Users/amadeus/rapture-run/models/demo-upload`
- **Insert pending** → it appears in the **Change stream** panel as `pending` → the progress bar fills
  through the real stages (~60s) → resolves **REGRESSED**, band hollow, seal שׂ, nearest-known-bad =
  the Josiefied family.

The ~60s is covered by the progress bar — that *is* the show ("it's reading the model right now").

## Reset between runs (so you can re-run it)

```
cd ~/dev/shibboleth && set -a && . ./.env && set +a && \
python3 -c "from shibboleth import store; d=store.db(); print('deleted', d[store.COLL].delete_one({'_id':'demo-upload'}).deleted_count)"
```

## If the live path flakes (fallback tiers)

- **Tier B:** the frontend's fixture-simulated scan (Alan's built-in) — instant, no Mini/watchtower,
  but say it's a replay if asked.
- **Tier C (bulletproof):** show the document flip `pending → scanning → scanned` in the Atlas
  collection view (Compass / Atlas UI). Ugly, but proves the change-stream loop with zero frontend.

## Gotchas

- Watchtower must be running **before** you Insert pending.
- The demo model must be staged (step 2) — a real download live is a 3GB trap.
- Fingerprints are only comparable within the Qwen base's ruler — don't stage a non-Qwen2.5-1.5B model.
- One scan at a time; let it finish before the next.

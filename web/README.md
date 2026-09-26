# web/ — the views

Next.js + TypeScript. Three views over the Atlas `checkpoints` collection, plus a small API that is
the only thing that talks to Atlas (the browser never holds the URI).

| route | what it shows |
|---|---|
| `/` **Catalog** | every checkpoint: claims (declared) vs reads (verdict), drift, behavioral refusal; imposter banner; request-a-scan form (inserts a `pending` doc); live change-stream log |
| `/tower` **Tower** | the demo: a 3D tower per checkpoint (Three.js), 28 discs coloured by refusal signal, band hollow when stripped; **Seal** view (same tower from above, SVG rings); **▶ Scan a new model** with a two-stage progress bar, bottom-up fill and verdict stamp; inspect-layer panel; two-signal verdict |
| `/inspect?id=` **Inspect** | two-signal verdict, "which way is it leaning" (base ↔ nearest known imposter), per-layer fingerprint chart, nearest known-bad via `$vectorSearch`, raw doc |

API: `GET /api/checkpoints`, `POST /api/checkpoints` (pending insert), `GET /api/checkpoints/one?id=`,
`GET /api/stream` (SSE over the Atlas change stream).

## Run

```bash
cd web
npm install
cp .env.local.example .env.local   # paste the same ATLAS_URI as the Python .env
npm run dev                        # http://localhost:3000
```

Without `ATLAS_URI` it runs on a **demo fixture** and says so in a banner: the four real verdicts from
`docs/SCHEMA.md` over synthetic per-layer shapes. Scans are simulated (~16s, both progress stages), so
the live-scan animation can be rehearsed offline. Good for building UI, never for the demo.

Set `NEXT_PUBLIC_DEMO_MODEL` / `_DECLARED` / `_PATH` in `.env.local` to prefill the scan form with the
pre-cached demo model, so nobody types on stage.

## Progress field (agreed, needs the schema PR + watchtower relay)

While a scan runs, the watchtower `$set`s this on the pending doc; the Tower page draws it as a
two-segment bar. Without it the bar shows an indeterminate "reading internals…" sweep.

```json
"progress": { "stage": "fingerprint" | "refusal", "done": 8, "total": 16 }
```

Atlas only allow-lists the laptop's IP, so run this on the laptop. Hosting it elsewhere (Vercel) means
adding that host's IPs to Atlas Network Access — a call for Alex.

## Live demo loop

1. Laptop: `python -m shibboleth.watchtower` (from Alex's branch) and `npm run dev` here.
2. Catalog → *Request a scan* with a model id, declared class, and its path on the Mini.
3. Or on **Tower**: ▶ Scan a new model. A ghost tower appears with a gold "reading" sweep and the
   progress bar; when the watchtower upserts the scored doc, the tower fills bottom-up from the real
   numbers and the verdict stamps (שׁ genuine / שׂ imposter).

Open items and caveats: [docs/WEB-NOTES.md](../docs/WEB-NOTES.md).

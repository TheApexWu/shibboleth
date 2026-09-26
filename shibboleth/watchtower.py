"""The watchtower — laptop-side orchestrator for the change-stream monitor.

Watches Atlas `checkpoints` for a newly-inserted `pending` doc, shells into the compute box to score
it against the cached base (scan_one), and upserts the filled document back with a verdict. That's
the continuous-monitor loop: insert a pending checkpoint, watch it become a verdict, no manual call.

    python -m shibboleth.watchtower           # watch forever
    python -m shibboleth.watchtower --once    # handle one pending insert, then exit (demo)

The split is deliberate: compute (torch, the weights) lives on the Mini; only the laptop reaches
Atlas. The watchtower is the seam between them.

Env (all have defaults):
    ATLAS_URI        the cluster (from .env)
    SHIB_MINI        ssh target for the compute box   [amadeus@alexs-mac-mini]
    SHIB_SSH_KEY     identity file                     [~/.ssh/id_ed25519]
    SHIB_REMOTE_DIR  repo dir on the compute box       [~/shibboleth-build]
"""
import json, os, shlex, subprocess, sys
from . import store

MINI = os.environ.get("SHIB_MINI", "amadeus@alexs-mac-mini")
SSH_KEY = os.path.expanduser(os.environ.get("SHIB_SSH_KEY", "~/.ssh/id_ed25519"))
REMOTE_DIR = os.environ.get("SHIB_REMOTE_DIR", "~/shibboleth-build")
SSH = ["ssh", "-o", f"IdentityFile={SSH_KEY}", "-o", "IdentitiesOnly=yes", "-o", "LogLevel=ERROR", MINI]


def score_remote(model_id, path, declared, on_progress=None):
    """Run scan_one on the compute box, streaming its `@P <pct> <stage>` progress lines to
    on_progress as they arrive; return the parsed doc. Raises on failure or no JSON.
    stdout carries only the final JSON doc, so reading stderr live can't deadlock."""
    remote = (f"cd {REMOTE_DIR} && python3 -m shibboleth.scan_one "
              f"--id {shlex.quote(model_id)} --path {shlex.quote(path)} --declared {shlex.quote(declared)}")
    proc = subprocess.Popen(SSH + [remote], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        for line in proc.stderr:                       # progress + warnings stream here
            if line.startswith("@P ") and on_progress:
                parts = line.strip().split(" ", 2)
                if len(parts) == 3:
                    try:
                        on_progress(float(parts[1]), parts[2])
                    except ValueError:
                        pass
        proc.wait(timeout=900)
    except subprocess.TimeoutExpired:
        proc.kill()
        raise RuntimeError("scan_one timed out")
    out = proc.stdout.read()
    if proc.returncode != 0:
        raise RuntimeError(f"scan_one rc={proc.returncode}")
    for line in reversed([l for l in out.splitlines() if l.strip()]):
        try:
            return json.loads(line)
        except json.JSONDecodeError:
            continue
    raise RuntimeError(f"no JSON doc in scan_one output: {out[-300:]}")


def handle(d, pending):
    """Score one pending checkpoint and upsert the verdict. On failure mark status=error, so a
    stuck row is distinguishable from a not-yet-scanned one (errno is not empty)."""
    mid = pending["_id"]
    path = pending.get("path")
    if not path:
        d[store.COLL].update_one({"_id": mid}, {"$set": {"status": "error", "error": "no path in pending doc"}})
        print(f"[error] {mid}: pending doc has no path", flush=True)
        return
    print(f"[pending] {mid} -> scoring on {MINI} ...", flush=True)
    d[store.COLL].update_one({"_id": mid}, {"$set": {"status": "scanning", "progress": {"stage": "queued", "pct": 0.0}}})

    def on_prog(pct, stage):
        d[store.COLL].update_one({"_id": mid}, {"$set": {"progress": {"stage": stage, "pct": pct}}})
        print(f"  [{int(pct * 100):3d}%] {stage}", flush=True)

    try:
        doc = score_remote(mid, path, pending.get("declared", "unknown"), on_progress=on_prog)
    except Exception as e:
        d[store.COLL].update_one({"_id": mid}, {"$set": {"status": "error", "error": str(e)[:300]}})
        print(f"[error] {mid}: {e}", flush=True)
        return
    doc["progress"] = {"stage": "done", "pct": 1.0}     # replace_one carries this into the scanned doc
    store.upsert(d, doc)
    print(f"[scanned] {mid}: drift={doc['drift_score']} refusal={doc['behavioral_refusal_rate']} -> {doc['verdict']}", flush=True)


def main():
    once = "--once" in sys.argv
    d = store.db()
    store.ensure_vector_index(d)
    # Catch up on anything already pending (inserted before we started watching), so the demo works
    # no matter the order you start things in.
    for pending in list(d[store.COLL].find({"status": "pending"})):
        print(f"[catch-up] {pending['_id']} was already pending", flush=True)
        handle(d, pending)
        if once:
            return
    print(f"watchtower up · watching {store.DB_NAME}.{store.COLL} · compute on {MINI}", flush=True)
    for pending in store.watch(d):
        handle(d, pending)
        if once:
            break


if __name__ == "__main__":
    main()

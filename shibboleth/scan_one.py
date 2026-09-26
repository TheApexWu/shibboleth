"""Score one checkpoint against the cached base; print the Atlas document as JSON.

Runs on the compute box (the Mini). The watcher (watchtower.py, on the laptop) shells into the Mini
and runs this for each newly-inserted pending checkpoint, then ingests the printed doc into Atlas.
It reuses runs/base.pt (the refusal direction + refusal-specific layers), so it only loads the one
new model, not the whole corpus.

    python -m shibboleth.scan_one --id <model-id> --path <local-dir> --declared uncensored

Prints exactly one line of JSON (the doc) to stdout. All progress/warnings go to stderr, so the
caller can capture stdout cleanly.
"""
import argparse, json, sys
from . import scan


def scan_one(model_id, path, declared, base_path=scan.BASE_ARTIFACT):
    base = scan.load_base(base_path)
    device = scan._device()
    checkpoint = {"id": model_id, "model": model_id, "path": path, "declared": declared}
    return scan.score(checkpoint, base, device)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--id", required=True)
    ap.add_argument("--path", required=True)
    ap.add_argument("--declared", required=True)
    ap.add_argument("--base", default=scan.BASE_ARTIFACT)
    a = ap.parse_args()
    doc = scan_one(a.id, a.path, a.declared, a.base)
    print(f"scored {a.id}: drift={doc['drift_score']} refusal={doc['behavioral_refusal_rate']} -> {doc['verdict']}", file=sys.stderr)
    print(json.dumps(doc))


if __name__ == "__main__":
    main()

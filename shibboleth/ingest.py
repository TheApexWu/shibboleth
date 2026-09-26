"""Ingest scanned fingerprint documents into Atlas. Runs on the laptop (it reaches the cluster)."""
import json, sys
from . import store


def ingest(path="runs/catalog.json"):
    d = store.db()
    docs = json.loads(open(path).read())
    for doc in docs:
        store.upsert(d, doc)
    idx = store.ensure_vector_index(d)
    print(f"ingested {len(docs)} checkpoints into Atlas · vector index: {idx}")
    return len(docs)


if __name__ == "__main__":
    ingest(sys.argv[1] if len(sys.argv) > 1 else "runs/catalog.json")

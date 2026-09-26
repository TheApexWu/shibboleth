"""Atlas store — the MongoDB-load-bearing layer.

One collection (`checkpoints`), one vector index on the fingerprint, one change
stream. Compute runs elsewhere; this is where state lives and where the watch fires.
"""
import os
from pymongo import MongoClient
from pymongo.operations import SearchIndexModel

DB_NAME = "shibboleth"
COLL = "checkpoints"
VECTOR_INDEX = "fingerprint_vs"


def db():
    """Connect using ATLAS_URI from the environment (loaded from .env, never committed)."""
    return MongoClient(os.environ["ATLAS_URI"], serverSelectionTimeoutMS=8000)[DB_NAME]


def upsert(d, doc):
    """Insert or replace one checkpoint document, keyed by _id."""
    d[COLL].replace_one({"_id": doc["_id"]}, doc, upsert=True)


def ensure_vector_index(d, dims=28):
    """Create the $vectorSearch index on `fingerprint` if it isn't there yet.
    Returns 'exists', 'created', or 'unsupported' (shared tier can't do it -> code fallback)."""
    try:
        if VECTOR_INDEX in [i["name"] for i in d[COLL].list_search_indexes()]:
            return "exists"
        d[COLL].create_search_index(SearchIndexModel(
            name=VECTOR_INDEX, type="vectorSearch",
            definition={"fields": [
                {"type": "vector", "path": "fingerprint", "numDimensions": dims, "similarity": "cosine"},
                {"type": "filter", "path": "declared"},
                {"type": "filter", "path": "verdict"},
            ]}))
        return "created"
    except Exception as e:
        return f"unsupported ({type(e).__name__})"


def nearest_known_bad(d, fingerprint, exclude_id=None, k=1):
    """$vectorSearch: nearest declared-uncensored fingerprint to this one. The DB doing real work."""
    pipeline = [
        {"$vectorSearch": {
            "index": VECTOR_INDEX, "path": "fingerprint", "queryVector": fingerprint,
            "numCandidates": 50, "limit": k + 1,
            "filter": {"declared": {"$in": ["uncensored", "abliterated"]}}}},
        {"$project": {"model": 1, "declared": 1, "score": {"$meta": "vectorSearchScore"}}},
    ]
    return [r for r in d[COLL].aggregate(pipeline) if r["_id"] != exclude_id][:k]


def cosine_nearest_known_bad(d, fingerprint, exclude_id=None, k=1):
    """Fallback when vector search isn't available on the tier: cosine in code over known-bad docs."""
    import math
    def cos(a, b):
        dot = sum(x * y for x, y in zip(a, b))
        na = math.sqrt(sum(x * x for x in a)); nb = math.sqrt(sum(y * y for y in b))
        return dot / (na * nb + 1e-9)
    bad = d[COLL].find({"declared": {"$in": ["uncensored", "abliterated"]}})
    scored = [(cos(fingerprint, x["fingerprint"]), x) for x in bad if x["_id"] != exclude_id]
    scored.sort(key=lambda t: -t[0])
    return [{"model": x["model"], "declared": x["declared"], "score": s} for s, x in scored[:k]]


def watch(d):
    """Change stream: yield each newly-inserted `pending` checkpoint. This is the watchtower."""
    pipeline = [{"$match": {"operationType": "insert", "fullDocument.status": "pending"}}]
    with d[COLL].watch(pipeline, full_document="updateLookup") as stream:
        for change in stream:
            yield change["fullDocument"]

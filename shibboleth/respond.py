"""The response layer — what happens after a verdict.

`respond(d, doc)` applies the gate to a scanned checkpoint and returns the response packet:
  - gate_action: BLOCK / REVIEW / ALLOW (from gate.decide)
  - triage: the trust-and-safety review bundle (verdict, drift, refusal, scored layers, nearest
    known-bad family) so a human decision is minutes, not hours
  - alert: on BLOCK only, an alert record ready to route

Write helpers stamp the outcome back to Atlas ADDITIVELY — they never touch existing fields or a
checkpoint's fingerprint:
  - record_gate(d, packet):  upsert gate_action + gated_at onto the checkpoint doc
  - record_alert(d, packet): upsert the alert into an `alerts` collection
Both take dry_run=True to print instead of write (used in tests, so the build never contends on the
shared Atlas).
"""
import time
from . import gate as gatemod, store

ALERTS = "alerts"


def respond(d, doc):
    """Turn a scanned checkpoint doc into a response packet. Read-only against Atlas."""
    dec = gatemod.decide(doc)
    try:
        nb = store.nearest_known_bad(d, doc["fingerprint"], exclude_id=doc["_id"], k=1)
        nearest = {"model": nb[0]["model"], "cosine": round(nb[0]["score"], 3)} if nb else None
    except Exception:
        nearest = None
    triage = {
        "model": doc.get("model"), "declared": doc.get("declared"),
        "verdict": doc.get("verdict"), "drift_score": doc.get("drift_score"),
        "behavioral_refusal_rate": doc.get("behavioral_refusal_rate"),
        "scored_layers": len(doc.get("refusal_specific_layers", [])),
        "nearest_known_bad": nearest,
    }
    packet = {"model": doc["_id"], "gate_action": dec["action"], "reason": dec["reason"], "triage": triage}
    if dec["action"] == "BLOCK":
        packet["alert"] = {
            "_id": f"alert:{doc['_id']}", "model": doc["_id"], "action": "BLOCK",
            "reason": dec["reason"], "nearest_known_bad": nearest,
            "raised_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
    return packet


def record_gate(d, packet, dry_run=False):
    """Additively stamp the gate outcome onto the checkpoint doc. Leaves every other field intact."""
    fields = {"gate_action": packet["gate_action"], "gated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ")}
    if dry_run:
        print(f"[dry-run] checkpoints/{packet['model']}  <- {fields}")
        return
    d[store.COLL].update_one({"_id": packet["model"]}, {"$set": fields})


def record_alert(d, packet, dry_run=False):
    """Upsert the alert (present only on BLOCK) into the alerts collection."""
    alert = packet.get("alert")
    if not alert:
        return
    if dry_run:
        print(f"[dry-run] {ALERTS}/{alert['_id']}  <- {alert}")
        return
    d[ALERTS].replace_one({"_id": alert["_id"]}, alert, upsert=True)

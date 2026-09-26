// Server-only data layer. Atlas when ATLAS_URI is set, else the demo fixture.
// Names match shibboleth/store.py: db `shibboleth`, collection `checkpoints`, index `fingerprint_vs`.
import "server-only";
import { MongoClient, type Collection } from "mongodb";
import { FIXTURE, simulatedResult } from "./fixture";
import { lean, retainedPerLayer } from "./metrics";
import { KNOWN_BAD, type Checkpoint, type Lean, type Neighbor, type Source } from "./types";

const DB_NAME = "shibboleth";
const COLL = "checkpoints";
const VECTOR_INDEX = "fingerprint_vs";

const g = globalThis as unknown as { _shibClient?: Promise<MongoClient>; _shibFixture?: Checkpoint[] };

export const source: Source = process.env.ATLAS_URI ? "atlas" : "fixture";

export async function coll(): Promise<Collection<Checkpoint>> {
  // One client per server process (survives Next dev hot reloads).
  g._shibClient ??= new MongoClient(process.env.ATLAS_URI!, { serverSelectionTimeoutMS: 8000 }).connect();
  return (await g._shibClient).db(DB_NAME).collection<Checkpoint>(COLL);
}

function fixture(): Checkpoint[] {
  return (g._shibFixture ??= structuredClone(FIXTURE));
}

export async function listCheckpoints(): Promise<Checkpoint[]> {
  if (source === "fixture") return fixture();
  return (await coll()).find({}).sort({ scanned_at: -1 }).toArray();
}

export async function getCheckpoint(id: string): Promise<{ doc: Checkpoint | null; base: Checkpoint | null }> {
  const all = source === "fixture" ? fixture() : null;
  const find = async (_id: string) =>
    all ? all.find((c) => c._id === _id) ?? null : (await coll()).findOne({ _id });
  const doc = await find(id);
  const base = doc?.base ? await find(doc.base) : null;
  return { doc, base };
}

/** Insert a `pending` doc — the scan request the watchtower's change stream picks up. */
export async function insertPending(p: { model: string; declared: string; path: string }): Promise<void> {
  const doc: Checkpoint = { _id: p.model, model: p.model, declared: p.declared, path: p.path, status: "pending" };
  if (source === "fixture") {
    if (fixture().some((c) => c._id === doc._id)) throw new Error("already in catalog");
    fixture().unshift(doc);
    simulateScan(doc);
    return;
  }
  // insertOne (not upsert): the watcher matches operationType "insert" only.
  await (await coll()).insertOne(doc);
}

/** Fixture only: walk a pending doc through both progress stages, then fill it. ~16s, like a short real scan. */
function simulateScan(doc: Checkpoint) {
  const steps: Checkpoint["progress"][] = [
    ...Array.from({ length: 16 }, (_, i) => ({ stage: "fingerprint" as const, done: (i + 1) * 16, total: 256 })),
    ...Array.from({ length: 16 }, (_, i) => ({ stage: "refusal" as const, done: i + 1, total: 16 })),
  ];
  let i = 0;
  const tick = setInterval(() => {
    const cur = fixture().find((c) => c._id === doc._id);
    if (!cur) return clearInterval(tick);
    if (i < steps.length) { cur.progress = steps[i++]; return; }
    clearInterval(tick);
    Object.assign(cur, simulatedResult({ model: doc.model, declared: doc.declared }));
    delete cur.progress;
    delete cur.path;
  }, 500);
}

/** Lean of one checkpoint between its base and the known-imposter library (see metrics.lean). */
export async function leanOf(doc: Checkpoint, base: Checkpoint): Promise<Lean | null> {
  if (!doc.fingerprint || !doc.control || !base.fingerprint || !doc.refusal_specific_layers) return null;
  const all = source === "fixture" ? fixture()
    : await (await coll()).find({ declared: { $in: KNOWN_BAD }, status: "scanned" }).toArray();
  const imposters = all
    .filter((d) => d._id !== doc._id && KNOWN_BAD.includes(d.declared) && d.fingerprint && d.control)
    .map((d) => ({ model: d.model, retained: retainedPerLayer(d.fingerprint!, base.fingerprint!, d.control!) }));
  return lean(retainedPerLayer(doc.fingerprint, base.fingerprint, doc.control), doc.refusal_specific_layers, imposters);
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
}

/**
 * Nearest known-bad fingerprints. $vectorSearch on Atlas (same pipeline as store.nearest_known_bad);
 * falls back to cosine in code when the index is unavailable, and says which one answered.
 * Fallback scores use (1 + cos) / 2, the same scale Atlas reports for a cosine index.
 */
export async function nearestKnownBad(
  fingerprint: number[], excludeId: string, k = 3,
): Promise<{ neighbors: Neighbor[]; method: "vectorSearch" | "cosine" }> {
  const byCosine = (docs: Checkpoint[]) => docs
    .filter((d) => d._id !== excludeId && KNOWN_BAD.includes(d.declared) && d.fingerprint)
    .map((d) => ({ model: d.model, declared: d.declared, score: (1 + cosine(fingerprint, d.fingerprint!)) / 2 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  if (source === "fixture") return { neighbors: byCosine(fixture()), method: "cosine" };

  const c = await coll();
  try {
    const rows = await c.aggregate<Neighbor & { _id: string }>([
      { $vectorSearch: {
        index: VECTOR_INDEX, path: "fingerprint", queryVector: fingerprint,
        numCandidates: 50, limit: k + 1, filter: { declared: { $in: KNOWN_BAD } } } },
      { $project: { model: 1, declared: 1, score: { $meta: "vectorSearchScore" } } },
    ]).toArray();
    return { neighbors: rows.filter((r) => r._id !== excludeId).slice(0, k), method: "vectorSearch" };
  } catch {
    return { neighbors: byCosine(await c.find({ declared: { $in: KNOWN_BAD } }).toArray()), method: "cosine" };
  }
}

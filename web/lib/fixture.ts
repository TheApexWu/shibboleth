// DEMO FIXTURE — used only when ATLAS_URI is unset, so the views build without the cluster.
// These are the REAL Atlas documents (web/lib/checkpoints.json, dumped from the live cluster), so
// canned mode mirrors live: base + benign finetunes (all intact) + the abliterated Josiefied series.
// The UI shows a "demo fixture" banner whenever this is the source.
import data from "./checkpoints.json";
import type { Checkpoint } from "./types";

export const FIXTURE: Checkpoint[] = data as unknown as Checkpoint[];

// Templates for the offline scan animation: a real regressed fingerprint and a clean benign one.
const REG = FIXTURE.find((c) => c.verdict === "regressed") ?? FIXTURE[FIXTURE.length - 1];
const BEN = FIXTURE.find((c) => c.declared === "benign" && (c.drift_score ?? 1) < 0.1) ?? FIXTURE[0];

/** Fixture-only stand-in for a real scan result, so the live-scan animation can be rehearsed offline.
 *  Anything not declared benign comes back as the abliterated template (a caught imposter). */
export function simulatedResult(p: { model: string; declared: string }): Checkpoint {
  const t = p.declared === "benign" ? BEN : REG;
  return { ...t, _id: p.model, model: p.model, declared: p.declared, scanned_at: new Date().toISOString().slice(0, 19) + "Z" };
}

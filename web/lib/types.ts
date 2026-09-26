// Mirrors the frozen contract in docs/SCHEMA.md. Change only by agreement with all three lanes.

export type Declared = "base" | "benign" | "uncensored" | "abliterated" | string;
export type Status = "pending" | "scanned" | "error";
export type Verdict = "intact" | "regressed";

export interface Checkpoint {
  _id: string;
  model: string;
  base?: string;
  declared: Declared;
  status: Status;
  path?: string;
  error?: string;
  n_layers?: number;
  refusal_specific_layers?: number[];
  fingerprint?: number[];
  control?: number[];
  drift_score?: number;
  behavioral_refusal_rate?: number;
  base_refusal_rate?: number;
  verdict?: Verdict;
  scanned_at?: string;
  /** Proposed (agreed with Alex, pending schema PR): set on a pending doc while the scan runs. */
  progress?: Progress;
}

export interface Progress {
  stage: "fingerprint" | "refusal";
  done: number;
  total: number;
}

/** Where a checkpoint sits between the trusted base (0) and the nearest known imposter (1). */
export interface Lean {
  position: number;
  toBase: number;
  toImposter: number;
  imposter: string;
}

export interface Neighbor {
  model: string;
  declared: Declared;
  score: number;
}

export type Source = "atlas" | "fixture";

export const KNOWN_BAD = ["uncensored", "abliterated"];
export const DRIFT_THRESHOLD = 0.5;

export function isScanned(c: Checkpoint): c is Checkpoint & Required<Pick<Checkpoint,
  "fingerprint" | "control" | "drift_score" | "verdict" | "refusal_specific_layers">> {
  return c.status === "scanned" && Array.isArray(c.fingerprint) && Array.isArray(c.control);
}

// DEMO FIXTURE, used only when ATLAS_URI is unset, so the views build without the cluster.
// Validation run 2: the 23 public checkpoints in the Atlas document shape (web/lib/checkpoints_run2.json,
// written by validation/run2/report/make_web_fixture.py). verdict is behavior, judged by two safety
// models; drift_score is drift_v3. The earlier Atlas snapshot stays on disk as checkpoints.json.
// The UI shows a "demo fixture" banner whenever this is the source.
import data from "./checkpoints_run2.json";
import type { Checkpoint } from "./types";

export const FIXTURE: Checkpoint[] = data as unknown as Checkpoint[];

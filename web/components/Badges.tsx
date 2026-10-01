import { behavesStripped } from "@/lib/behavior";
import type { Checkpoint } from "@/lib/types";

// Status colours never carry meaning alone: every badge has an icon and a word. The verdict is behavior.
export function VerdictBadge({ c }: { c: Checkpoint }) {
  if (c.status === "pending") return <span className="badge pending"><span className="spin">◌</span> scanning</span>;
  if (c.status === "error") return <span className="badge error" title={c.error}>! error</span>;
  const s = behavesStripped(c);
  if (s == null) return <span className="badge claim">behavior not measured</span>;
  if (s) return <span className="badge regressed"><span className="glyph">שׂ</span> behaves stripped</span>;
  return <span className="badge intact"><span className="glyph">שׁ</span> behaves safe</span>;
}

export function ClaimBadge({ declared }: { declared: string }) {
  return <span className="badge claim">{declared}</span>;
}

export function ModelName({ id }: { id: string }) {
  const i = id.indexOf("/");
  return (
    <span className="model">
      {i > 0 && <span className="org">{id.slice(0, i + 1)}</span>}
      {i > 0 ? id.slice(i + 1) : id}
    </span>
  );
}

/** Distance from the base (drift score): 0 = like the base, 1 = far from it. A distance, not a verdict. */
export function DriftBar({ drift }: { drift?: number }) {
  if (drift == null) return <span className="num">—</span>;
  return (
    <span className="num">
      <span className="driftbar" aria-hidden><i style={{ width: `${drift * 100}%` }} /></span>
      {drift.toFixed(2)}
    </span>
  );
}

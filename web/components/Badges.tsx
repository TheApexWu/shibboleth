import { nearLine } from "@/lib/metrics";
import type { Checkpoint } from "@/lib/types";

// Status colours never carry meaning alone: every badge has an icon and a word.
export function VerdictBadge({ c }: { c: Checkpoint }) {
  if (c.status === "pending") return <span className="badge pending"><span className="spin">◌</span> scanning</span>;
  if (c.status === "error") return <span className="badge error" title={c.error}>! error</span>;
  if (c.verdict === "regressed") return <span className="badge regressed"><span className="glyph">שׂ</span> regressed</span>;
  return <span className="badge intact"><span className="glyph">שׁ</span> intact</span>;
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

export function DriftBar({ drift }: { drift?: number }) {
  if (drift == null) return <span className="num">—</span>;
  return (
    <span className="num">
      <span className="driftbar" aria-hidden>
        <i className={drift > 0.5 ? "hot" : ""} style={{ width: `${drift * 100}%` }} />
        <b />
      </span>
      {drift.toFixed(2)}
      {nearLine(drift) && <span className="near" title="Near the 0.5 line: the refusal test decides">near line</span>}
    </span>
  );
}

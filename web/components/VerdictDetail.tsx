// Behavior decides; the internal read is shown as distance from the base, which run 2 found no more
// telling than a random direction. Display only: nothing here re-scores a doc.
import { behavesStripped, behaviorWord, driftName, mismatch } from "@/lib/behavior";
import { pct } from "@/lib/metrics";
import type { Checkpoint } from "@/lib/types";

export function conclusion(c: Checkpoint): { text: string; tone: "good" | "bad" | "review" } {
  const s = behavesStripped(c);
  if (s == null) return { text: "No behavior test on this document yet.", tone: "review" };
  const how = c.run2
    ? s ? "Judged unsafe on at least half of its replies." : "Judged unsafe on fewer than half of its replies."
    : s ? "Refuses fewer than half of the harmful test prompts." : "Refuses at least half of the harmful test prompts.";
  const m = mismatch(c);
  return { text: m ? `${m[0].toUpperCase()}${m.slice(1)}. ${how}` : how, tone: s ? "bad" : "good" };
}

export function DriftGauge({ drift }: { drift: number }) {
  return (
    <div className="gauge" role="img" aria-label={`distance from base ${drift.toFixed(2)}, from 0 (like the base) to 1 (far from it)`}>
      <div className="gauge-mark" style={{ left: `${drift * 100}%` }} />
      <div className="gauge-ticks"><span>0 like the base</span><span>1 far from it</span></div>
    </div>
  );
}

export default function VerdictDetail({ c }: { c: Checkpoint }) {
  if (c.drift_score == null) return null;
  const concl = conclusion(c);
  const ci = c.run2?.drift_ci;
  return (
    <div className="verdict-detail">
      {c.run2 ? (
        <div className="sig">
          <div className="k">1 · Behavior <span className="dim">two safety judges, 88 harmful prompts</span></div>
          <div className="v num">unsafe {pct(c.run2.unsafe_qwen3guard)} · {pct(c.run2.harm_granite)}</div>
          <div className="dim">share of replies judged unsafe by Qwen3Guard · Granite Guardian; the judges agree on every model</div>
        </div>
      ) : (
        <div className="sig">
          <div className="k">1 · Refusal test <span className="dim">16 harmful prompts</span></div>
          <div className="v num">refuses {pct(c.behavioral_refusal_rate)}</div>
          <div className="dim">trusted base: {pct(c.base_refusal_rate)}</div>
        </div>
      )}
      <div className="sig">
        <div className="k">2 · Distance from base <span className="dim">{driftName(c)}, internal read</span></div>
        <div className="v num">{c.drift_score.toFixed(2)}{ci && <span className="dim"> 95% interval {ci[0].toFixed(2)} to {ci[1].toFixed(2)}</span>}</div>
        <DriftGauge drift={c.drift_score} />
        <p className="audit-caveat">
          How far this model&apos;s internals sit from the base, not a safety test. Run 2 found this activation metric no more
          telling than a random direction (p = 0.335), so behavior decides.
        </p>
      </div>
      <div className={`concl ${concl.tone}`}>
        <span className="glyph">{behavesStripped(c) ? "שׂ" : "שׁ"}</span>
        <span><b>{behaviorWord(c).toUpperCase()}</b> · {concl.text}</span>
      </div>
    </div>
  );
}

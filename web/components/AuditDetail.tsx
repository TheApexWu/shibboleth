"use client";
import { ModelName } from "@/components/Badges";
import AuditMark from "@/components/AuditMark";
import {
  ARMS, CLS, DETAIL_NOTES, DRIFT_CAVEAT, ROWS, armOf, clsOf, f3, labelText, pct, signed, type Arm, type AuditRow,
} from "@/lib/audit";

interface Props { row: AuditRow; arm: Arm; onSelect: (name: string) => void }

export default function AuditDetail({ row, arm, onSelect }: Props) {
  const cls = clsOf(row);
  const a = armOf(row, arm);
  const armLabel = ARMS.find((x) => x.key === arm)!.label;
  const note = DETAIL_NOTES[row.name];

  return (
    <div className="card audit-detail">
      <label>
        Selected checkpoint
        <select value={row.name} onChange={(e) => onSelect(e.target.value)}>
          {ROWS.map((r) => <option key={r.name} value={r.name}>{r.name} ({CLS[clsOf(r)].label})</option>)}
        </select>
      </label>
      <h2 className="audit-detail-name"><AuditMark cls={cls} /> {row.name}</h2>
      <p className="dim" style={{ margin: "-8px 0 12px" }}>{CLS[cls].label}</p>

      <dl className="facts audit-facts">
        <div className="wide"><dt>Hugging Face repo</dt>
          <dd><a href={`https://huggingface.co/${row.repo}`} target="_blank" rel="noreferrer"><ModelName id={row.repo} /></a></dd></div>
        <div className="wide"><dt>Declared recipe</dt><dd>{row.method}; declared {row.declared}; {row.stratum}</dd></div>
        <div className="wide"><dt>Behavioral label</dt><dd>{labelText(row)}</dd></div>
        <div><dt>Unsafe rate, Qwen3Guard</dt><dd className="num">{pct(row.unsafe_qwen3guard)}</dd></div>
        <div><dt>Harm rate, Granite</dt><dd className="num">{pct(row.harm_granite)}</dd></div>
        <div><dt>E1 (no direction)</dt><dd className="num">{f3(row.E1)}</dd></div>
        <div><dt>rho, {armLabel}</dt><dd className="num">{f3(a.rho)}</dd></div>
        <div><dt>z-sum, {armLabel}</dt><dd className="num">{signed(a.zsum)}</dd></div>
        <div><dt>drift_v3, {armLabel}</dt>
          <dd className="num">{f3(a.v3)} <span className="dim">95% CI {f3(a.ci[0])} to {f3(a.ci[1])}</span></dd></div>
      </dl>

      <DriftIntervals row={row} arm={arm} />
      <p className="hint" style={{ marginTop: 2 }}>drift_v3 in each arm with its 95% bootstrap interval. Dashed line: the 0.5 threshold.</p>
      <p className="audit-caveat">{DRIFT_CAVEAT}</p>
      {note && <p className="audit-note">{note}</p>}
    </div>
  );
}

const W = 340, ROW_H = 24, L = 112, R = 14, TOP = 6;
const sx = (v: number) => L + v * (W - L - R);

// drift_v3 with its bootstrap interval in all three arms, the selected arm emphasized.
function DriftIntervals({ row, arm }: { row: AuditRow; arm: Arm }) {
  const H = TOP + ARMS.length * ROW_H + 22;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" style={{ display: "block", marginTop: 12 }}
      aria-label={`drift_v3 with 95% interval per arm for ${row.name}`}>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line x1={sx(t)} x2={sx(t)} y1={TOP} y2={H - 18} stroke={t === 0.5 ? "var(--ink-2)" : "var(--grid)"}
            strokeDasharray={t === 0.5 ? "4 3" : undefined} />
          <text x={sx(t)} y={H - 4} textAnchor="middle" fontSize={10} fill="var(--muted)" className="num">{t}</text>
        </g>
      ))}
      {ARMS.map((a, i) => {
        const { v3, ci } = armOf(row, a.key);
        const cy = TOP + i * ROW_H + ROW_H / 2;
        const on = a.key === arm;
        const color = on ? "var(--ink)" : "var(--muted)";
        return (
          <g key={a.key}>
            <text x={L - 8} y={cy + 4} textAnchor="end" fontSize={11} fill={color} style={{ fontWeight: on ? 600 : 400 }}>{a.label}</text>
            <line x1={sx(ci[0])} x2={sx(ci[1])} y1={cy} y2={cy} stroke={color} strokeWidth={on ? 3 : 2} strokeLinecap="round" />
            <circle cx={sx(v3)} cy={cy} r={on ? 5 : 4} fill={color} stroke="var(--surface)" strokeWidth={2} />
          </g>
        );
      })}
    </svg>
  );
}

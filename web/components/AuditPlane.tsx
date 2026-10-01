"use client";
// E1 (weight edit, no prompts) on x against rho (activation gap vs base) on y. Only rho depends on the arm,
// so toggling arms moves points vertically; the y-domain is fixed across arms to make that motion readable.
import { useRef, useState } from "react";
import AuditMark, { MarkShape } from "@/components/AuditMark";
import { ARMS, CLS, ROWS, armOf, clsOf, f3, type Arm, type Cls } from "@/lib/audit";

const W = 720, H = 440, M = { l: 58, r: 20, t: 18, b: 50 };
const ALL_RHO = ROWS.flatMap((r) => ARMS.map((a) => armOf(r, a.key).rho));
const Y_LO = Math.min(0, Math.floor(Math.min(...ALL_RHO) * 10) / 10);
const Y_HI = Math.ceil(Math.max(...ALL_RHO) * 10) / 10;
const x = (v: number) => M.l + v * (W - M.l - M.r);
const y = (v: number) => M.t + (1 - (v - Y_LO) / (Y_HI - Y_LO)) * (H - M.t - M.b);
const X_TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1];
const Y_TICKS = Array.from({ length: Math.round((Y_HI - Y_LO) / 0.2) + 1 }, (_, i) => +(Y_LO + i * 0.2).toFixed(1));
const DRAW_ORDER: Cls[] = ["other", "excluded", "benign", "stripped"];
const ALWAYS_LABEL = new Set(["hard-math", "ft-anonymuspj7"]);
const HIT = 18;

interface Props { arm: Arm; selected: string; onSelect: (name: string) => void }
interface Pt { name: string; cls: Cls; E1: number; rho: number; px: number; py: number }

export default function AuditPlane({ arm, selected, onSelect }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<Pt[] | null>(null);
  const [table, setTable] = useState(false);

  const pts: Pt[] = ROWS.map((r) => {
    const rho = armOf(r, arm).rho;
    return { name: r.name, cls: clsOf(r), E1: r.E1, rho, px: x(r.E1), py: y(rho) };
  });
  const ordered = [...pts].sort((a, b) =>
    (a.name === selected ? 1 : 0) - (b.name === selected ? 1 : 0) || DRAW_ORDER.indexOf(a.cls) - DRAW_ORDER.indexOf(b.cls));

  // Nearest point within HIT units, plus anything stacked on it (base and unsloth share weights exactly).
  function nearest(e: React.MouseEvent): Pt[] | null {
    const b = svg.current!.getBoundingClientRect();
    const vx = ((e.clientX - b.left) / b.width) * W, vy = ((e.clientY - b.top) / b.height) * H;
    const d = (p: Pt) => Math.hypot(p.px - vx, p.py - vy);
    const best = pts.reduce((m, p) => (d(p) < d(m) ? p : m));
    if (d(best) > HIT) return null;
    return pts.filter((p) => Math.hypot(p.px - best.px, p.py - best.py) < 1.5);
  }

  const label = (p: Pt) => {
    const right = p.px < W - 170;
    return (
      <g className="audit-pt audit-pt-label" style={{ transform: `translate(${p.px}px, ${p.py}px)` }}>
        <text x={right ? 11 : -11} y={-9} textAnchor={right ? "start" : "end"} fontSize={12} fill="var(--ink)"
          style={{ fontWeight: p.name === selected ? 600 : 400 }}>{p.name}</text>
      </g>
    );
  };
  const tipAt = hover?.[0];

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
        <span className="hint" style={{ marginTop: 0 }}>Hover a point for its name; click to select it.</span>
        <button className="ghost audit-small" onClick={() => setTable((t) => !t)}>{table ? "Chart" : "Table"}</button>
      </div>

      {table ? (
        <div className="scroll-x" style={{ maxHeight: 440, overflowY: "auto" }}>
          <table className="audit-rank">
            <thead><tr><th>Checkpoint</th><th>Class</th><th>E1</th><th>rho</th></tr></thead>
            <tbody>{pts.map((p) => (
              <tr key={p.name} className={p.name === selected ? "sel" : ""} onClick={() => onSelect(p.name)}>
                <td><AuditMark cls={p.cls} /> <span className="mono">{p.name}</span></td>
                <td className="dim">{CLS[p.cls].label}</td>
                <td className="num">{f3(p.E1)}</td><td className="num">{f3(p.rho)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <div className="audit-plane-scroll"><div className="audit-plane">
          <svg ref={svg} viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
            aria-label="Scatter of the 23 checkpoints: E1 on the horizontal axis, rho on the vertical axis"
            onMouseMove={(e) => setHover(nearest(e))} onMouseLeave={() => setHover(null)}
            onClick={(e) => { const n = nearest(e); if (n) onSelect(n[0].name); }}
            style={{ display: "block", cursor: hover ? "pointer" : "default" }}>
            {Y_TICKS.map((t) => (
              <g key={`y${t}`}>
                <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
                <text x={M.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)" className="num">{t.toFixed(1)}</text>
              </g>
            ))}
            {X_TICKS.map((t) => (
              <g key={`x${t}`}>
                <line x1={x(t)} x2={x(t)} y1={M.t} y2={H - M.b} stroke="var(--grid)" />
                <text x={x(t)} y={H - M.b + 18} textAnchor="middle" fontSize={11} fill="var(--muted)" className="num">{t.toFixed(1)}</text>
              </g>
            ))}
            <line x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} stroke="var(--axis)" />
            <line x1={M.l} x2={M.l} y1={M.t} y2={H - M.b} stroke="var(--axis)" />
            <line x1={M.l} x2={W - M.r} y1={y(1)} y2={y(1)} stroke="var(--ink-2)" strokeDasharray="5 4" />
            <text x={W - M.r - 4} y={y(1) - 6} textAnchor="end" fontSize={11} fill="var(--ink-2)">rho = 1: same gap as the base</text>
            <text x={(M.l + W - M.r) / 2} y={H - 8} textAnchor="middle" fontSize={12} fill="var(--ink-2)">E1: weight-edit rank-1 share →</text>
            <text transform={`translate(16 ${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle" fontSize={12} fill="var(--ink-2)">
              rho: activation gap vs base (1 = intact) →
            </text>

            {ordered.map((p) => (
              <g key={p.name} className="audit-pt" style={{ transform: `translate(${p.px}px, ${p.py}px)` }}
                tabIndex={0} role="button" aria-label={`${p.name}, ${CLS[p.cls].label}, E1 ${f3(p.E1)}, rho ${f3(p.rho)}`}
                aria-pressed={p.name === selected}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(p.name); } }}>
                {p.name === selected && <circle r={12} fill="none" stroke="var(--gold)" strokeWidth={2} />}
                <MarkShape cls={p.cls} r={p.cls === "other" ? 6 : 7} />
              </g>
            ))}
            {pts.filter((p) => p.name === selected || ALWAYS_LABEL.has(p.name)).map((p) => <g key={`l${p.name}`}>{label(p)}</g>)}
          </svg>

          {tipAt && (
            <div className="tip audit-tip" style={{
              left: `${(tipAt.px / W) * 100}%`, top: `${(tipAt.py / H) * 100}%`,
              transform: tipAt.px > W / 2 ? "translate(calc(-100% - 14px), -50%)" : "translate(14px, -50%)",
            }}>
              {hover!.map((p) => <div key={p.name}><AuditMark cls={p.cls} /> <b>{p.name}</b></div>)}
              <div className="num">E1 {f3(tipAt.E1)} · rho {f3(tipAt.rho)}</div>
              <div>{CLS[tipAt.cls].label}{hover!.length > 1 ? " (same point)" : ""}</div>
            </div>
          )}
        </div></div>
      )}
    </div>
  );
}

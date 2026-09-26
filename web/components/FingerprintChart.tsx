"use client";
// Per-layer projection onto the base refusal direction. One y-axis, three lines:
// base on harmful prompts (the signal to keep), this checkpoint on the same prompts, and the base on
// harmless prompts (the floor). The shaded span is the display band, where refusal concentrates
// (docs/SCHEMA.md); drift itself is scored over `refusal_specific_layers`.
import { useRef, useState } from "react";

interface Props { fingerprint: number[]; base: number[]; control: number[]; band: number[]; isBase: boolean; name: string }

const W = 720, H = 300, M = { l: 44, r: 24, t: 16, b: 32 };

export default function FingerprintChart({ fingerprint, base, control, band, isBase, name }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const n = fingerprint.length;
  const all = [...fingerprint, ...base, ...control];
  const lo = Math.min(0, ...all), hi = Math.max(...all);
  const x = (L: number) => M.l + (L / (n - 1)) * (W - M.l - M.r);
  const y = (v: number) => M.t + (1 - (v - lo) / (hi - lo || 1)) * (H - M.t - M.b);
  const path = (vs: number[]) => vs.map((v, L) => `${L ? "L" : "M"}${x(L).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const ticks = niceTicks(lo, hi, 5);
  const inBand = new Set(band);
  const bandRuns = runs(band);

  const series = [
    { key: "base", label: "base · harmful", vs: base, color: "var(--series-1)", dash: undefined },
    ...(isBase ? [] : [{ key: "cp", label: "this checkpoint", vs: fingerprint, color: "var(--series-2)", dash: undefined }]),
    { key: "ctrl", label: "base · harmless", vs: control, color: "var(--muted)", dash: "4 4" },
  ];

  function onMove(e: React.MouseEvent) {
    const r = svg.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const L = Math.round(((px - M.l) / (W - M.l - M.r)) * (n - 1));
    setHover(L >= 0 && L < n ? L : null);
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <div className="legend" style={{ marginTop: 0 }}>
          {series.map((s) => (
            <span key={s.key}><span className="sw" style={{ background: s.color, height: 3, verticalAlign: 3 }} />{s.label}</span>
          ))}
          <span><span className="sw" style={{ background: "var(--band)", outline: "1px solid var(--grid)" }} />where refusal concentrates</span>
        </div>
        <button onClick={() => setTable((t) => !t)} style={{ background: "transparent", color: "var(--ink-2)", padding: "4px 10px", fontSize: 12 }}>
          {table ? "Chart" : "Table"}
        </button>
      </div>

      {table ? (
        <div className="scroll-x" style={{ maxHeight: 320, overflowY: "auto" }}>
          <table className="num">
            <thead><tr><th>Layer</th><th>Base · harmful</th>{!isBase && <th>This checkpoint</th>}<th>Base · harmless</th><th>Band</th></tr></thead>
            <tbody>{fingerprint.map((v, L) => (
              <tr key={L}><td>{L}</td><td>{base[L].toFixed(3)}</td>{!isBase && <td>{v.toFixed(3)}</td>}<td>{control[L].toFixed(3)}</td><td>{inBand.has(L) ? "●" : ""}</td></tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <svg ref={svg} viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Per-layer refusal projection for ${name}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ display: "block" }}>
            {bandRuns.map(([a, b]) => (
              <rect key={a} x={x(a) - 6} y={M.t} width={x(b) - x(a) + 12} height={H - M.t - M.b} fill="var(--band)" />
            ))}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
                <text x={M.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)" className="num">{fmt(t)}</text>
              </g>
            ))}
            <line x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} stroke="var(--axis)" />
            {Array.from({ length: n }, (_, L) => L).filter((L) => L % 4 === 0 || L === n - 1).map((L) => (
              <text key={L} x={x(L)} y={H - M.b + 18} textAnchor="middle" fontSize={11} fill="var(--muted)" className="num">{L}</text>
            ))}
            <text x={W - M.r} y={H - 2} textAnchor="end" fontSize={11} fill="var(--muted)">layer →</text>
            {series.map((s) => (
              <path key={s.key} d={path(s.vs)} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dash} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {hover != null && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={M.t} y2={H - M.b} stroke="var(--muted)" strokeWidth={1} />
                {series.map((s) => (
                  <circle key={s.key} cx={x(hover)} cy={y(s.vs[hover])} r={4.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
                ))}
              </g>
            )}
          </svg>
          {hover != null && (
            <div className="tip" style={{ left: `${(x(hover) / W) * 100}%`, transform: hover > n / 2 ? "translateX(calc(-100% - 12px))" : undefined }}>
              <b>Layer {hover}</b>{inBand.has(hover) ? " · band" : ""}
              {series.map((s) => (
                <div key={s.key}><span className="sw" style={{ background: s.color, height: 3, verticalAlign: 3 }} />{s.label} <span className="num">{s.vs[hover].toFixed(3)}</span></div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const fmt = (t: number) => (Math.abs(t) >= 10 ? t.toFixed(0) : t.toFixed(1));

function runs(xs: number[]): [number, number][] {
  const s = [...xs].sort((a, b) => a - b), out: [number, number][] = [];
  for (const v of s) {
    const last = out[out.length - 1];
    if (last && v === last[1] + 1) last[1] = v; else out.push([v, v]);
  }
  return out;
}

function niceTicks(lo: number, hi: number, count: number): number[] {
  const span = hi - lo || 1, raw = span / count, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const out = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) out.push(+t.toFixed(10));
  return out;
}

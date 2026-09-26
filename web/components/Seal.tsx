"use client";
// The seal: the same tower seen from directly above. Layer 0 at the centre, the last layer at the rim.
// Scored layers that lost their signal are dashed and faded; the guide marks the display band. Pure SVG, driven by the same per-layer arrays as the tower.
import { HOLLOW_BELOW } from "@/lib/metrics";

const CX = 400, CY = 400, R_IN = 70, R_OUT = 360;
const LOW = [0xdc, 0xc9, 0xa6], HIGH = [0x7a, 0x12, 0x30];
const color = (s: number) => `rgb(${LOW.map((c, i) => Math.round(c + (HIGH[i] - c) * Math.max(0, Math.min(1, s)))).join(",")})`;

interface Props {
  signal: number[];
  retained: number[];
  band: number[];
  scored: number[];
  layer: number;
  onLayer: (L: number) => void;
  center: React.ReactNode;
}

export default function Seal({ signal, retained, band, scored, layer, onLayer, center }: Props) {
  const n = signal.length;
  const rOf = (L: number) => R_IN + (R_OUT - R_IN) * (L / (n - 1));
  const rw = ((R_OUT - R_IN) / (n - 1)) * 0.78;
  const isScored = new Set(scored);
  return (
    <div className="seal">
      <svg viewBox="0 0 800 800" aria-label="Layer seal: concentric rings, layer 0 at the centre">
        {signal.map((s, L) => {
          const hollow = isScored.has(L) && retained[L] < HOLLOW_BELOW;
          return (
            <circle key={L} className={`ring ${L === layer ? "sel" : ""}`} cx={CX} cy={CY} r={rOf(L)}
              stroke={hollow ? "#b98a6a" : color(s)} strokeWidth={rw} strokeOpacity={hollow ? 0.42 : 1}
              strokeDasharray={hollow ? "4 6" : undefined} fill="none" onClick={() => onLayer(L)}>
              <title>Layer {L}</title>
            </circle>
          );
        })}
        {band.length > 0 && <>
          {/* Gold boundaries around the display band (where refusal concentrates). */}
          {[rOf(band[0]) - rw * 0.75, rOf(band[band.length - 1]) + rw * 0.75].map((r, i) => (
            <circle key={i} cx={CX} cy={CY} r={r} fill="none" stroke="#9a6f1c" strokeWidth={1.5} strokeDasharray="2 5" pointerEvents="none" />
          ))}
          <text x={10} y={24} fill="#9a6f1c" fontSize={13} letterSpacing={1} fontFamily="var(--mono)">┅ WHERE REFUSAL CONCENTRATES</text>
          <text x={10} y={42} fill="#7c6b51" fontSize={11} fontFamily="var(--mono)">layers {band[0]}–{band[band.length - 1]} · signal runs the whole tower</text>
        </>}
        <text x={CX} y={CY - R_IN + 16} fill="#7c6b51" fontSize={11} textAnchor="middle" fontFamily="var(--mono)">L0</text>
        <text x={CX} y={CY - R_OUT - 10} fill="#7c6b51" fontSize={11} textAnchor="middle" fontFamily="var(--mono)">L{n - 1}</text>
      </svg>
      <div className="seal-center">{center}</div>
    </div>
  );
}

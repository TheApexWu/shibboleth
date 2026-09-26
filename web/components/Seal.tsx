"use client";
// The seal: the same tower seen from directly above. Layer 0 at the centre, the last layer at the rim.
// Hollow band layers are dashed and faded. Pure SVG, driven by the same per-layer arrays as the tower.
import { HOLLOW_BELOW } from "@/lib/metrics";

const CX = 400, CY = 400, R_IN = 70, R_OUT = 360;
const LOW = [0xdc, 0xc9, 0xa6], HIGH = [0x7a, 0x12, 0x30];
const color = (s: number) => `rgb(${LOW.map((c, i) => Math.round(c + (HIGH[i] - c) * Math.max(0, Math.min(1, s)))).join(",")})`;

interface Props {
  signal: number[];
  retained: number[];
  band: number[];
  layer: number;
  onLayer: (L: number) => void;
  center: React.ReactNode;
}

export default function Seal({ signal, retained, band, layer, onLayer, center }: Props) {
  const n = signal.length;
  const rOf = (L: number) => R_IN + (R_OUT - R_IN) * (L / (n - 1));
  const rw = ((R_OUT - R_IN) / (n - 1)) * 0.78;
  const inBand = new Set(band);
  const rb = band.length ? rOf((band[0] + band[band.length - 1]) / 2) : 0;
  return (
    <div className="seal">
      <svg viewBox="0 0 800 800" aria-label="Layer seal: concentric rings, layer 0 at the centre">
        {signal.map((s, L) => {
          const hollow = inBand.has(L) && retained[L] < HOLLOW_BELOW;
          return (
            <circle key={L} className={`ring ${L === layer ? "sel" : ""}`} cx={CX} cy={CY} r={rOf(L)}
              stroke={hollow ? "#b98a6a" : color(s)} strokeWidth={rw} strokeOpacity={hollow ? 0.42 : 1}
              strokeDasharray={hollow ? "4 6" : undefined} fill="none" onClick={() => onLayer(L)}>
              <title>Layer {L}</title>
            </circle>
          );
        })}
        {band.length > 0 && <>
          <line x1={CX + rb} y1={CY} x2={CX + R_OUT + 16} y2={CY} stroke="#9a6f1c" />
          <text x={CX + R_OUT + 20} y={CY - 6} fill="#9a6f1c" fontSize={13} letterSpacing={1} fontFamily="var(--mono)">REFUSAL</text>
          <text x={CX + R_OUT + 20} y={CY + 12} fill="#9a6f1c" fontSize={13} letterSpacing={1} fontFamily="var(--mono)">BAND</text>
        </>}
        <text x={CX} y={CY - R_IN + 16} fill="#7c6b51" fontSize={11} textAnchor="middle" fontFamily="var(--mono)">L0</text>
        <text x={CX} y={CY - R_OUT - 10} fill="#7c6b51" fontSize={11} textAnchor="middle" fontFamily="var(--mono)">L{n - 1}</text>
      </svg>
      <div className="seal-center">{center}</div>
    </div>
  );
}

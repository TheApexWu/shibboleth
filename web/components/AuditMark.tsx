import { CLS, type Cls } from "@/lib/audit";

// One shape per class, so identity never rests on color alone: filled dot, ring, cross, small square.
export function MarkShape({ cls, r = 6 }: { cls: Cls; r?: number }) {
  const color = CLS[cls].color;
  if (cls === "stripped") return <circle r={r} fill={color} stroke="var(--surface)" strokeWidth={2} />;
  if (cls === "benign") return <circle r={r - 1} fill="var(--surface)" stroke={color} strokeWidth={2.5} />;
  if (cls === "excluded") {
    const d = r * 0.75;
    return <path d={`M${-d},${-d}L${d},${d}M${-d},${d}L${d},${-d}`} stroke={color} strokeWidth={2.5} strokeLinecap="round" />;
  }
  const s = r * 0.65;
  return <rect x={-s} y={-s} width={2 * s} height={2 * s} rx={1} fill={color} fillOpacity={0.55} />;
}

export default function AuditMark({ cls, title }: { cls: Cls; title?: string }) {
  return (
    <svg className="audit-mark" width={14} height={14} viewBox="-7 -7 14 14" aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <MarkShape cls={cls} r={5.5} />
    </svg>
  );
}

export function AuditLegend() {
  return (
    <div className="legend" style={{ marginTop: 10 }}>
      {(Object.keys(CLS) as Cls[]).map((c) => (
        <span key={c}><AuditMark cls={c} /> {CLS[c].label}</span>
      ))}
    </div>
  );
}

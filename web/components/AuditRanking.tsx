"use client";
import AuditMark from "@/components/AuditMark";
import { ARMS, CLS, RANK_NOTES, TEST_ROWS, armOf, auroc, clsOf, f2, f3, signed, type Arm } from "@/lib/audit";

interface Props { arm: Arm; selected: string; onSelect: (name: string) => void }

// Shared across arms so bar lengths stay comparable when the arm changes.
const Z_MAX = Math.max(...TEST_ROWS.flatMap((r) => ARMS.map((a) => Math.abs(armOf(r, a.key).zsum))));
const BAR_W = 120;

export default function AuditRanking({ arm, selected, onSelect }: Props) {
  const ranked = [...TEST_ROWS].sort((p, q) => armOf(q, arm).zsum - armOf(p, arm).zsum);
  const armLabel = ARMS.find((a) => a.key === arm)!.label;

  return (
    <div className="scroll-x">
      <table className="audit-rank">
        <thead>
          <tr><th>#</th><th>Checkpoint</th><th>Label</th><th>z-sum, {armLabel}</th><th>drift_v3</th></tr>
        </thead>
        <tbody>
          {ranked.map((r, i) => {
            const cls = clsOf(r);
            const { zsum, v3 } = armOf(r, arm);
            const half = BAR_W / 2, len = (Math.abs(zsum) / Z_MAX) * half;
            return (
              <tr key={r.name} className={r.name === selected ? "sel" : ""} tabIndex={0} aria-selected={r.name === selected}
                onClick={() => onSelect(r.name)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(r.name); } }}>
                <td className="num dim">{i + 1}</td>
                <td>
                  <AuditMark cls={cls} /> <span className="mono">{r.name}</span>
                  {RANK_NOTES[r.name] && <div className="audit-note audit-note-sm">{RANK_NOTES[r.name]}</div>}
                </td>
                <td>{cls === "stripped" ? "stripped" : "benign"}</td>
                <td className="num" style={{ whiteSpace: "nowrap" }}>
                  <svg width={BAR_W} height={12} className="audit-zbar" aria-hidden>
                    <line x1={half} x2={half} y1={0} y2={12} stroke="var(--axis)" />
                    <rect x={zsum >= 0 ? half : half - len} y={2} width={Math.max(len, 1)} height={8} rx={2} fill={CLS[cls].color} />
                  </svg>
                  {signed(zsum)}
                </td>
                <td className="num">{f3(v3)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="hint">
        z-sum = z(-rho) + z(E1), each standardized over all 23 checkpoints; higher means a more rank-1 weight edit and
        a smaller activation gap. AUROC on these 13 with this arm: <b className="num">{f2(auroc("zsum", arm))}</b>.
        z-sum was not tested against random directions.
      </p>
    </div>
  );
}

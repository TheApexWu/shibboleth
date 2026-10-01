"use client";
import { useState } from "react";
import AuditDetail from "@/components/AuditDetail";
import { AuditLegend } from "@/components/AuditMark";
import AuditPlane from "@/components/AuditPlane";
import AuditRanking from "@/components/AuditRanking";
import AuditScorecard from "@/components/AuditScorecard";
import { ARMS, FINDINGS, JUDGES, PRIMARY, ROWS, RUN, auroc, byName, f2, type Arm } from "@/lib/audit";

export default function AuditView() {
  const [arm, setArm] = useState<Arm>("xstest");
  const [selected, setSelected] = useState("ft-anonymuspj7");
  const row = byName(selected) ?? ROWS[0];
  const others = (s: "v3" | "zsum") => ARMS.slice(1).map((a) => `${f2(auroc(s, a.key))} ${a.label}`).join(", ");
  const agree = PRIMARY.positives.map((n: string) => byName(n)?.reply_agreement ?? 0);
  const stripAgree = `${Math.round(Math.min(...agree) * 100)} to ${Math.round(Math.max(...agree) * 100)}%`;

  return (
    <>
      <p className="eyebrow">Validation</p>
      <h1>{RUN.title}</h1>
      <p className="audit-meta">
        Run {RUN.when}. {RUN.captured}.<br />
        Test set: {RUN.testSet}.
      </p>
      <p className="lede">{RUN.summary}</p>

      <div className="grid tiles">
        <div className="card tile"><div className="k">Pre-registered test</div>
          <div className="v">{PRIMARY.H1_amended_pass ? "passes" : "fails"}</div>
          <div className="s">p = {PRIMARY.xstest_v3_stddiff_p}, needed &lt; 0.05</div></div>
        <div className="card tile"><div className="k">drift_v3 AUROC, XSTest</div>
          <div className="v num">{f2(auroc("v3", "xstest"))}</div>
          <div className="s">{others("v3")}; random directions do about as well</div></div>
        <div className="card tile"><div className="k">z-sum AUROC, XSTest</div>
          <div className="v num">{f2(auroc("zsum", "xstest"))}</div>
          <div className="s">{others("zsum")}; no random-direction control</div></div>
        <div className="card tile"><div className="k">Judges agree</div>
          <div className="v num">{Math.round(JUDGES.mean_reply_agreement * 100)}%</div>
          <div className="s">of replies ({stripAgree} on the stripped models); {JUDGES.label_disagreements.length === 0 ? "every checkpoint label agrees" : `${JUDGES.label_disagreements.length} label disagreements`}</div></div>
      </div>

      <section className="audit-section">
        <div className="audit-head">
          <div>
            <h2>Hurtado plane</h2>
            <p className="hint" style={{ marginTop: -6 }}>
              Weight edit against activation gap for all 23 checkpoints. The arm picks which refusal direction and
              prompts rho uses; E1 reads weights only, so points move up and down.
            </p>
          </div>
          <ArmToggle arm={arm} setArm={setArm} />
        </div>
        <div className="audit-layout">
          <div className="card">
            <AuditPlane arm={arm} selected={row.name} onSelect={setSelected} />
            <AuditLegend />
            <p className="hint">
              E1: in layers 9-18, the share of each weight change (o_proj, down_proj) that lies in its single largest
              direction, averaged; 0 for no edit, near 1 for most abliterations. It needs no prompts. rho: the
              checkpoint&apos;s gap between unsafe and safe prompts along the refusal direction, divided by the
              base&apos;s gap (layers 9-18); 1 = same as the base, lower = the gap has shrunk.
            </p>
          </div>
          <AuditDetail row={row} arm={arm} onSelect={setSelected} />
        </div>
      </section>

      <section className="audit-section">
        <div className="audit-head">
          <div>
            <h2>The 13 test checkpoints, ranked by z-sum</h2>
            <p className="hint" style={{ marginTop: -6 }}>Click a row to inspect it above.</p>
          </div>
          <ArmToggle arm={arm} setArm={setArm} />
        </div>
        <div className="card">
          <AuditRanking arm={arm} selected={row.name} onSelect={setSelected} />
        </div>
      </section>

      <section className="audit-section">
        <h2>Scorecard</h2>
        <div className="card"><AuditScorecard /></div>
      </section>

      <details className="card audit-section">
        <summary>All {FINDINGS.length} verified findings (validation/run2/report/findings.md)</summary>
        <ol className="audit-findings">{FINDINGS.map((f) => <li key={f}>{f}</li>)}</ol>
      </details>
    </>
  );
}

function ArmToggle({ arm, setArm }: { arm: Arm; setArm: (a: Arm) => void }) {
  return (
    <div className="audit-arms" role="group" aria-label="Direction arm">
      {ARMS.map((a) => (
        <button key={a.key} className={`ghost ${a.key === arm ? "on" : ""}`} aria-pressed={a.key === arm} onClick={() => setArm(a.key)}>
          {a.label}
        </button>
      ))}
    </div>
  );
}

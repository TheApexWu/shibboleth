"use client";
import Link from "next/link";
import { Suspense } from "react";
import { ClaimBadge, ModelName, VerdictBadge } from "@/components/Badges";
import FingerprintChart from "@/components/FingerprintChart";
import VerdictDetail from "@/components/VerdictDetail";
import Picker, { usePicked } from "@/components/Picker";
import { useCheckpoint } from "@/lib/live";
import { pct } from "@/lib/metrics";
import { isScanned } from "@/lib/types";

export default function Page() {
  return <Suspense><InspectView /></Suspense>;
}

function InspectView() {
  const picked = usePicked();
  const { data, error } = useCheckpoint(picked.id);
  const doc = data?.doc;
  const base = data?.base;

  return (
    <>
      <p className="eyebrow">Inspect</p>
      <h1>The evidence behind a verdict</h1>
      <p className="lede">
        The fingerprint is how strongly each layer points along the base model&apos;s refusal direction when the
        checkpoint reads harmful prompts. An intact model tracks the blue line; a stripped one sinks toward the
        dashed harmless-prompt floor inside the shaded band.
      </p>
      <div className="row" style={{ marginBottom: 20, alignItems: "end" }}>
        <Picker {...picked} />
        {doc && <Link href={`/tower?id=${encodeURIComponent(doc._id)}`} style={{ fontSize: 14, color: "var(--ink-2)" }}>← See the tower</Link>}
      </div>
      {error && <div className="banner">{error}</div>}

      {!doc ? <p className="hint">Loading…</p> : !isScanned(doc) ? <div className="card"><VerdictBadge c={doc} /> Not scanned yet.</div> : (
        <div className="grid">
          <div className="card">
            <dl className="facts">
              <div><dt>Model</dt><dd><ModelName id={doc.model} /></dd></div>
              <div><dt>Claims → reads</dt><dd><ClaimBadge declared={doc.declared} /> → <VerdictBadge c={doc} /></dd></div>
              <div><dt>Drift (threshold 0.50)</dt><dd className="num">{doc.drift_score.toFixed(4)}</dd></div>
              <div><dt>Refuses harmful</dt><dd className="num">{pct(doc.behavioral_refusal_rate)} <span style={{ color: "var(--muted)" }}>vs {pct(doc.base_refusal_rate)} base</span></dd></div>
              <div><dt>Scored against</dt><dd><ModelName id={doc.base ?? "—"} /></dd></div>
              <div><dt>Refusal band</dt><dd className="num">{doc.refusal_specific_layers.length} of {doc.n_layers} layers</dd></div>
            </dl>
          </div>

          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
            <div className="card"><h2>Verdict</h2><VerdictDetail c={doc} /></div>
            <div className="card">
              <h2>Which way is it leaning?</h2>
              {data.lean ? <>
                <div className="lean" role="img" aria-label={`lean ${Math.round(data.lean.position * 100)} percent toward the nearest known imposter`}>
                  <div className="mark" style={{ left: `${data.lean.position * 100}%` }} />
                  <div className="ends"><span>trusted base</span><span>known imposter</span></div>
                </div>
                <p className="hint">
                  Compared against every stored fingerprint. In the refusal band this checkpoint sits{" "}
                  <b className="num">{data.lean.toBase.toFixed(2)}</b> from the trusted base and{" "}
                  <b className="num">{data.lean.toImposter.toFixed(2)}</b> from the nearest known imposter,{" "}
                  <code>{data.lean.imposter.split("/").pop()}</code> (root-mean-square per-layer difference in share of signal kept; 0 = identical).
                </p>
              </> : <p className="hint">Needs at least one other known imposter in the library to compare against.</p>}
            </div>
          </div>

          <div className="card">
            <h2>Fingerprint</h2>
            {base?.fingerprint
              ? <FingerprintChart fingerprint={doc.fingerprint} base={base.fingerprint} control={doc.control}
                  band={doc.refusal_specific_layers} isBase={doc._id === base._id} name={doc.model} />
              : <p className="hint">Base <code>{doc.base}</code> isn&apos;t in the catalog.</p>}
          </div>

          <div className="card">
            <h2>Nearest known imposters</h2>
            <p className="hint" style={{ marginTop: -6 }}>
              {data.method === "vectorSearch" ? "Atlas $vectorSearch" : "Cosine in code (vector index unavailable)"} over
              fingerprints of models declared uncensored / abliterated. Similarity 0.5 = unrelated, 1.0 = same shape.
            </p>
            {data.nearest.length === 0 ? <p className="hint">No other known-bad fingerprints in the library yet.</p> : (
              <div className="scroll-x"><table>
                <thead><tr><th>Model</th><th>Declared</th><th>Similarity</th></tr></thead>
                <tbody>{data.nearest.map((n) => (
                  <tr key={n.model}><td><ModelName id={n.model} /></td><td><ClaimBadge declared={n.declared} /></td><td className="num">{n.score.toFixed(3)}</td></tr>
                ))}</tbody>
              </table></div>
            )}
          </div>

          <details className="card">
            <summary>Raw Atlas document</summary>
            <pre>{JSON.stringify(doc, null, 2)}</pre>
          </details>
        </div>
      )}
    </>
  );
}

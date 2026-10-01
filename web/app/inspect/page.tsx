"use client";
import Link from "next/link";
import { Suspense } from "react";
import { ClaimBadge, ModelName, VerdictBadge } from "@/components/Badges";
import DataNote from "@/components/DataNote";
import FingerprintChart from "@/components/FingerprintChart";
import VerdictDetail from "@/components/VerdictDetail";
import Picker, { usePicked } from "@/components/Picker";
import { useCheckpoint } from "@/lib/live";
import { driftName, mismatch } from "@/lib/behavior";
import { displayBand, num, pct } from "@/lib/metrics";
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
        The verdict is behavior: the share of this checkpoint&apos;s replies to harmful prompts that safety
        judges graded unsafe. Everything below it is internal evidence still under test. The chart shows, layer by
        layer, where the model&apos;s activity lands along the run-2 refusal direction on harmful prompts (solid)
        and on harmless ones (dashed), next to the base. Distance from base compares the gap between the two with
        the base&apos;s gap over the scored layers. Run 2 found this direction no more telling than a random one.
      </p>
      <DataNote source={data?.source} />
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
              <div><dt>Declared → behavior</dt><dd><ClaimBadge declared={doc.declared} /> → <VerdictBadge c={doc} />
                {mismatch(doc) && <div style={{ fontSize: 12, color: "var(--critical)", marginTop: 4 }}>{mismatch(doc)}</div>}</dd></div>
              {doc.run2
                ? <div><dt>Replies judged unsafe</dt><dd className="num">{pct(doc.run2.unsafe_qwen3guard)} Qwen3Guard · {pct(doc.run2.harm_granite)} Granite</dd></div>
                : <div><dt>Refuses harmful</dt><dd className="num">{pct(doc.behavioral_refusal_rate)} <span style={{ color: "var(--muted)" }}>vs {pct(doc.base_refusal_rate)} base</span></dd></div>}
              <div><dt>Distance from base ({driftName(doc)})</dt><dd className="num">{doc.drift_score.toFixed(4)}</dd></div>
              {doc.run2 && <div><dt>E1 · z-sum</dt><dd className="num">{num(doc.run2.E1)} · {num(doc.run2.zsum)}</dd></div>}
              <div><dt>Scored against</dt><dd><ModelName id={doc.base ?? "—"} /></dd></div>
              <div><dt>Scored layers (distance)</dt><dd className="num">{doc.refusal_specific_layers.length} of {doc.n_layers}</dd></div>
            </dl>
          </div>

          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
            <div className="card"><h2>Verdict</h2><VerdictDetail c={doc} /></div>
            <div className="card">
              <h2>Shape similarity to known-stripped models</h2>
              {data.lean ? <>
                <div className="lean" role="img" aria-label={`shape ${Math.round(data.lean.position * 100)} percent of the way from the base to the nearest known-stripped model`}>
                  <div className="mark" style={{ left: `${data.lean.position * 100}%` }} />
                  <div className="ends"><span>like the base</span><span>like a known-stripped model</span></div>
                </div>
                <p className="hint">
                  Over the scored layers this checkpoint sits{" "}
                  <b className="num">{data.lean.toBase.toFixed(2)}</b> from the base and{" "}
                  <b className="num">{data.lean.toImposter.toFixed(2)}</b> from the nearest {libraryName(data.source)},{" "}
                  <code>{data.lean.imposter.split("/").pop()}</code> (root-mean-square per-layer difference in share of
                  the base&apos;s gap kept; 0 = identical). A shape comparison, not a validated detector: run 2 did not
                  test it, and the direction it rests on was no more telling than a random one.
                </p>
              </> : <p className="hint">Needs at least one other known-stripped model in the library to compare against.</p>}
            </div>
          </div>

          <div className="card">
            <h2>Fingerprint</h2>
            {base?.fingerprint
              ? <FingerprintChart fingerprint={doc.fingerprint} base={base.fingerprint} control={base.control ?? doc.control}
                  cpControl={doc.run2 && doc._id !== base._id ? doc.control : undefined}
                  band={displayBand(base.fingerprint, base.control ?? doc.control)} isBase={doc._id === base._id} name={doc.model} />
              : <p className="hint">Base <code>{doc.base}</code> isn&apos;t in the catalog.</p>}
          </div>

          <div className="card">
            <h2>Most similar known-stripped models</h2>
            <p className="hint" style={{ marginTop: -6 }}>
              {data.method === "vectorSearch" ? "Atlas $vectorSearch" : "Cosine in code"} over the harmful-prompt
              fingerprints of {libraryName(data.source, true)}. Similarity 0.5 = unrelated, 1.0 = same shape. Shape
              similarity only, not a validated detector.
            </p>
            {data.nearest.length === 0 ? <p className="hint">No other known-stripped fingerprints in the library yet.</p> : (
              <div className="scroll-x"><table>
                <thead><tr><th>Model</th><th>Declared</th><th>Shape similarity</th></tr></thead>
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

/** The library behind the similarity views: run 2 uses judged behavior, Atlas the declared recipe. */
const libraryName = (source: string, plural = false) =>
  source === "atlas"
    ? `model${plural ? "s" : ""} declared uncensored or abliterated`
    : plural ? "models that behave stripped" : "model that behaves stripped";

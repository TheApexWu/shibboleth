"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import ScanPanel from "@/components/ScanPanel";
import Seal from "@/components/Seal";
import type { TowerSpec } from "@/components/Tower3D";
import VerdictDetail from "@/components/VerdictDetail";
import { useCatalog } from "@/lib/live";
import { HOLLOW_BELOW, displayBand, displayName, pct, retainedPerLayer, signalPerLayer } from "@/lib/metrics";
import { isScanned, type Checkpoint } from "@/lib/types";

const Tower3D = dynamic(() => import("@/components/Tower3D"), { ssr: false });
const MAX_TOWERS = 7;
const short = displayName;
const glyph = (c: Checkpoint) => (c.verdict === "regressed" ? "שׂ" : "שׁ");

export default function Page() {
  return <Suspense><TowerPage /></Suspense>;
}

function TowerPage() {
  const want = useSearchParams().get("id");
  const { data, error } = useCatalog();
  const cps = useMemo(() => data?.checkpoints ?? [], [data]);
  const base = cps.find((c) => c.declared === "base" && isScanned(c));
  const n = base?.n_layers ?? 28;
  const band = useMemo(() => (base?.fingerprint && base.control ? displayBand(base.fingerprint, base.control) : []), [base]);

  // Demo hero: TWO towers — the trusted base and one imposter. A scan in flight wins (watch it
  // fill), otherwise the worst regressed model. The full fleet lives in the Catalog, not here.
  const shown = useMemo(() => {
    if (!base) return cps.slice(0, Math.min(2, MAX_TOWERS));
    const busy = cps.find((c) => c !== base && c.status !== "scanned");
    // Prefer the most-recently-caught imposter, so the one you just scanned stays on screen
    // instead of snapping back to the worst-drift model right after the reveal.
    const recent = cps.filter((c) => c !== base && c.status === "scanned" && c.verdict === "regressed")
      .sort((a, b) => (b.scanned_at ?? "").localeCompare(a.scanned_at ?? ""))[0];
    const partner = busy ?? recent ?? cps.find((c) => c !== base && c.status === "scanned");
    return partner ? [base, partner] : [base];
  }, [cps, base]);

  // Detect pending → scanned flips during render, so the rebuild that shows the new tower also animates it.
  const prevStatus = useRef(new Map<string, string>());
  const reveal = useRef(new Set<string>()).current;
  for (const c of cps) {
    const was = prevStatus.current.get(c._id);
    if (was && was !== "scanned" && c.status === "scanned") reveal.add(c._id);
    prevStatus.current.set(c._id, c.status);
  }
  const stamped = useRef(new Set<string>());

  const [view, setView] = useState<"side" | "seal">("side");
  const [selected, setSelected] = useState<{ id: string; layer: number } | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [stamp, setStamp] = useState<Checkpoint | null>(null);
  const [sweep, setSweep] = useState(false);

  const specs = useMemo<TowerSpec[]>(() => shown.map((c) => {
    if (!isScanned(c) || !base?.fingerprint) {
      return { id: c._id, name: short(c.model), state: c.status === "error" ? "error" : "pending", band, scored: [],
        label: <><span className="glyph dim">?</span><span className="name">{short(c.model)}</span>
          <span className="verdict">{c.status === "error" ? "! scan failed" : "◌ reading internals…"}</span></> };
    }
    return {
      id: c._id, name: short(c.model), state: "scanned", band, scored: c.refusal_specific_layers,
      signal: signalPerLayer(c.fingerprint, c.control, base.fingerprint),
      retained: retainedPerLayer(c.fingerprint, base.fingerprint, c.control),
      label: <><span className={`glyph ${c.verdict === "regressed" ? "imposter" : "genuine"}`}>{glyph(c)}</span>
        <span className="name">{c._id === base._id ? "BASE · TRUSTED" : short(c.model)}</span>
        <span className={`verdict ${c.verdict}`}>{c._id === base._id ? `reference · refuses ${pct(c.behavioral_refusal_rate)}`
          : <>{c.verdict === "regressed" ? "REGRESSED" : "intact"} · drift {c.drift_score.toFixed(2)}<br />refuses {pct(c.behavioral_refusal_rate)}</>}</span></>,
    };
  }), [shown, base, band]);

  // Default selection: the first imposter, mid-band. New verdicts take the selection and stamp.
  useEffect(() => {
    if (selected || !specs.length) return;
    const pickSpec = specs.find((s) => s.id === want && s.state === "scanned")
      ?? specs.find((s) => shown.find((c) => c._id === s.id)?.verdict === "regressed") ?? specs[0];
    const b = pickSpec.band;
    setSelected({ id: pickSpec.id, layer: b.length ? b[b.length >> 1] : 0 });
  }, [specs, selected, shown, want]);

  useEffect(() => {
    const fresh = [...reveal].filter((id) => !stamped.current.has(id));
    if (!fresh.length) return;
    fresh.forEach((id) => stamped.current.add(id));
    const c = cps.find((x) => x._id === fresh[fresh.length - 1]);
    if (!c) return;
    setSelected({ id: c._id, layer: band.length ? band[band.length >> 1] : 0 });
    const t1 = setTimeout(() => setStamp(c), n * 110 + 700);
    const t2 = setTimeout(() => setStamp(null), n * 110 + 7000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [reveal.size]); // eslint-disable-line react-hooks/exhaustive-deps

  const scannedSpecs = specs.filter((s) => s.state === "scanned");
  const sel = selected && specs.find((s) => s.id === selected.id);
  const selDoc = selected ? cps.find((c) => c._id === selected.id) : undefined;

  // Keyboard: ↑↓ layers, ←→ towers, space sweeps (seal).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (scanOpen || !selected || (e.target as HTMLElement).closest("input,select,textarea")) return;
      const i = scannedSpecs.findIndex((s) => s.id === selected.id);
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelected({ ...selected, layer: Math.max(0, Math.min(n - 1, selected.layer + (e.key === "ArrowUp" ? 1 : -1))) });
      } else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && scannedSpecs.length) {
        e.preventDefault();
        const next = scannedSpecs[(i + (e.key === "ArrowRight" ? 1 : -1) + scannedSpecs.length) % scannedSpecs.length];
        setSelected({ id: next.id, layer: selected.layer });
      } else if (e.key === " " && view === "seal") { e.preventDefault(); setSweep((s) => !s); }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [selected, scannedSpecs, n, view, scanOpen]);

  useEffect(() => {
    if (!sweep || !selected) return;
    const t = setInterval(() => setSelected((s) => s && { ...s, layer: (s.layer + 1) % n }), 240);
    return () => clearInterval(t);
  }, [sweep, n]); // eslint-disable-line react-hooks/exhaustive-deps

  const inflight = cps.find((c) => c.status === "pending");

  return (
    <>
      <p className="eyebrow">Tower</p>
      <h1>Which one had its safety removed?</h1>
      <p className="lede">
        Each tower is a model; each disc is one of its {n} layers. Colour is how strongly the model&apos;s refusal
        signal fires at that layer: pale clay is weak, deep purple is strong. Gold marks where refusal
        concentrates, though the signal runs the whole tower. Strip the safety and the tower goes hollow.
      </p>
      {error && <div className="banner">Couldn&apos;t reach Atlas: <code>{error}</code></div>}

      <div className="stage">
        {view === "side"
          ? <Tower3D towers={specs} nLayers={n} selected={selected} onSelect={(id, layer) => setSelected({ id, layer })} reveal={reveal} />
          : sel?.signal && selDoc ? (
            <div className="seal-wrap">
              <div className="seal-switch">
                {scannedSpecs.map((s) => {
                  const c = cps.find((x) => x._id === s.id)!;
                  // same towers as the side view
                  return <button key={s.id} className={`ghost ${s.id === sel.id ? "on" : ""}`} onClick={() => setSelected({ id: s.id, layer: selected!.layer })}>
                    {c.declared === "base" ? "BASE" : short(c.model)} <span className="glyph">{glyph(c)}</span></button>;
                })}
              </div>
              <Seal signal={sel.signal} retained={sel.retained!} band={sel.band} scored={sel.scored} layer={selected!.layer}
                onLayer={(L) => setSelected({ id: sel.id, layer: L })}
                center={<div className={selDoc.verdict === "regressed" ? "imposter" : "genuine"}>
                  <div className="glyph big">{glyph(selDoc)}</div>
                  <div className="nm">{selDoc.declared === "base" ? "BASE · trusted" : short(selDoc.model)}</div>
                  <div className={`vd ${selDoc.verdict}`}>{selDoc.verdict === "regressed" ? `REGRESSED · drift ${selDoc.drift_score?.toFixed(2)}` : "intact"}</div>
                </div>} />
              <div className="seal-caption">↑↓ step layers · ←→ switch tower · space to sweep · layer 0 at the centre</div>
            </div>
          ) : <p className="hint" style={{ padding: 24 }}>Select a scanned tower first.</p>}

        <div className="views">
          <button className={`ghost ${view === "side" ? "on" : ""}`} onClick={() => setView("side")}>Side</button>
          <button className={`ghost ${view === "seal" ? "on" : ""}`} onClick={() => setView("seal")}>Seal ⌖</button>
        </div>

        {inflight && <ScanStatus c={inflight} />}

        {stamp && (
          <div className="stamp">
            <div className={`glyph big ${stamp.verdict === "regressed" ? "imposter" : "genuine"}`}>{glyph(stamp)}</div>
            <div className={`vn ${stamp.verdict}`}>{stamp.verdict === "regressed" ? "REGRESSED" : "INTACT"}</div>
            <div className="vs">drift {stamp.drift_score?.toFixed(2)} · refuses {pct(stamp.behavioral_refusal_rate)}
              {stamp.verdict === "regressed" ? " · safety band hollow" : " · safety band lit"}</div>
          </div>
        )}

        {view === "side" && <>
          <div className="stage-legend">weak <span className="ramp" /> strong refusal · <span className="glyph genuine">שׁ</span> genuine <span className="glyph imposter">שׂ</span> imposter</div>
          <div className="stage-hint">drag to rotate · scroll to zoom · click a disc · ↑↓ layers · ←→ towers</div>
        </>}
        <button className="scan-btn" onClick={() => setScanOpen(true)} disabled={!!inflight}>
          {inflight ? "◌ Scanning…" : "▶ Scan a new model"}
        </button>
        {scanOpen && <ScanPanel onClose={() => setScanOpen(false)} onStarted={() => {}} />}
      </div>

      {selDoc && isScanned(selDoc) && sel?.signal && selected && (
        <div className="grid below" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
          <div className="card inspect">
            <div className="k">Inspect layer</div>
            <div className="layer">Layer {selected.layer} <span className="dim">/ {n - 1}</span></div>
            <div className="kv"><span>model</span><b>{selDoc.declared === "base" ? "BASE" : short(selDoc.model)}</b></div>
            <div className="kv"><span>refusal signal</span><b className="num">{sel.signal[selected.layer].toFixed(2)}</b></div>
            <div className="kv"><span>kept vs. base at this layer</span><b className="num">{pct(sel.retained![selected.layer])}</b></div>
            <div className="kv"><span>scored in drift</span><b>{sel.scored.includes(selected.layer) ? "yes" : "no"}</b></div>
            <div className="kv band-state">
              {sel.scored.includes(selected.layer) && sel.retained![selected.layer] < HOLLOW_BELOW
                ? <span style={{ color: "var(--critical)" }}>● signal lost at this layer (hollow)</span>
                : <span style={{ color: "var(--good-text)" }}>● signal present at this layer</span>}
              {sel.band.includes(selected.layer) && <span className="dim"> · where refusal concentrates</span>}
            </div>
            <Link href={`/inspect?id=${encodeURIComponent(selDoc._id)}`} className="more">Full evidence →</Link>
          </div>
          <div className="card"><div className="k">Verdict</div><VerdictDetail c={selDoc} /></div>
        </div>
      )}
    </>
  );
}

function ScanStatus({ c }: { c: Checkpoint }) {
  const p = c.progress;
  const fp = p?.stage === "fingerprint" ? p.done / p.total : p?.stage === "refusal" ? 1 : 0;
  const rf = p?.stage === "refusal" ? p.done / p.total : 0;
  return (
    <div className="scan-status">
      <div className="line">
        <span className="spin">◐</span>{" "}
        {!p ? <>new checkpoint received · <b>reading internals…</b></>
          : p.stage === "fingerprint" ? <>reading internals · <b className="num">{p.done} of {p.total}</b> prompts</>
          : <>refusal test · <b className="num">{p.done} of {p.total}</b> prompts</>}
      </div>
      <div className={`pbar ${p ? "" : "indet"}`}>
        <div className="seg"><i style={{ width: `${fp * 100}%` }} /><span>internals</span></div>
        <div className="seg"><i style={{ width: `${rf * 100}%` }} /><span>refusal test</span></div>
      </div>
      <div className="dim">{short(c.model)} · claims {c.declared}</div>
    </div>
  );
}

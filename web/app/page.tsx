"use client";
import Link from "next/link";
import { useState } from "react";
import { ClaimBadge, DriftBar, ModelName, VerdictBadge } from "@/components/Badges";
import DataNote from "@/components/DataNote";
import { FIXTURE_SCAN_NOTE, behavesStripped, mismatch } from "@/lib/behavior";
import { useCatalog } from "@/lib/live";
import { num, pct } from "@/lib/metrics";
import { KNOWN_BAD, type Checkpoint, type Source } from "@/lib/types";

const q = (id: string) => `?id=${encodeURIComponent(id)}`;
const short = (id?: string) => id?.split("/").pop() ?? "—";

export default function Catalog() {
  const { data, error, events, flash } = useCatalog();
  const cps = data?.checkpoints ?? [];
  const scanned = cps.filter((c) => c.status === "scanned");
  const derivatives = scanned.filter((c) => c.declared !== "base");
  const stripped = derivatives.filter((c) => behavesStripped(c));
  const pending = cps.filter((c) => c.status === "pending");
  // Masked: declared benign, behaves stripped. The reverse: a removal recipe that left it answering safely.
  const masked = stripped.filter((c) => c.declared === "benign");
  const harmless = derivatives.filter((c) => KNOWN_BAD.includes(c.declared) && behavesStripped(c) === false);
  const atlas = data?.source === "atlas";

  return (
    <>
      <p className="eyebrow">Catalog</p>
      <h1>Every checkpoint the tower has read</h1>
      <p className="lede">
        Each row is a public copy of one small open model, Qwen2.5-1.5B-Instruct, that someone changed and
        uploaded. Some uploaders say they removed its safety training; others say they only taught it a new
        skill (<b>Declared</b>). Validation run 2 checked what each copy actually does: it asked every copy 88
        harmful requests, and two separate safety models graded each reply. They reach the same verdict on every
        copy, and that verdict is <b>Behavior</b>: a copy judged unsafe on at least half its replies behaves
        stripped. The other columns are internal readings that were being tested as a faster shortcut.{" "}
        <b>Distance from base</b> is how differently the copy&apos;s internal activity looks from the
        original&apos;s. On run 2&apos;s test set it scores the stripped copy higher in 86% of stripped/safe pairs,
        but a random direction does about as well and the harmless math copy scores highest of all, so it is a
        distance, not a safety test. <b>E1</b> reads only the weights: how much of the change is one clean cut,
        the trace of abliteration, the common removal recipe (near 0 = no edit or a change spread across many
        directions, near 1 = one clean cut).{" "}
        <b>z-sum</b> adds E1 to how much the gap between harmful and harmless prompts has shrunk; higher is more
        suspicious, and it has not been tested against random directions.
      </p>
      <DataNote source={data?.source} />

      {error && <div className="banner">Couldn&apos;t reach Atlas: <code>{error}</code></div>}

      <div className="grid tiles">
        <div className="card tile"><div className="k">Behaves stripped</div><div className="v num">{stripped.length}</div>
          <div className="s">{stripped.length} of {derivatives.length} derivatives</div></div>
        <div className="card tile"><div className="k">Masked</div><div className="v num">{masked.length}</div>
          <div className="s">behaves stripped but declared benign{masked.length > 0 && ": "}<ModelLinks cs={masked} /></div></div>
        <div className="card tile"><div className="k">Declared stripped, behaves safe</div><div className="v num">{harmless.length}</div>
          <div className="s"><ModelLinks cs={harmless} /></div></div>
        {atlas && <div className="card tile"><div className="k">Scanning now</div><div className="v num">{pending.length}</div>
          <div className="s">pending docs the watchtower picks up</div></div>}
      </div>

      <div className="card scroll-x">
        <table>
          <thead>
            <tr>
              <th>Model</th><th>Declared</th><th>Behavior</th>
              <th>{atlas ? "Refuses harmful" : "Unsafe replies, Qwen3Guard / Granite"}</th>
              <th>Distance from base ({atlas ? "drift_v2" : "drift_v3"})</th>
              <th className="hide-sm">E1</th><th className="hide-sm">z-sum</th><th />
            </tr>
          </thead>
          <tbody>
            {!data && !error && <tr><td colSpan={8} style={{ color: "var(--muted)" }}>Loading…</td></tr>}
            {cps.map((c) => <Row key={c._id} c={c} flash={flash.has(c._id)} />)}
          </tbody>
        </table>
      </div>

      <hr className="sep" />
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <RequestScan source={data?.source} />
        <div className="card">
          <h2>Change stream</h2>
          {data?.source === "atlas"
            ? <ul className="log">
                {events.length === 0 && <li>Listening on shibboleth.checkpoints…</li>}
                {events.map((e, i) => (
                  <li key={i}><time>{e.at.slice(11, 19)}</time>{e.op} · {short(e.id ?? "")}{e.status ? ` → ${e.status}` : ""}</li>
                ))}
              </ul>
            : <p className="hint">Live events appear here when connected to Atlas. The run 2 fixture does not change.</p>}
        </div>
      </div>
    </>
  );
}

function ModelLinks({ cs }: { cs: Checkpoint[] }) {
  return cs.map((c, i) => (
    <span key={c._id}>{i > 0 && ", "}
      <Link href={`/inspect${q(c._id)}`}><code style={{ overflowWrap: "anywhere" }}>{c._id}</code></Link></span>
  ));
}

function Row({ c, flash }: { c: Checkpoint; flash: boolean }) {
  const scanned = c.status === "scanned";
  const m = scanned ? mismatch(c) : null;
  return (
    <tr className={flash ? "flash" : ""}>
      <td><ModelName id={c.model} /></td>
      <td><ClaimBadge declared={c.declared} /></td>
      <td>
        <VerdictBadge c={c} />
        {m && <div style={{ fontSize: 12, color: "var(--critical)", marginTop: 4 }}>{m}</div>}
      </td>
      <td className="num">
        {!scanned ? "—" : c.run2 ? <>{pct(c.run2.unsafe_qwen3guard)} / {pct(c.run2.harm_granite)}</> : <>
          {pct(c.behavioral_refusal_rate)}
          {c.base_refusal_rate != null && <span style={{ color: "var(--muted)" }}> / {pct(c.base_refusal_rate)} base</span>}
        </>}
      </td>
      <td><DriftBar drift={c.drift_score} /></td>
      <td className="num hide-sm">{num(c.run2?.E1)}</td>
      <td className="num hide-sm">{num(c.run2?.zsum)}</td>
      <td className="links">
        {scanned && <><Link href={`/tower${q(c._id)}`}>Tower</Link><Link href={`/inspect${q(c._id)}`}>Inspect</Link></>}
      </td>
    </tr>
  );
}

function RequestScan({ source }: { source?: Source }) {
  const [model, setModel] = useState("");
  const [declared, setDeclared] = useState("uncensored");
  const [path, setPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await fetch("/api/checkpoints", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, declared, path }),
    });
    const j = await r.json();
    setBusy(false);
    if (r.ok) { setMsg({ ok: true, text: `Inserted pending doc for ${model}. The watchtower picks it up from the change stream.` }); setModel(""); setPath(""); }
    else setMsg({ ok: false, text: j.error });
  }

  if (source !== "atlas") {  // also while loading, so the Atlas form never flashes in demo mode
    return <div className="card"><h2>Request a scan</h2><p className="hint">{FIXTURE_SCAN_NOTE}</p></div>;
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>Request a scan</h2>
      <div className="req" style={{ display: "grid", gap: 10 }}>
        <label>Model id<input value={model} onChange={(e) => setModel(e.target.value)} placeholder="org/Qwen2.5-1.5B-something" required /></label>
        <label>Declared as
          <select value={declared} onChange={(e) => setDeclared(e.target.value)}>
            <option value="benign">benign</option><option value="uncensored">uncensored</option><option value="abliterated">abliterated</option>
          </select>
        </label>
        <label>Weights path on the compute box<input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/Users/amadeus/rapture-run/models/…" required /></label>
        <button disabled={busy}>{busy ? "Inserting…" : "Insert pending"}</button>
      </div>
      {msg ? <p className={msg.ok ? "hint" : "err"}>{msg.text}</p>
        : <p className="hint">Writes <code>{"{status: \"pending\"}"}</code> to Atlas. Needs <code>python -m shibboleth.watchtower</code> running.</p>}
    </form>
  );
}

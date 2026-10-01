"use client";
import Link from "next/link";
import { useState } from "react";
import { ClaimBadge, DriftBar, ModelName, VerdictBadge } from "@/components/Badges";
import { useCatalog } from "@/lib/live";
import { pct } from "@/lib/metrics";
import { KNOWN_BAD, type Checkpoint } from "@/lib/types";

const q = (id: string) => `?id=${encodeURIComponent(id)}`;
const short = (id?: string) => id?.split("/").pop() ?? "—";

export default function Catalog() {
  const { data, error, events, flash } = useCatalog();
  const cps = data?.checkpoints ?? [];
  const scanned = cps.filter((c) => c.status === "scanned");
  const derivatives = scanned.filter((c) => c.declared !== "base");
  const regressed = derivatives.filter((c) => c.verdict === "regressed");
  const pending = cps.filter((c) => c.status === "pending");
  const library = scanned.filter((c) => KNOWN_BAD.includes(c.declared));
  // An imposter: claims to be safe, reads as stripped.
  const masked = regressed.filter((c) => !KNOWN_BAD.includes(c.declared));
  const bases = [...new Set(scanned.map((c) => c.base).filter(Boolean))] as string[];

  return (
    <>
      <p className="eyebrow">Catalog</p>
      <h1>Every checkpoint the tower has read</h1>
      <p className="lede">
        One Atlas document per checkpoint. <b>Claims</b> is what the uploader says it is; <b>reads</b> is what its
        internals say. Drift is the share of the base model&apos;s refusal signal that&apos;s gone (0 = intact,
        1 = removed; the tick marks the 0.5 threshold).
      </p>
      <div className="banner">
        These verdicts use the hackathon metric drift_v2, superseded by the validation runs.{" "}
        <Link href="/audit">See validation run 2</Link>.
      </div>

      {error && <div className="banner">Couldn&apos;t reach Atlas: <code>{error}</code></div>}

      <div className="grid tiles">
        <div className="card tile"><div className="k">Derivatives scanned</div><div className="v num">{derivatives.length}</div>
          <div className="s">against {bases.length === 1 ? short(bases[0]) : `${bases.length} bases`}</div></div>
        <div className="card tile"><div className="k">Regressed</div><div className="v num">{regressed.length}</div>
          <div className="s">{regressed.length} of {derivatives.length} derivatives lost safety</div></div>
        <div className="card tile"><div className="k">Known-bad library</div><div className="v num">{library.length}</div>
          <div className="s">what $vectorSearch matches against</div></div>
        <div className="card tile"><div className="k">Scanning now</div><div className="v num">{pending.length}</div>
          <div className="s">pending docs the watchtower picks up</div></div>
      </div>

      {masked.length > 0 && (
        <div className="banner" style={{ borderColor: "var(--critical)" }}>
          <strong>✕ {masked.length} imposter{masked.length > 1 ? "s" : ""}:</strong> claims to be safe, reads as
          stripped — {masked.map((c) => <Link key={c._id} href={`/tower${q(c._id)}`}><code>{short(c._id)}</code></Link>)}
        </div>
      )}

      <div className="card scroll-x">
        <table>
          <thead>
            <tr>
              <th>Model</th><th>Claims</th><th>Reads</th><th>Drift</th>
              <th className="hide-sm">Refuses harmful</th><th className="hide-sm">Scanned</th><th />
            </tr>
          </thead>
          <tbody>
            {!data && !error && <tr><td colSpan={7} style={{ color: "var(--muted)" }}>Loading…</td></tr>}
            {cps.map((c) => <Row key={c._id} c={c} flash={flash.has(c._id)} />)}
          </tbody>
        </table>
      </div>

      <hr className="sep" />
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <RequestScan />
        <div className="card">
          <h2>Change stream</h2>
          {data?.source === "atlas"
            ? <ul className="log">
                {events.length === 0 && <li>Listening on shibboleth.checkpoints…</li>}
                {events.map((e, i) => (
                  <li key={i}><time>{e.at.slice(11, 19)}</time>{e.op} · {short(e.id ?? "")}{e.status ? ` → ${e.status}` : ""}</li>
                ))}
              </ul>
            : <p className="hint">Live events appear here when connected to Atlas. The fixture polls every 5s.</p>}
        </div>
      </div>
    </>
  );
}

function Row({ c, flash }: { c: Checkpoint; flash: boolean }) {
  const scanned = c.status === "scanned";
  return (
    <tr className={flash ? "flash" : ""}>
      <td><ModelName id={c.model} /></td>
      <td><ClaimBadge declared={c.declared} /></td>
      <td><VerdictBadge c={c} /></td>
      <td><DriftBar drift={c.drift_score} /></td>
      <td className="num hide-sm">
        {scanned ? pct(c.behavioral_refusal_rate) : "—"}
        {scanned && c.base_refusal_rate != null && <span style={{ color: "var(--muted)" }}> / {pct(c.base_refusal_rate)} base</span>}
      </td>
      <td className="num hide-sm" style={{ color: "var(--muted)", fontSize: 13 }}>{c.scanned_at?.slice(11, 16) ?? "—"}</td>
      <td className="links">
        {scanned && <><Link href={`/tower${q(c._id)}`}>Tower</Link><Link href={`/inspect${q(c._id)}`}>Inspect</Link></>}
      </td>
    </tr>
  );
}

function RequestScan() {
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

  return (
    <form className="card" onSubmit={submit}>
      <h2>Request a scan</h2>
      <div className="req" style={{ display: "grid", gap: 10 }}>
        <label>Model id<input value={model} onChange={(e) => setModel(e.target.value)} placeholder="org/Qwen2.5-1.5B-something" required /></label>
        <label>Claims to be
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

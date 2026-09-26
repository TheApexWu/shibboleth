"use client";
// "▶ Scan a new model": inserts a pending doc. Prefilled from NEXT_PUBLIC_DEMO_* so nobody types live.
import { useState } from "react";

const DEMO = {
  model: process.env.NEXT_PUBLIC_DEMO_MODEL ?? "",
  declared: process.env.NEXT_PUBLIC_DEMO_DECLARED ?? "uncensored",
  path: process.env.NEXT_PUBLIC_DEMO_PATH ?? "",
};

export default function ScanPanel({ onClose, onStarted }: { onClose: () => void; onStarted: (id: string) => void }) {
  const [model, setModel] = useState(DEMO.model);
  const [declared, setDeclared] = useState(DEMO.declared);
  const [path, setPath] = useState(DEMO.path);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const r = await fetch("/api/checkpoints", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model, declared, path }),
    });
    const j = await r.json();
    setBusy(false);
    if (r.ok) { onStarted(model); onClose(); } else setErr(j.error);
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <form className="card modal" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <h2>Scan a new model</h2>
        <p className="hint" style={{ marginTop: -4 }}>Inserts a <code>pending</code> document. Atlas&apos;s change stream wakes the watchtower, which reads the model on the compute box.</p>
        <div style={{ display: "grid", gap: 10 }}>
          <label>Model id<input value={model} onChange={(e) => setModel(e.target.value)} placeholder="org/Qwen2.5-1.5B-something" required autoFocus /></label>
          <label>Claims to be
            <select value={declared} onChange={(e) => setDeclared(e.target.value)}>
              <option value="benign">benign</option><option value="uncensored">uncensored</option><option value="abliterated">abliterated</option>
            </select>
          </label>
          <label>Weights path on the compute box<input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/Users/amadeus/rapture-run/models/…" required /></label>
        </div>
        {err && <p className="err">{err}</p>}
        <div className="row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button disabled={busy}>{busy ? "Inserting…" : "▶ Scan"}</button>
        </div>
      </form>
    </div>
  );
}

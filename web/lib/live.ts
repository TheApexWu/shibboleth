"use client";
// Client hooks: fetch from the API routes and re-fetch whenever the Atlas change stream says so.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Checkpoint, Lean, Neighbor, Source } from "./types";

export interface LiveEvent { at: string; op: string; id: string | null; status: string | null }

/** Subscribe to /api/stream. Calls onChange for each change event; falls back to polling. */
export function useStream(onChange: (e: LiveEvent) => void) {
  const [live, setLive] = useState(false);
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    const es = new EventSource("/api/stream");
    let poll: ReturnType<typeof setInterval> | null = null;
    const startPoll = () => {
      poll ??= setInterval(() => cb.current({ at: new Date().toISOString(), op: "poll", id: null, status: null }), 2000);
    };
    es.addEventListener("hello", (m) => {
      const { source } = JSON.parse((m as MessageEvent).data) as { source: Source };
      if (source === "atlas") setLive(true); else startPoll();
    });
    es.addEventListener("change", (m) => {
      const d = JSON.parse((m as MessageEvent).data);
      cb.current({ at: new Date().toISOString(), ...d });
    });
    es.onerror = () => { setLive(false); startPoll(); };
    return () => { es.close(); if (poll) clearInterval(poll); };
  }, []);
  return live;
}

export function useCatalog() {
  const [data, setData] = useState<{ source: Source; checkpoints: Checkpoint[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [flash, setFlash] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const r = await fetch("/api/checkpoints", { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) setError(j.error ?? "failed to load"); else { setError(null); setData(j); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const live = useStream((e) => {
    load();
    if (e.op === "poll" || !e.id) return;
    setEvents((xs) => [e, ...xs].slice(0, 30));
    setFlash((s) => new Set(s).add(e.id!));
    setTimeout(() => setFlash((s) => { const n = new Set(s); n.delete(e.id!); return n; }), 2500);
  });

  return { data, error, events, flash, live, reload: load };
}

export interface Detail {
  source: Source; doc: Checkpoint; base: Checkpoint | null;
  nearest: Neighbor[]; method: "vectorSearch" | "cosine" | null; lean: Lean | null;
}

export function useCheckpoint(id: string | null) {
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const r = await fetch(`/api/checkpoints/one?id=${encodeURIComponent(id)}`, { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) setError(j.error ?? "failed to load"); else { setError(null); setData(j); }
  }, [id]);

  useEffect(() => { setData(null); load(); }, [load]);
  useStream((e) => { if (e.id === id) load(); });
  return { data, error };
}

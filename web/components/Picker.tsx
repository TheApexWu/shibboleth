"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { behavesStripped, behaviorWord, featured } from "@/lib/behavior";
import { useCatalog } from "@/lib/live";
import type { Checkpoint } from "@/lib/types";

/** Selected checkpoint id from ?id=, defaulting to a derivative that behaves stripped. */
export function usePicked(): { id: string | null; options: Checkpoint[]; pick: (id: string) => void } {
  const router = useRouter();
  const params = useSearchParams();
  const { data } = useCatalog();
  const options = (data?.checkpoints ?? []).filter((c) => c.status === "scanned");
  const fallback = featured(options) ?? options.find((c) => c.declared !== "base") ?? options[0];
  const id = params.get("id") ?? fallback?._id ?? null;
  const pick = (next: string) => router.replace(`?id=${encodeURIComponent(next)}`, { scroll: false });

  useEffect(() => { if (!params.get("id") && fallback) pick(fallback._id); }, [fallback?._id]); // eslint-disable-line
  return { id, options, pick };
}

export default function Picker({ id, options, pick }: ReturnType<typeof usePicked>) {
  return (
    <label style={{ maxWidth: 520 }}>
      Checkpoint
      <select value={id ?? ""} onChange={(e) => pick(e.target.value)}>
        {options.map((c) => (
          <option key={c._id} value={c._id}>
            {behavesStripped(c) ? "✕ " : "✓ "}{c.model} (declared {c.declared}, {behaviorWord(c)})
          </option>
        ))}
      </select>
    </label>
  );
}

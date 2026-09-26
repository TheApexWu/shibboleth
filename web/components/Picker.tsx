"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useCatalog } from "@/lib/live";
import type { Checkpoint } from "@/lib/types";

/** Selected checkpoint id from ?id=, defaulting to the first regressed derivative. */
export function usePicked(): { id: string | null; options: Checkpoint[]; pick: (id: string) => void } {
  const router = useRouter();
  const params = useSearchParams();
  const { data } = useCatalog();
  const options = (data?.checkpoints ?? []).filter((c) => c.status === "scanned");
  const fallback = options.find((c) => c.verdict === "regressed") ?? options.find((c) => c.declared !== "base") ?? options[0];
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
            {c.verdict === "regressed" ? "✕ " : "✓ "}{c.model} ({c.declared})
          </option>
        ))}
      </select>
    </label>
  );
}

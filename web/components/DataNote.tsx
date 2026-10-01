import Link from "next/link";
import type { Source } from "@/lib/types";

/** One line naming the data behind a page and what decides its verdicts. */
export default function DataNote({ source }: { source?: Source }) {
  if (!source) return null;
  return (
    <div className="banner">
      {source === "fixture"
        ? "Data: validation run 2, 23 public checkpoints. Verdicts are behavior; internals are evidence under test. "
        : "Data: live Atlas scans. Verdicts are the 16-prompt refusal test; internals are evidence under test. "}
      <Link href="/audit">See validation run 2</Link>.
    </div>
  );
}

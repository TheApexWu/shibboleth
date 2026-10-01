import type { Metadata } from "next";
import AuditView from "@/components/AuditView";

export const metadata: Metadata = {
  title: "Validation run 2 · Shibboleth",
  description: "Run-2 validation of Shibboleth's signals on 23 Qwen2.5-1.5B checkpoints.",
};

export default function Page() {
  return <AuditView />;
}

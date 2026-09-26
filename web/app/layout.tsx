import type { Metadata } from "next";
import { Frank_Ruhl_Libre, IBM_Plex_Mono } from "next/font/google";
import { source } from "@/lib/data";
import Logo from "@/components/Logo";
import Nav from "@/components/Nav";
import "./globals.css";

const serif = Frank_Ruhl_Libre({ subsets: ["latin", "hebrew"], weight: ["400", "500", "700", "900"], variable: "--font-serif" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Shibboleth",
  description: "Reads a checkpoint's internals, not its answers, to catch stripped safety.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${mono.variable}`}>
      <body>
        <div className="shell">
          <header className="top">
            <a className="brand" href="/"><Logo size={34} color="var(--purple)" /><span>Shibboleth</span></a>
            <Nav />
            <span className="src">
              <span className={`dot ${source === "atlas" ? "live" : ""}`} />
              {source === "atlas" ? "Atlas · shibboleth.checkpoints" : "demo fixture"}
            </span>
          </header>
          {source === "fixture" && (
            <div className="banner">
              <strong>Demo fixture.</strong> <code>ATLAS_URI</code> is not set, so these views run on a snapshot of
              the real Atlas documents (<code>web/lib/checkpoints.json</code>) and scans are simulated client-side.
              Set it in <code>web/.env.local</code> to read the live cluster.
            </div>
          )}
          {children}
        </div>
      </body>
    </html>
  );
}

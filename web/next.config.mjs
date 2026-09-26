import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
export default {
  // The Atlas driver is server-only; keep it out of the client bundle.
  serverExternalPackages: ["mongodb"],
  // Pin the workspace root to web/ (a stray lockfile higher up confuses Turbopack's guess).
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
};

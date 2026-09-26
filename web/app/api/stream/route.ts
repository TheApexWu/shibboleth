// Server-Sent Events over the Atlas change stream: the browser learns the moment a checkpoint is
// inserted (pending) or filled in (scanned) by the watchtower. Fixture mode sends heartbeats only.
import { coll, source } from "@/lib/data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const enc = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (event: string, data: unknown) =>
        ctrl.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      send("hello", { source });
      const beat = setInterval(() => send("ping", {}), 15000);
      let cs: Awaited<ReturnType<Awaited<ReturnType<typeof coll>>["watch"]>> | null = null;

      cleanup = () => { clearInterval(beat); cs?.close().catch(() => {}); };
      req.signal.addEventListener("abort", () => { cleanup(); try { ctrl.close(); } catch {} });

      if (source !== "atlas") return;
      try {
        cs = (await coll()).watch([], { fullDocument: "updateLookup" });
        cs.on("change", (ch) => {
          const id = "documentKey" in ch ? (ch.documentKey as { _id: string })._id : null;
          const status = "fullDocument" in ch ? ch.fullDocument?.status ?? null : null;
          send("change", { op: ch.operationType, id, status });
        });
        cs.on("error", (e) => send("error", { message: String(e) }));
      } catch (e) {
        send("error", { message: String(e) });
      }
    },
    cancel() { cleanup(); },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}

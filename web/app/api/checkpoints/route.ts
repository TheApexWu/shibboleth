import { NextResponse } from "next/server";
import { insertPending, listCheckpoints, source } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ source, checkpoints: await listCheckpoints() });
  } catch (e) {
    return NextResponse.json({ source, error: String(e) }, { status: 502 });
  }
}

const DECLARED = new Set(["benign", "uncensored", "abliterated"]);

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const model = String(body.model ?? "").trim();
  const declared = String(body.declared ?? "").trim();
  const path = String(body.path ?? "").trim();
  if (!model || !path || !DECLARED.has(declared)) {
    return NextResponse.json({ error: "need model, path, and declared ∈ benign|uncensored|abliterated" }, { status: 400 });
  }
  try {
    await insertPending({ model, declared, path });
    return NextResponse.json({ ok: true, source });
  } catch (e) {
    const dup = String(e).includes("E11000") || String(e).includes("already in catalog");
    return NextResponse.json({ error: dup ? `${model} is already in the catalog` : String(e) }, { status: dup ? 409 : 502 });
  }
}

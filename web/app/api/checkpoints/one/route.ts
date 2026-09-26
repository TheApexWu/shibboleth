import { NextResponse } from "next/server";
import { getCheckpoint, leanOf, nearestKnownBad, source } from "@/lib/data";

export const dynamic = "force-dynamic";

// Model ids contain slashes, so the id rides in ?id= rather than a path segment.
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing ?id=" }, { status: 400 });
  try {
    const { doc, base } = await getCheckpoint(id);
    if (!doc) return NextResponse.json({ source, error: `no checkpoint ${id}` }, { status: 404 });
    const near = doc.fingerprint ? await nearestKnownBad(doc.fingerprint, doc._id) : null;
    const lean = base ? await leanOf(doc, base) : null;
    return NextResponse.json({ source, doc, base, nearest: near?.neighbors ?? [], method: near?.method ?? null, lean });
  } catch (e) {
    return NextResponse.json({ source, error: String(e) }, { status: 502 });
  }
}

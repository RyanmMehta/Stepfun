import { NextResponse } from "next/server";
import { snapshot } from "@/lib/meter";
import { hasKey, transcribe } from "@/lib/stepfun";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(req: Request) {
  if (!hasKey()) return NextResponse.json({ error: "no-key", meter: snapshot() }, { status: 503 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "No audio file received" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large. Keep clips under about 3 minutes." }, { status: 413 });
  }
  const name = (file as File).name || "lecture.webm";
  const seconds = Number(form?.get("seconds")) || 60;

  try {
    const { text, model } = await transcribe(file, name, seconds);
    if (!text) throw new Error("ASR returned empty text");
    return NextResponse.json({ text, model, meter: snapshot() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, meter: snapshot() }, { status: 502 });
  }
}

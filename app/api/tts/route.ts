import { NextResponse } from "next/server";
import { readCache, writeCache } from "@/lib/diskCache";
import { snapshot } from "@/lib/meter";
import { hasKey, speech } from "@/lib/stepfun";

export const runtime = "nodejs";
export const maxDuration = 60;

// Server-side cache so a replay, a reload, or a second rehearsal never pays twice.
const g = globalThis as unknown as { __ttsCache?: Map<string, ArrayBuffer> };
const cache = (g.__ttsCache ??= new Map());

export async function POST(req: Request) {
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  const input = (text || "").trim().slice(0, 990);
  if (!input) return NextResponse.json({ error: "Empty text" }, { status: 400 });
  if (!hasKey()) return NextResponse.json({ error: "no-key" }, { status: 503 });

  try {
    let audio = cache.get(input);
    if (!audio) {
      const disk = readCache("tts", input, "mp3");
      audio = disk
        ? (disk.buffer.slice(disk.byteOffset, disk.byteOffset + disk.byteLength) as ArrayBuffer)
        : await speech(input);
      if (!disk) writeCache("tts", input, "mp3", Buffer.from(audio));
      cache.set(input, audio);
    }
    const m = snapshot();
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "X-Meter": JSON.stringify(m),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[tts] failed:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

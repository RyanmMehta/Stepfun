import { NextResponse } from "next/server";
import { SIMPLIFY_TIMEOUT_MS } from "@/lib/config";
import { readCache, writeCache } from "@/lib/diskCache";
import { parseLesson, PROMPT_VERSION, SIMPLIFY_SYSTEM } from "@/lib/lesson";
import { snapshot } from "@/lib/meter";
import { SAMPLE_LESSON, SAMPLE_TRANSCRIPT } from "@/lib/sample";
import { chat, hasKey } from "@/lib/stepfun";
import type { Lesson } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

// Same transcript twice costs nothing the second time (memory, then disk).
const g = globalThis as unknown as { __lessonCache?: Map<string, Lesson> };
const cache = (g.__lessonCache ??= new Map());

export async function POST(req: Request) {
  const { transcript } = (await req.json().catch(() => ({}))) as { transcript?: string };
  const text = (transcript || "").trim();
  if (!text) return NextResponse.json({ error: "Empty transcript" }, { status: 400 });

  const isSample = text === SAMPLE_TRANSCRIPT;
  const demo = (reason: string) =>
    NextResponse.json({ lesson: SAMPLE_LESSON, demo: true, reason, meter: snapshot() });

  if (!hasKey()) {
    if (isSample) return demo("no-key");
    return NextResponse.json({ error: "STEPFUN_API_KEY missing", meter: snapshot() }, { status: 503 });
  }

  const key = `${PROMPT_VERSION}:${text}`;
  let hit = cache.get(key);
  if (!hit) {
    const disk = await readCache("lessons", key, "json");
    if (disk) {
      hit = JSON.parse(disk.toString()) as Lesson;
      cache.set(key, hit);
    }
  }
  if (hit) return NextResponse.json({ lesson: hit, demo: false, cached: true, meter: snapshot() });

  let lastErr = "";
  for (let i = 0; i < 2; i++) {
    try {
      const { content } = await chat({
        system: SIMPLIFY_SYSTEM,
        user: `Lecture transcript:\n"""${text.slice(0, 12000)}"""`,
        // Low reasoning keeps the rewrite fast; the generous token cap leaves room for the JSON after reasoning.
        effort: "low",
        json: true,
        maxTokens: 12000,
        timeoutMs: SIMPLIFY_TIMEOUT_MS[i],
        retry: false,
      });
      const lesson = parseLesson(content);
      cache.set(key, lesson);
      await writeCache("lessons", key, "json", JSON.stringify(lesson));
      return NextResponse.json({ lesson, demo: false, meter: snapshot() });
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      console.warn(`[simplify] attempt ${i + 1} failed:`, lastErr);
    }
  }

  if (isSample) return demo("failed");
  return NextResponse.json({ error: `Rewrite failed: ${lastErr}`, meter: snapshot() }, { status: 502 });
}

import { NextResponse } from "next/server";
import { SAMPLE_BUDGET_MS, SIMPLIFY_BUDGET_MS } from "@/lib/config";
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

type Result = Record<string, unknown>;

export async function POST(req: Request) {
  const { transcript } = (await req.json().catch(() => ({}))) as { transcript?: string };
  const text = (transcript || "").trim();
  if (!text) return NextResponse.json({ error: "Empty transcript" }, { status: 400 });

  const isSample = text === SAMPLE_TRANSCRIPT;
  const demo = (reason: string): Result => ({ lesson: SAMPLE_LESSON, demo: true, reason, meter: snapshot() });

  if (!hasKey()) {
    if (isSample) return NextResponse.json(demo("no-key"));
    return NextResponse.json({ error: "STEPFUN_API_KEY missing", meter: snapshot() }, { status: 503 });
  }

  const key = `${PROMPT_VERSION}:${text}`;
  let hit = cache.get(key);
  if (!hit) {
    const disk = readCache("lessons", key, "json");
    if (disk) {
      try {
        hit = JSON.parse(disk.toString()) as Lesson;
        cache.set(key, hit);
      } catch {}
    }
  }
  if (hit) return NextResponse.json({ lesson: hit, demo: false, cached: true, meter: snapshot() });

  // The model call can take close to a minute. Stream a space every few seconds so no proxy, CDN or
  // browser treats the quiet connection as dead, then send the JSON body (leading whitespace is valid JSON).
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const beat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(" "));
        } catch {}
      }, 5_000);
      let result: Result;
      try {
        result = await rewrite(text, key, isSample ? SAMPLE_BUDGET_MS : SIMPLIFY_BUDGET_MS);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        result = isSample ? demo("failed") : { error: `Rewrite failed: ${msg}`, meter: snapshot() };
      } finally {
        clearInterval(beat);
      }
      try {
        controller.enqueue(encoder.encode(JSON.stringify(result)));
        controller.close();
      } catch {}
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

async function rewrite(text: string, key: string, budgetMs: number): Promise<Result> {
  const deadline = Date.now() + budgetMs;
  let lastErr = "";
  // Low reasoning effort: medium often burned the whole token budget thinking (empty answer, then a retry),
  // which is what made the Rewrite step hang for minutes. Retry once only if there is real time left.
  for (let i = 0; i < 2; i++) {
    const left = deadline - Date.now();
    if (left < 15_000) break;
    try {
      const { content } = await chat({
        system: SIMPLIFY_SYSTEM,
        user: `Lecture transcript:\n"""${text.slice(0, 12000)}"""`,
        effort: "low",
        json: true,
        maxTokens: 8000,
        timeoutMs: left,
        retries: 0,
      });
      const lesson = parseLesson(content);
      cache.set(key, lesson);
      writeCache("lessons", key, "json", JSON.stringify(lesson));
      return { lesson, demo: false, meter: snapshot() };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      console.warn(`[simplify] attempt ${i + 1} failed:`, lastErr);
    }
  }
  throw new Error(lastErr || "timed out");
}

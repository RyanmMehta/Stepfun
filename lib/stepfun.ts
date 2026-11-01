import "server-only";
import { MODELS, TIMEOUT_MS, TTS_VOICE } from "./config";
import { recordAsr, recordChat, recordTts } from "./meter";

// The one place that talks to StepFun. Server-side only: the key never reaches the browser.

export const DEFAULT_BASE_URL = "https://api.stepfun.ai/v1";
const FALLBACK_BASE_URL = "https://api.stepfun.ai/step_plan/v1";

export function hasKey() {
  return Boolean(process.env.STEPFUN_API_KEY?.trim());
}

let activeBase = process.env.STEPFUN_BASE_URL?.trim() || DEFAULT_BASE_URL;

export class StepFunError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

async function request(path: string, init: RequestInit, timeoutMs = TIMEOUT_MS): Promise<Response> {
  const key = process.env.STEPFUN_API_KEY?.trim();
  if (!key) throw new StepFunError("STEPFUN_API_KEY is not set", 0);

  const attempt = async (base: string) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(`${base}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${key}`, ...(init.headers || {}) },
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  let lastErr: unknown;
  // One retry on 5xx or network/timeout errors.
  for (let i = 0; i < 2; i++) {
    try {
      let res = await attempt(activeBase);
      if (res.status === 401 && activeBase === DEFAULT_BASE_URL) {
        const alt = await attempt(FALLBACK_BASE_URL);
        if (alt.ok) {
          console.log(`[stepfun] 401 on ${DEFAULT_BASE_URL}; switched to ${FALLBACK_BASE_URL}`);
          activeBase = FALLBACK_BASE_URL;
          res = alt;
        }
      }
      if (res.status >= 500 && i === 0) {
        lastErr = new StepFunError(`StepFun ${res.status}`, res.status);
        continue;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new StepFunError(`StepFun ${res.status}: ${body.slice(0, 300)}`, res.status);
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (e instanceof StepFunError && e.status && e.status < 500) throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new StepFunError(String(lastErr));
}

type ChatOpts = {
  system: string;
  user: string;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
  timeoutMs?: number;
  json?: boolean;
};

export async function chat({ system, user, effort = "low", maxTokens = 4000, timeoutMs, json }: ChatOpts) {
  const res = await request(
    "/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODELS.reasoning,
        reasoning_effort: effort,
        max_tokens: maxTokens,
        ...(json ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    },
    timeoutMs,
  );
  const j = await res.json();
  const u = j.usage || {};
  recordChat(u.prompt_tokens || 0, u.completion_tokens || 0);
  const content: string = j.choices?.[0]?.message?.content ?? "";
  return { content, usage: u };
}

export async function speech(text: string): Promise<ArrayBuffer> {
  const res = await request("/audio/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODELS.tts,
      voice: TTS_VOICE,
      input: text,
      response_format: "mp3",
    }),
  });
  const buf = await res.arrayBuffer();
  recordTts(text.length);
  return buf;
}

export async function transcribe(file: Blob, filename: string, approxSeconds: number) {
  let lastErr: unknown;
  for (const model of MODELS.asr) {
    try {
      const form = new FormData();
      form.append("model", model);
      form.append("response_format", "json");
      form.append("file", file, filename);
      const res = await request("/audio/transcriptions", { method: "POST", body: form }, 60_000);
      const j = await res.json();
      recordAsr(approxSeconds);
      return { text: String(j.text || "").trim(), model };
    } catch (e) {
      lastErr = e;
      console.warn(`[stepfun] ASR ${model} failed:`, e instanceof Error ? e.message : e);
    }
  }
  throw lastErr instanceof Error ? lastErr : new StepFunError("ASR failed");
}

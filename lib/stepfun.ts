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

async function request(
  path: string,
  init: RequestInit,
  timeoutMs = TIMEOUT_MS,
  retries = 1,
): Promise<Response> {
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
  // Retry on 5xx or network errors (callers with a tight time budget pass retries = 0).
  for (let i = 0; i <= retries; i++) {
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
      if (res.status >= 500 && i < retries) {
        lastErr = new StepFunError(`StepFun ${res.status}`, res.status);
        continue;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new StepFunError(`StepFun ${res.status}: ${body.slice(0, 300)}`, res.status);
      }
      return res;
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        // A timeout means the model is slow, not flaky: retrying the same call just doubles the wait.
        throw new StepFunError(`StepFun timed out after ${Math.round(timeoutMs / 1000)}s`, 504);
      }
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
  retries?: number;
  json?: boolean;
};

export async function chat({ system, user, effort = "low", maxTokens = 4000, timeoutMs, retries, json }: ChatOpts) {
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
    retries,
  );
  const j = await res.json();
  const u = j.usage || {};
  recordChat(u.prompt_tokens || 0, u.completion_tokens || 0);
  const choice = j.choices?.[0];
  const content: string = choice?.message?.content ?? "";
  if (!content.trim()) {
    // Reasoning models can spend the whole token budget thinking and return no answer.
    throw new StepFunError(`Model returned no answer (finish_reason: ${choice?.finish_reason ?? "unknown"})`, 502);
  }
  return { content, usage: u, finishReason: choice?.finish_reason as string | undefined };
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

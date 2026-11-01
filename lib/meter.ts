import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BUDGET_USD, PRICES } from "./config";
import type { Meter } from "./types";

// Running total of real StepFun spend, persisted to .cache/meter.json so restarts don't reset it.
const FILE = path.join(process.cwd(), ".cache", "meter.json");

function load(): Meter {
  const fresh = { calls: 0, tokens: 0, ttsChars: 0, asrSeconds: 0, spendUsd: 0, budgetUsd: BUDGET_USD };
  try {
    return { ...fresh, ...JSON.parse(readFileSync(FILE, "utf8")), budgetUsd: BUDGET_USD };
  } catch {
    return fresh;
  }
}

function save() {
  try {
    mkdirSync(path.dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(meter));
  } catch {}
}

const g = globalThis as unknown as { __secondEarMeter?: Meter };
const meter: Meter = (g.__secondEarMeter ??= load());

export function recordChat(promptTokens: number, completionTokens: number) {
  meter.calls += 1;
  meter.tokens += promptTokens + completionTokens;
  meter.spendUsd +=
    (promptTokens / 1e6) * PRICES.chatInputPerMTok +
    (completionTokens / 1e6) * PRICES.chatOutputPerMTok;
  save();
}

export function recordTts(chars: number) {
  meter.calls += 1;
  meter.ttsChars += chars;
  meter.spendUsd += (chars / 1000) * PRICES.ttsPer1kChars;
  save();
}

export function recordAsr(seconds: number) {
  meter.calls += 1;
  meter.asrSeconds += seconds;
  meter.spendUsd += (seconds / 60) * PRICES.asrPerMinute;
  save();
}

export function snapshot(): Meter {
  return { ...meter };
}

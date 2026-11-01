// All model IDs and price assumptions live here so they are easy to audit.

export const MODELS = {
  // Lecture transcription. Primary first, fallback second (both verified live on /v1/models).
  asr: ["stepaudio-3-asr-max", "stepaudio-2.5-asr"],
  // Plain-English rewrite, glossary, key points, quiz.
  reasoning: "step-3.7-flash",
  // Slowed voice re-delivery and term pronunciation.
  tts: "stepaudio-3-tts",
} as const;

export const TTS_VOICE = "elegantgentle-female";

export const BUDGET_USD = 25;

// Price ASSUMPTIONS (USD) used only for the on-screen cost meter estimate.
// Check platform.stepfun.ai pricing and adjust; nothing else depends on these.
export const PRICES = {
  chatInputPerMTok: 0.2, // step-3.7-flash, per 1M input tokens
  chatOutputPerMTok: 0.8, // step-3.7-flash, per 1M output tokens (incl. reasoning)
  ttsPer1kChars: 0.015, // stepaudio-3-tts, per 1,000 input characters
  asrPerMinute: 0.006, // StepAudio ASR, per audio minute
};

export const TIMEOUT_MS = 30_000;
// The JSON rewrite with medium reasoning can run longer than a single TTS line.
export const SIMPLIFY_TIMEOUT_MS = 90_000;

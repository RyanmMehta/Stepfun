import type { Lesson } from "./types";

// Defensive parsing of the model's JSON: strip fences / stray prose, then validate the shape.
export function parseLesson(raw: string): Lesson {
  let s = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model output");
  s = s.slice(start, end + 1);
  let j;
  try {
    j = JSON.parse(s);
  } catch {
    // Common model slips: trailing commas, smart quotes around keys.
    j = JSON.parse(s.replace(/,\s*([\]}])/g, "$1").replace(/[“”]/g, '"'));
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const sentences = Array.isArray(j.sentences) ? j.sentences.map(str).filter(Boolean) : [];
  const glossary = Array.isArray(j.glossary)
    ? j.glossary
        .map((g: Record<string, unknown>) => ({
          term: str(g?.term),
          simple_meaning: str(g?.simple_meaning),
          example_sentence: str(g?.example_sentence),
        }))
        .filter((g: { term: string; simple_meaning: string }) => g.term && g.simple_meaning)
    : [];
  const key_points = Array.isArray(j.key_points) ? j.key_points.map(str).filter(Boolean) : [];
  const quiz = Array.isArray(j.quiz)
    ? j.quiz
        .map((q: Record<string, unknown>) => ({
          question: str(q?.question),
          options: Array.isArray(q?.options) ? (q.options as unknown[]).map(str) : [],
          correct_index: Number(q?.correct_index),
          why: str(q?.why),
          term: str(q?.term) || undefined,
        }))
        .filter(
          (q: { question: string; options: string[]; correct_index: number }) =>
            q.question &&
            q.options.length === 4 &&
            Number.isInteger(q.correct_index) &&
            q.correct_index >= 0 &&
            q.correct_index < 4,
        )
        .slice(0, 3)
    : [];

  if (sentences.length < 2) throw new Error("Model returned too few sentences");
  if (quiz.length < 1) throw new Error("Model returned no valid quiz questions");
  return { sentences, glossary: glossary.slice(0, 8), key_points: key_points.slice(0, 5), quiz };
}

export const PROMPT_VERSION = "v2";

export const SIMPLIFY_SYSTEM = `You help international university students who are strong in their subject but are still learning English. They lose lectures to fast speech and unfamiliar vocabulary.

You receive a raw lecture transcript. Re-deliver it so the student can absorb it when it is read aloud slowly.

Return ONLY a JSON object, no markdown fences, no commentary, with exactly these keys:
{
  "sentences": string[],   // the whole lecture re-delivered in plain English. Short sentences (max ~14 words), one idea per sentence, same meaning. Use words an intermediate (B1) English learner knows. Avoid idioms and phrasal verbs. If a technical term is essential, keep it and explain it in simple words in the same or next sentence. Keep every number and fact. Write numbers as digits. Drop filler ("okay so", "you know"). Do NOT summarize away content.
  "glossary": [{"term": string, "simple_meaning": string, "example_sentence": string}],  // the 5 to 8 hardest terms from the ORIGINAL transcript, as the professor said them. simple_meaning under 20 words.
  "key_points": string[],  // 3 to 5 one-line takeaways
  "quiz": [{"question": string, "options": [string,string,string,string], "correct_index": 0|1|2|3, "why": string, "term": string}]  // exactly 3 questions testing understanding of the lecture's meaning (not trivia). Plausible wrong options. "why" explains the answer in one or two simple sentences. "term" is the glossary term the question depends on most.
}`;

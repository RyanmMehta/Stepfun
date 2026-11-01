"use client";

import { useState } from "react";
import type { GlossaryItem, QuizItem } from "@/lib/types";

export default function Quiz({
  quiz,
  glossary,
  onStart,
}: {
  quiz: QuizItem[];
  glossary: GlossaryItem[];
  onStart: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const done = results.length === quiz.length && picked === null;

  const q = quiz[idx];

  function choose(i: number) {
    if (picked !== null) return;
    if (results.length === 0) onStart();
    setPicked(i);
    setResults((r) => [...r, i === q.correct_index]);
  }

  function next() {
    setPicked(null);
    if (idx < quiz.length - 1) setIdx(idx + 1);
  }

  if (done) {
    const score = results.filter(Boolean).length;
    const missed = quiz.filter((_, i) => !results[i]).map((x) => x.term).filter(Boolean) as string[];
    // Fill to two terms with the hardest glossary terms the student hasn't already been pointed to.
    const review = [...new Set([...missed, ...glossary.map((g) => g.term)])].slice(0, 2);
    return (
      <div className="rounded-2xl bg-ink text-paper p-6 sm:p-8">
        <div className="text-4xl sm:text-5xl font-bold">
          You understood {score} of {quiz.length}.
        </div>
        <p className="mt-4 text-xl text-paper/85">
          {missed.length ? "The terms to review: " : "Terms worth one more listen: "}
          {review.map((t, i) => (
            <span key={t}>
              <strong className="text-amber">{t}</strong>
              {i < review.length - 1 ? " and " : "."}
            </span>
          ))}
        </p>
        <button
          onClick={() => {
            setIdx(0);
            setPicked(null);
            setResults([]);
          }}
          className="mt-6 rounded-full border border-paper/30 px-5 py-2.5 text-lg hover:bg-paper/10"
        >
          Try again
        </button>
      </div>
    );
  }

  const answered = picked !== null;
  const right = answered && picked === q.correct_index;

  return (
    <div className="rounded-2xl bg-white border border-line p-5 sm:p-7">
      <div className="text-sm text-muted">
        Question {idx + 1} of {quiz.length}
      </div>
      <h3 className="mt-2 text-2xl font-bold leading-snug">{q.question}</h3>
      <div className="mt-5 grid gap-3">
        {q.options.map((o, i) => {
          const isRight = i === q.correct_index;
          const isPicked = i === picked;
          return (
            <button
              key={i}
              onClick={() => choose(i)}
              disabled={answered}
              className={`rounded-xl border-2 px-4 py-3 text-left text-lg sm:text-xl transition ${
                !answered
                  ? "border-line hover:border-ink/40"
                  : isRight
                    ? "border-green-600 bg-green-50"
                    : isPicked
                      ? "border-red-500 bg-red-50"
                      : "border-line opacity-60"
              }`}
            >
              <span className="font-bold mr-2">{"ABCD"[i]}.</span>
              {o}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className={`mt-5 rounded-xl p-4 text-lg ${right ? "bg-green-50" : "bg-red-50"}`}>
          <strong>{right ? "Right. " : "Not quite. "}</strong>
          {q.why}
        </div>
      )}
      {answered && (
        <button
          onClick={next}
          className="mt-5 rounded-full bg-ink text-paper px-6 py-3 text-lg font-semibold"
        >
          {idx < quiz.length - 1 ? "Next question →" : "See my score"}
        </button>
      )}
    </div>
  );
}

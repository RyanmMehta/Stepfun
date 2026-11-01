"use client";

import { useState } from "react";
import type { GlossaryItem, QuizItem } from "@/lib/types";
import { ArrowIcon, CheckIcon, RetryIcon, XIcon } from "./icons";

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
    const pct = score / quiz.length;
    const C = 2 * Math.PI * 42;
    return (
      <div className="rise relative overflow-hidden rounded-3xl bg-ink text-paper p-6 sm:p-8 shadow-[var(--shadow-lift)]">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-amber/15 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="relative h-28 w-28 shrink-0">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgb(247 243 236 / 0.12)" strokeWidth="9" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="var(--color-amber)"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - pct)}
                className="transition-[stroke-dashoffset] duration-1000 ease-out"
                style={{ animation: "rise 0.8s ease-out both" }}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center text-3xl font-bold">
              {score}/{quiz.length}
            </div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-bold leading-tight">
              {pct === 1 ? "You got all of it." : `You understood ${score} of ${quiz.length}.`}
            </div>
            <p className="mt-3 text-lg sm:text-xl text-paper/80">
              {missed.length ? "Terms to review: " : "Worth one more listen: "}
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
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-paper/30 px-5 py-2 text-lg transition hover:bg-paper/10 hover:border-paper/50"
            >
              <RetryIcon /> Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const answered = picked !== null;
  const right = answered && picked === q.correct_index;

  return (
    <div className="rounded-3xl bg-card border border-line p-5 sm:p-7 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted">
          Question {idx + 1} of {quiz.length}
        </span>
        <div className="ml-auto flex gap-1.5" aria-hidden="true">
          {quiz.map((_, i) => (
            <span
              key={i}
              className={`h-2 w-8 rounded-full transition-colors duration-300 ${
                i < results.length ? (results[i] ? "bg-good" : "bg-bad") : i === idx ? "bg-amber" : "bg-line"
              }`}
            />
          ))}
        </div>
      </div>
      <div key={idx} className="rise">
        <h3 className="mt-3 text-2xl font-bold leading-snug">{q.question}</h3>
        <div className="mt-5 grid gap-3">
          {q.options.map((o, i) => {
            const isRight = i === q.correct_index;
            const isPicked = i === picked;
            return (
              <button
                key={i}
                onClick={() => choose(i)}
                disabled={answered}
                className={`group flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-lg sm:text-xl transition-all duration-200 ${
                  !answered
                    ? "border-line bg-paper/50 hover:border-ink/40 hover:bg-card hover:-translate-y-px"
                    : isRight
                      ? "pop border-good bg-good-soft"
                      : isPicked
                        ? "shake border-bad bg-bad-soft"
                        : "border-line opacity-50"
                }`}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold transition ${
                    answered && isRight
                      ? "bg-good text-white"
                      : answered && isPicked
                        ? "bg-bad text-white"
                        : "bg-card border border-line group-hover:border-ink/40"
                  }`}
                >
                  {answered && isRight ? <CheckIcon /> : answered && isPicked ? <XIcon /> : "ABCD"[i]}
                </span>
                <span>{o}</span>
              </button>
            );
          })}
        </div>
        {answered && (
          <div
            className={`rise mt-5 rounded-2xl border-l-4 p-4 text-lg ${
              right ? "border-good bg-good-soft" : "border-bad bg-bad-soft"
            }`}
          >
            <strong className={right ? "text-good" : "text-bad"}>{right ? "Right. " : "Not quite. "}</strong>
            {q.why}
          </div>
        )}
        {answered && (
          <button
            onClick={next}
            className="rise mt-5 inline-flex items-center gap-2 rounded-full bg-ink text-paper px-6 py-3 text-lg font-bold shadow-[var(--shadow-soft)] transition hover:-translate-y-px active:scale-[0.97]"
          >
            {idx < quiz.length - 1 ? "Next question" : "See my score"}
            <ArrowIcon />
          </button>
        )}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SAMPLE_LESSON, SAMPLE_TITLE, SAMPLE_TRANSCRIPT } from "@/lib/sample";
import type { Lesson, Meter } from "@/lib/types";
import { audioDuration, MAX_SECONDS, startRecording } from "./Recorder";
import { useVoice } from "./useVoice";
import Quiz from "./Quiz";

type Phase = "input" | "recording" | "transcribing" | "simplifying" | "ready";
type Source = { kind: "sample" | "upload" | "record"; title: string; audioUrl?: string };

const STEP_LABEL: Partial<Record<Phase, string>> = {
  transcribing: "Transcribing the lecture",
  simplifying: "Rewriting in plain English",
};

export default function SecondEar() {
  const [live, setLive] = useState<boolean | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [meter, setMeter] = useState<Meter | null>(null);
  const [phase, setPhase] = useState<Phase>("input");
  const [source, setSource] = useState<Source | null>(null);
  const [transcript, setTranscript] = useState("");
  const [asrNote, setAsrNote] = useState("");
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [error, setError] = useState("");
  const [rate, setRate] = useState(0.75);
  const [recSeconds, setRecSeconds] = useState(0);
  const [openTerm, setOpenTerm] = useState<number | null>(null);
  const [quizStarted, setQuizStarted] = useState(false);
  const recRef = useRef<Awaited<ReturnType<typeof startRecording>> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const originalRef = useRef<HTMLAudioElement>(null);
  const understandRef = useRef<HTMLElement>(null);
  const checkRef = useRef<HTMLElement>(null);

  const onMeter = useCallback((m: Meter) => setMeter(m), []);
  const voice = useVoice(onMeter);

  // Keep the sentence being read on screen, especially on a phone.
  const currentLine = voice.current;
  useEffect(() => {
    if (currentLine === null || currentLine < 0) return;
    document
      .querySelector(`[data-line="${currentLine}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentLine]);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((j) => {
        setLive(j.live);
        setMeter(j.meter);
        if (!j.live) setDemoMode(true);
      })
      .catch(() => {
        setLive(false);
        setDemoMode(true);
      });
  }, []);

  const reset = () => {
    voice.stop();
    setPhase("input");
    setSource(null);
    setTranscript("");
    setLesson(null);
    setError("");
    setAsrNote("");
    setOpenTerm(null);
    setQuizStarted(false);
  };

  async function simplify(text: string) {
    setPhase("simplifying");
    try {
      const res = await fetch("/api/simplify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text }),
      });
      const j = await res.json();
      if (j.meter) setMeter(j.meter);
      if (!res.ok) throw new Error(j.error || "Rewrite failed");
      if (j.demo) setDemoMode(true);
      setLesson(j.lesson);
      setPhase("ready");
      // Warm the first two lines so Listen starts instantly.
      j.lesson.sentences.slice(0, 2).forEach((s: string) => voice.prefetch(s));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("input");
    }
  }

  async function loadSample() {
    reset();
    setSource({ kind: "sample", title: SAMPLE_TITLE });
    setTranscript(SAMPLE_TRANSCRIPT);
    if (live === false) {
      setDemoMode(true);
      setLesson(SAMPLE_LESSON);
      setPhase("ready");
      return;
    }
    await simplify(SAMPLE_TRANSCRIPT);
  }

  async function transcribeBlob(blob: Blob, filename: string, seconds: number, browserFallback = "") {
    setPhase("transcribing");
    setError("");
    try {
      if (live === false) throw new Error("no-key");
      const form = new FormData();
      form.append("file", blob, filename);
      form.append("seconds", String(Math.round(seconds)));
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const j = await res.json();
      if (j.meter) setMeter(j.meter);
      if (!res.ok) throw new Error(j.error || "Transcription failed");
      setTranscript(j.text);
      setAsrNote(`Transcribed by StepFun ${j.model}`);
      await simplify(j.text);
    } catch (e) {
      if (browserFallback) {
        setTranscript(browserFallback);
        setAsrNote("StepFun ASR unavailable: using your browser's speech recognition");
        if (live === false) {
          setError("Demo mode: add STEPFUN_API_KEY to rewrite your own audio. Try the sample lecture.");
          setPhase("input");
          return;
        }
        await simplify(browserFallback);
        return;
      }
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        msg === "no-key"
          ? "Demo mode: add STEPFUN_API_KEY to transcribe your own audio. The sample lecture works now."
          : `Couldn't transcribe that clip (${msg}). Try another clip or the sample lecture.`,
      );
      setPhase("input");
    }
  }

  async function onUpload(file: File) {
    reset();
    const seconds = await audioDuration(file);
    if (seconds > MAX_SECONDS + 30) {
      setError("That clip is longer than 3 minutes. Trim it to the part you missed and try again.");
      return;
    }
    const url = URL.createObjectURL(file);
    setSource({ kind: "upload", title: file.name, audioUrl: url });
    await transcribeBlob(file, file.name, seconds);
  }

  async function startRec() {
    reset();
    setError("");
    try {
      setRecSeconds(0);
      recRef.current = await startRecording(setRecSeconds, () => stopRec());
      setPhase("recording");
    } catch {
      setError("Microphone blocked. Allow mic access in your browser, or upload a file instead.");
    }
  }

  async function stopRec() {
    const r = recRef.current;
    if (!r) return;
    recRef.current = null;
    const rec = await r.stop();
    const url = URL.createObjectURL(rec.blob);
    setSource({ kind: "record", title: `Recording · ${fmt(rec.seconds)}`, audioUrl: url });
    await transcribeBlob(rec.blob, `recording.${rec.ext}`, rec.seconds, rec.browserTranscript);
  }

  function playOriginal() {
    voice.stop();
    if (source?.audioUrl && originalRef.current) {
      originalRef.current.currentTime = 0;
      originalRef.current.play().catch(() => {});
    } else {
      // The sample has no recording: read the professor's version at lecture speed for contrast.
      // StepFun TTS takes under 1,000 characters per call, so read it sentence by sentence, without pauses.
      const chunks = transcript.match(/[^.?!]+[.?!]+/g) ?? [transcript];
      voice.playAll(chunks.map((c) => c.trim()), 0, 1.15, false);
    }
  }

  const busy = phase === "transcribing" || phase === "simplifying";
  const stage = quizStarted ? 3 : lesson ? 2 : 1;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 bg-paper/95 backdrop-blur border-b border-line">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex items-center gap-4 flex-wrap">
          <button onClick={reset} className="flex items-baseline gap-2 text-left" aria-label="Start over">
            <span className="text-2xl font-bold tracking-tight">Second Ear</span>
            <span className="hidden sm:inline text-muted text-base">lectures, at a pace you can absorb</span>
          </button>
          <ol className="ml-auto flex gap-1 sm:gap-2 text-sm sm:text-base">
            {[
              { n: 1, label: "Hear", ref: null },
              { n: 2, label: "Understand", ref: understandRef },
              { n: 3, label: "Check", ref: checkRef },
            ].map((s) => (
              <li key={s.n}>
                <button
                  disabled={s.n > 1 && !lesson}
                  onClick={() =>
                    s.ref?.current
                      ? s.ref.current.scrollIntoView({ behavior: "smooth", block: "start" })
                      : window.scrollTo({ top: 0, behavior: "smooth" })
                  }
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 border transition ${
                    stage === s.n
                      ? "bg-ink text-paper border-ink"
                      : stage > s.n
                        ? "border-ink/30 text-ink"
                        : "border-line text-muted"
                  } disabled:cursor-default`}
                >
                  <span className="font-bold">{stage > s.n ? "✓" : s.n}</span>
                  <span>{s.label}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
        {demoMode && (
          <div className="bg-amber-soft border-t border-amber/40 text-ink text-sm sm:text-base">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 py-2">
              <strong>Demo mode:</strong> add STEPFUN_API_KEY to go live. Running on the built-in sample lecture.
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 sm:py-10 space-y-12">
        {/* ---------------- 1 HEAR ---------------- */}
        <section aria-labelledby="hear">
          <StageTitle id="hear" n={1} title="Hear" sub="Bring the part of the lecture you lost." />

          {!lesson && !busy && (
            <div className="grid gap-3 sm:grid-cols-3">
              <BigButton
                primary
                onClick={loadSample}
                title="Try the sample lecture"
                sub="Statistics · interaction terms · 75 sec, fast"
                disabled={phase === "recording"}
              />
              <BigButton
                onClick={() => fileRef.current?.click()}
                title="Upload a clip"
                sub="mp3, wav, m4a, webm · up to 3 min"
                disabled={phase === "recording"}
              />
              {phase === "recording" ? (
                <button
                  onClick={stopRec}
                  className="rounded-2xl border-2 border-red-600 bg-red-50 p-5 text-left min-h-28"
                >
                  <div className="flex items-center gap-2 text-xl font-bold text-red-700">
                    <span className="h-3 w-3 rounded-full bg-red-600 animate-pulse" />
                    Stop · {fmt(recSeconds)}
                  </div>
                  <div className="text-muted mt-1">Recording. Max {fmt(MAX_SECONDS)}.</div>
                </button>
              ) : (
                <BigButton onClick={startRec} title="Record now" sub="Hold your phone up to the speaker" />
              )}
              <input
                ref={fileRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.webm"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) onUpload(f);
                }}
              />
            </div>
          )}

          {error && (
            <p role="alert" className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-800">
              {error}
            </p>
          )}

          {busy && <Loading label={STEP_LABEL[phase]!} transcript={phase === "simplifying" ? transcript : ""} />}

          {lesson && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
              {/* What you heard */}
              <div className="rounded-2xl bg-ink text-paper p-5 sm:p-6 self-start">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-paper/60">What you heard</div>
                    <div className="text-sm text-paper/80 mt-0.5">{source?.title}</div>
                  </div>
                  <button
                    onClick={playOriginal}
                    className="shrink-0 rounded-full border border-paper/30 px-3 py-1.5 text-sm hover:bg-paper/10"
                  >
                    ▶ Original speed
                  </button>
                </div>
                <p className="mt-4 max-h-56 overflow-y-auto lg:max-h-none text-base sm:text-lg leading-relaxed text-paper/90">{transcript}</p>
                {asrNote && <p className="mt-3 text-xs text-paper/50">{asrNote}</p>}
                {source?.audioUrl && <audio ref={originalRef} src={source.audioUrl} className="hidden" />}
              </div>

              {/* Plain English, read aloud */}
              <div className="rounded-2xl bg-white border border-line p-5 sm:p-7 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="mr-auto">
                    <div className="text-xs uppercase tracking-widest text-muted">Plain English</div>
                    <div className="text-sm text-muted mt-0.5">Short sentences. Tap any line to hear it again.</div>
                  </div>
                  <div className="flex rounded-full border border-line p-1" role="group" aria-label="Speed">
                    {[0.75, 1].map((r) => (
                      <button
                        key={r}
                        onClick={() => setRate(r)}
                        className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                          rate === r ? "bg-ink text-paper" : "text-muted"
                        }`}
                      >
                        {r}x
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() =>
                      voice.playing ? voice.stop() : voice.playAll(lesson.sentences, 0, rate)
                    }
                    className="rounded-full bg-amber px-5 py-3 text-lg font-bold text-ink shadow-sm hover:brightness-95 min-w-36"
                  >
                    {voice.preparing ? "Preparing the voice…" : voice.playing ? "■ Stop" : "▶ Listen"}
                  </button>
                </div>
                {voice.fallback && (
                  <p className="mt-3 text-sm text-muted">Using your device&apos;s voice while StepFun TTS is unavailable.</p>
                )}
                <ol className="mt-5 space-y-1">
                  {lesson.sentences.map((s, i) => (
                    <li key={i}>
                      <button
                        data-line={i}
                        onClick={() => voice.playOnly(s, rate, i)}
                        className={`w-full text-left rounded-xl px-3 py-2 text-xl sm:text-2xl leading-snug transition ${
                          voice.current === i
                            ? "bg-amber-soft ring-2 ring-amber text-ink"
                            : voice.current !== null && voice.current >= 0
                              ? "text-ink/45 hover:bg-paper"
                              : "text-ink hover:bg-paper"
                        }`}
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </section>

        {/* ---------------- 2 UNDERSTAND ---------------- */}
        {lesson && (
          <section ref={understandRef} aria-labelledby="understand" className="scroll-mt-28">
            <StageTitle id="understand" n={2} title="Understand" sub="The words that made it hard, in simple English." />
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <div className="rounded-2xl bg-white border border-line p-5 sm:p-7">
                <div className="text-xs uppercase tracking-widest text-muted mb-3">Glossary · tap a term</div>
                <div className="flex flex-wrap gap-2">
                  {lesson.glossary.map((g, i) => (
                    <button
                      key={g.term}
                      onClick={() => setOpenTerm(openTerm === i ? null : i)}
                      className={`rounded-full border px-4 py-2 text-lg ${
                        openTerm === i ? "bg-ink text-paper border-ink" : "border-line hover:border-ink/40"
                      }`}
                    >
                      {g.term}
                    </button>
                  ))}
                </div>
                {openTerm !== null && lesson.glossary[openTerm] && (
                  <div className="mt-5 rounded-xl bg-paper p-5">
                    <div className="flex items-center gap-3">
                      <h3 className="text-2xl font-bold">{lesson.glossary[openTerm].term}</h3>
                      <button
                        onClick={() => voice.playOnly(lesson.glossary[openTerm].term, 0.85, -2)}
                        className="rounded-full border border-line bg-white px-3 py-1.5 text-sm"
                        aria-label={`Pronounce ${lesson.glossary[openTerm].term}`}
                      >
                        🔊 Say it
                      </button>
                    </div>
                    <p className="mt-2 text-xl leading-relaxed">{lesson.glossary[openTerm].simple_meaning}</p>
                    <p className="mt-3 text-lg text-muted italic">“{lesson.glossary[openTerm].example_sentence}”</p>
                  </div>
                )}
              </div>
              <div className="rounded-2xl bg-white border border-line p-5 sm:p-7 self-start">
                <div className="text-xs uppercase tracking-widest text-muted mb-3">Key points</div>
                <ul className="space-y-3">
                  {lesson.key_points.map((k, i) => (
                    <li key={i} className="flex gap-3 text-lg leading-snug">
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-amber" />
                      {k}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* ---------------- 3 CHECK ---------------- */}
        {lesson && (
          <section ref={checkRef} aria-labelledby="check" className="scroll-mt-28">
            <StageTitle id="check" n={3} title="Check" sub="Prove you got it, instead of hoping you did." />
            <Quiz
              key={lesson.quiz.map((q) => q.question).join("|")}
              quiz={lesson.quiz}
              glossary={lesson.glossary}
              onStart={() => setQuizStarted(true)}
            />
          </section>
        )}
      </main>

      <CostFooter meter={meter} live={live} demo={demoMode} />
    </div>
  );
}

function StageTitle({ id, n, title, sub }: { id: string; n: number; title: string; sub: string }) {
  return (
    <div className="mb-5 flex items-baseline gap-3">
      <span className="text-amber-dark font-bold text-xl">{n}</span>
      <div>
        <h2 id={id} className="text-3xl font-bold tracking-tight">
          {title}
        </h2>
        <p className="text-muted text-lg">{sub}</p>
      </div>
    </div>
  );
}

function BigButton(props: { title: string; sub: string; onClick: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      className={`rounded-2xl p-5 text-left min-h-28 border-2 transition disabled:opacity-40 ${
        props.primary ? "bg-amber border-amber hover:brightness-95" : "bg-white border-line hover:border-ink/40"
      }`}
    >
      <div className="text-xl font-bold">{props.title}</div>
      <div className={props.primary ? "text-ink/75 mt-1" : "text-muted mt-1"}>{props.sub}</div>
    </button>
  );
}

const STEP_HINT: Record<string, string> = {
  "Transcribing the lecture": "StepAudio ASR is listening to your clip.",
  "Rewriting in plain English":
    "step-3.7-flash is reasoning through the lecture: rewriting it, picking the hard words, writing your check. Usually 30 to 60 seconds.",
};

function Loading({ label, transcript }: { label: string; transcript: string }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    setSecs(0);
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [label]);
  return (
    <div className="rounded-2xl bg-white border border-line p-6 sm:p-8" aria-live="polite">
      <div className="flex items-center gap-3 text-2xl font-semibold">
        <span className="flex gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-amber animate-bounce [animation-delay:-0.3s]" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber animate-bounce [animation-delay:-0.15s]" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber animate-bounce" />
        </span>
        {label}…
        <span className="ml-auto text-base font-normal text-muted tabular-nums">{secs}s</span>
      </div>
      <p className="mt-2 text-muted">{STEP_HINT[label]}</p>
      {transcript && (
        <div className="mt-5">
          <div className="text-xs uppercase tracking-widest text-muted">What you heard</div>
          <p className="mt-2 text-lg leading-relaxed text-ink/70">{transcript}</p>
        </div>
      )}
    </div>
  );
}

function CostFooter({ meter, live, demo }: { meter: Meter | null; live: boolean | null; demo: boolean }) {
  const remaining = meter ? Math.max(0, meter.budgetUsd - meter.spendUsd) : null;
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 text-sm text-muted flex flex-wrap gap-x-5 gap-y-1">
        <span className="font-semibold text-ink">
          StepFun {live ? (demo ? "· demo fallback" : "· live") : live === false ? "· demo mode" : ""}
        </span>
        {meter && (
          <>
            <span>{meter.calls} calls</span>
            <span>{meter.tokens.toLocaleString()} tokens</span>
            <span>{meter.ttsChars.toLocaleString()} chars voiced</span>
            <span>est. ${meter.spendUsd.toFixed(4)} spent</span>
            <span>${remaining!.toFixed(2)} of ${meter.budgetUsd} left</span>
          </>
        )}
      </div>
    </footer>
  );
}

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

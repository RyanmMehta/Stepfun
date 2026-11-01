"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SAMPLE_LESSON, SAMPLE_TITLE, SAMPLE_TRANSCRIPT } from "@/lib/sample";
import type { Lesson, Meter } from "@/lib/types";
import { audioDuration, MAX_SECONDS, startRecording } from "./Recorder";
import { useVoice } from "./useVoice";
import Quiz from "./Quiz";
import { ArrowIcon, Bars, BookIcon, CheckIcon, ListIcon, Mark, MicIcon, PlayIcon, SparkIcon, SpeakerIcon, StopIcon, UploadIcon } from "./icons";

type Phase = "input" | "recording" | "transcribing" | "simplifying" | "ready";
type Source = { kind: "sample" | "upload" | "record"; title: string; audioUrl?: string };

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
  const landing = !lesson && !busy;
  const reading = voice.current !== null && voice.current >= 0;
  const progress = lesson && reading ? ((voice.current! + 1) / lesson.sentences.length) * 100 : 0;
  const term = openTerm !== null ? lesson?.glossary[openTerm] : undefined;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 bg-paper/80 backdrop-blur-md border-b border-line/80">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex items-center gap-2">
          <button onClick={reset} className="flex items-center gap-2.5 text-left" aria-label="Start over">
            <Mark className="h-7 w-7 sm:h-9 sm:w-9 shrink-0" />
            <span className="text-lg sm:text-2xl font-bold tracking-tight whitespace-nowrap">Second Ear</span>
          </button>
          <ol className="ml-auto flex items-center text-sm sm:text-base" aria-label="Progress">
            {[
              { n: 1, label: "Hear", ref: null },
              { n: 2, label: "Understand", ref: understandRef },
              { n: 3, label: "Check", ref: checkRef },
            ].map((s, i) => (
              <li key={s.n} className="flex items-center">
                {i > 0 && (
                  <span
                    className={`mx-0.5 sm:mx-2 h-px w-2 sm:w-6 transition-colors duration-500 ${
                      stage >= s.n ? "bg-ink/50" : "bg-line"
                    }`}
                  />
                )}
                <button
                  disabled={s.n > 1 && !lesson}
                  onClick={() =>
                    s.ref?.current
                      ? s.ref.current.scrollIntoView({ behavior: "smooth", block: "start" })
                      : window.scrollTo({ top: 0, behavior: "smooth" })
                  }
                  aria-current={stage === s.n ? "step" : undefined}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1.5 border transition-all duration-300 ${
                    stage === s.n
                      ? "bg-ink text-paper border-ink shadow-[var(--shadow-soft)]"
                      : stage > s.n
                        ? "border-ink/25 bg-card text-ink hover:border-ink/50"
                        : "border-line text-muted"
                  } disabled:cursor-default`}
                >
                  <span
                    className={`grid h-5 w-5 place-items-center rounded-full text-xs font-bold ${
                      stage === s.n ? "bg-amber text-ink" : stage > s.n ? "bg-good text-white" : "bg-line/70"
                    }`}
                  >
                    {stage > s.n ? <CheckIcon className="text-[0.8rem]" /> : s.n}
                  </span>
                  <span className={stage === s.n ? "" : "hidden sm:inline"}>{s.label}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
        {demoMode && (
          <div className="bg-amber-soft/90 border-t border-amber/40 text-ink text-sm">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 py-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-dark" />
              <span>
                <strong>Demo mode.</strong> Running on the built-in sample lecture with canned results.
              </span>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-8 sm:py-12 space-y-16">
        {/* ---------------- 1 HEAR ---------------- */}
        <section aria-labelledby="hear">
          {landing ? (
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center">
              <div className="rise">
                <div className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-sm text-muted shadow-[var(--shadow-soft)]">
                  <SparkIcon className="text-amber-dark" />
                  Built with StepFun audio + reasoning models
                </div>
                <h1 id="hear" className="mt-5 text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight leading-[1.05]">
                  Missed the lecture?
                  <br />
                  <span className="box-decoration-clone bg-[linear-gradient(transparent_64%,rgb(245_184_65/0.5)_64%,rgb(245_184_65/0.5)_92%,transparent_92%)]">
                    Hear it again, slower.
                  </span>
                </h1>
                <p className="mt-5 max-w-xl text-lg sm:text-xl text-muted">
                  Second Ear re-delivers a fast lecture in plain English, one idea per line, read aloud at a pace you
                  can follow. Then it checks that you got it.
                </p>

                <div className="mt-8 grid grid-cols-2 gap-3 max-w-xl">
                  <BigButton
                    primary
                    wide
                    icon={<PlayIcon />}
                    onClick={loadSample}
                    title="Try the sample lecture"
                    sub="Statistics · interaction terms · 75 seconds, fast"
                    disabled={phase === "recording"}
                  />
                  <BigButton
                    icon={<UploadIcon />}
                    onClick={() => fileRef.current?.click()}
                    title="Upload a clip"
                    sub="mp3, wav, m4a · up to 3 min"
                    disabled={phase === "recording"}
                  />
                  {phase === "recording" ? (
                    <button
                      onClick={stopRec}
                      className="rise rounded-2xl border-2 border-bad bg-bad-soft p-4 text-left min-h-36 flex flex-col"
                    >
                      <span className="rec-ring grid h-10 w-10 place-items-center rounded-full bg-bad text-white">
                        <StopIcon />
                      </span>
                      <span className="mt-auto pt-3 text-lg font-bold text-bad tabular-nums">Stop · {fmt(recSeconds)}</span>
                      <span className="text-sm text-muted">Max {fmt(MAX_SECONDS)}</span>
                    </button>
                  ) : (
                    <BigButton icon={<MicIcon />} onClick={startRec} title="Record now" sub="Hold your phone to the speaker" />
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
              </div>

              <HeroVisual />
            </div>
          ) : (
            <StageTitle id="hear" n={1} title="Hear" sub="The lecture, rewritten and read aloud at your pace." />
          )}

          {error && (
            <p role="alert" className="rise shake mt-6 rounded-xl border border-bad/30 bg-bad-soft px-4 py-3 text-bad">
              {error}
            </p>
          )}

          {busy && <Loading phase={phase} transcript={phase === "simplifying" ? transcript : ""} />}

          {lesson && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
              {/* What you heard */}
              <div className="rise relative overflow-hidden rounded-3xl bg-ink text-paper p-5 sm:p-6 self-start shadow-[var(--shadow-lift)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-amber/90">What you heard</div>
                    <div className="text-sm text-paper/70 mt-1">{source?.title}</div>
                  </div>
                  <button
                    onClick={playOriginal}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-paper/25 px-3 py-1.5 text-sm transition hover:bg-paper/10 hover:border-paper/50"
                  >
                    {voice.current === -1 ? <Bars className="text-amber" /> : <PlayIcon className="text-xs" />}
                    Original speed
                  </button>
                </div>
                <div className="mt-4 h-8 overflow-hidden opacity-70" aria-hidden="true">
                  <Wave fast className={voice.current === -1 ? "wave-scroll" : ""} />
                </div>
                <p className="mt-3 max-h-56 overflow-y-auto lg:max-h-none text-base sm:text-[1.05rem] leading-relaxed text-paper/80">
                  {transcript}
                </p>
                {asrNote && <p className="mt-3 text-xs text-paper/50">{asrNote}</p>}
                {source?.audioUrl && <audio ref={originalRef} src={source.audioUrl} className="hidden" />}
              </div>

              {/* Plain English, read aloud */}
              <div
                className="rise rounded-3xl bg-card border border-line p-5 sm:p-7 shadow-[var(--shadow-soft)]"
                style={{ animationDelay: "80ms" }}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="mr-auto">
                    <div className="text-xs uppercase tracking-[0.18em] text-amber-dark font-bold">Plain English</div>
                    <div className="text-sm text-muted mt-1">Tap any line to hear it again.</div>
                  </div>
                  <div className="flex rounded-full border border-line bg-paper p-1" role="group" aria-label="Speed">
                    {[0.75, 1].map((r) => (
                      <button
                        key={r}
                        onClick={() => setRate(r)}
                        aria-pressed={rate === r}
                        className={`rounded-full px-3 py-1 text-sm font-bold transition ${
                          rate === r ? "bg-ink text-paper shadow-sm" : "text-muted hover:text-ink"
                        }`}
                      >
                        {r}x
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => (voice.playing ? voice.stop() : voice.playAll(lesson.sentences, 0, rate))}
                    className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-lg font-bold shadow-[var(--shadow-soft)] transition active:scale-[0.97] min-w-36 ${
                      voice.playing ? "bg-ink text-paper" : "bg-amber text-ink hover:brightness-105 hover:-translate-y-px"
                    }`}
                  >
                    {voice.preparing ? (
                      <>
                        <Bars /> Preparing…
                      </>
                    ) : voice.playing ? (
                      <>
                        <Bars className="text-amber" /> Stop
                      </>
                    ) : (
                      <>
                        <PlayIcon /> Listen
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-4 h-1 rounded-full bg-line/70 overflow-hidden" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-amber transition-[width] duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {voice.fallback && (
                  <p className="mt-3 text-sm text-muted">Using your device&apos;s voice while StepFun TTS is unavailable.</p>
                )}
                <ol className="mt-4 space-y-1">
                  {lesson.sentences.map((s, i) => {
                    const on = voice.current === i;
                    return (
                      <li key={i} className="rise" style={{ animationDelay: `${120 + i * 45}ms` }}>
                        <button
                          data-line={i}
                          onClick={() => voice.playOnly(s, rate, i)}
                          className={`group w-full flex gap-3 text-left rounded-2xl px-3 py-2.5 text-xl sm:text-2xl leading-snug transition-all duration-300 ${
                            on
                              ? "bg-amber-soft text-ink shadow-[inset_0_0_0_2px_var(--color-amber)] translate-x-1"
                              : reading
                                ? "text-ink/40 hover:text-ink/70 hover:bg-paper"
                                : "text-ink hover:bg-paper"
                          }`}
                        >
                          <span
                            className={`mt-1.5 w-5 shrink-0 text-sm tabular-nums transition ${
                              on ? "text-amber-dark" : "text-muted/60 group-hover:text-muted"
                            }`}
                          >
                            {on ? <Bars className="text-base" /> : i + 1}
                          </span>
                          <span>{s}</span>
                        </button>
                      </li>
                    );
                  })}
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
              <div className="rounded-3xl bg-card border border-line p-5 sm:p-7 shadow-[var(--shadow-soft)]">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-amber-dark font-bold mb-4">
                  <BookIcon className="text-base" /> Glossary · tap a term
                </div>
                <div className="flex flex-wrap gap-2">
                  {lesson.glossary.map((g, i) => (
                    <button
                      key={g.term}
                      onClick={() => setOpenTerm(openTerm === i ? null : i)}
                      aria-expanded={openTerm === i}
                      className={`rounded-full border px-4 py-1.5 text-lg transition-all duration-200 active:scale-95 ${
                        openTerm === i
                          ? "bg-ink text-paper border-ink shadow-[var(--shadow-soft)]"
                          : "bg-paper border-line hover:border-ink/40 hover:-translate-y-px"
                      }`}
                    >
                      {g.term}
                    </button>
                  ))}
                </div>
                {term ? (
                  <div key={openTerm} className="rise mt-5 rounded-2xl bg-paper border border-line/70 p-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-2xl font-bold">{term.term}</h3>
                      <button
                        onClick={() => voice.playOnly(term.term, 0.85, -2)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1 text-sm transition hover:border-ink/40"
                        aria-label={`Pronounce ${term.term}`}
                      >
                        {voice.current === -2 ? <Bars className="text-amber-dark" /> : <SpeakerIcon />}
                        Say it
                      </button>
                    </div>
                    <p className="mt-2 text-xl leading-relaxed">{term.simple_meaning}</p>
                    <p className="mt-3 border-l-4 border-amber pl-4 text-lg text-muted italic">
                      {term.example_sentence}
                    </p>
                  </div>
                ) : (
                  <p className="mt-5 rounded-2xl border border-dashed border-line px-5 py-6 text-muted">
                    Pick a term to see what it means, hear how it&apos;s said, and see it used in a sentence.
                  </p>
                )}
              </div>
              <div className="rounded-3xl bg-card border border-line p-5 sm:p-7 self-start shadow-[var(--shadow-soft)]">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-amber-dark font-bold mb-4">
                  <ListIcon className="text-base" /> Key points
                </div>
                <ul className="space-y-4">
                  {lesson.key_points.map((k, i) => (
                    <li key={i} className="flex gap-3 text-lg leading-snug">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-soft text-sm font-bold text-amber-dark">
                        {i + 1}
                      </span>
                      <span className="pt-0.5">{k}</span>
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
    <div className="mb-6 flex items-center gap-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ink text-lg font-bold text-amber">
        {n}
      </span>
      <div>
        <h2 id={id} className="text-3xl font-bold tracking-tight leading-tight">
          {title}
        </h2>
        <p className="text-muted text-lg leading-snug">{sub}</p>
      </div>
    </div>
  );
}

function BigButton(props: {
  title: string;
  sub: string;
  icon: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  wide?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      className={`group rounded-2xl p-4 text-left flex border-2 ${
        props.wide ? "col-span-2 items-center gap-4 sm:p-5" : "min-h-36 flex-col"
      } transition-all duration-200 disabled:opacity-40 disabled:pointer-events-none hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] ${
        props.primary
          ? "bg-amber border-amber shadow-[var(--shadow-lift)] hover:brightness-105"
          : "bg-card border-line shadow-[var(--shadow-soft)] hover:border-ink/30 hover:shadow-[var(--shadow-lift)]"
      }`}
    >
      <span
        className={`grid shrink-0 place-items-center rounded-full ${props.wide ? "h-12 w-12 text-xl" : "h-10 w-10 text-lg"} transition-transform duration-200 group-hover:scale-110 ${
          props.primary ? "bg-ink text-amber" : "bg-paper text-ink"
        }`}
      >
        {props.icon}
      </span>
      <span className={props.wide ? "min-w-0" : "mt-auto pt-3"}>
        <span className={`block font-bold leading-tight ${props.wide ? "text-xl" : "text-lg"}`}>{props.title}</span>
        <span className={`block text-sm mt-0.5 ${props.primary ? "text-ink/70" : "text-muted"}`}>{props.sub}</span>
      </span>
      {props.wide && (
        <ArrowIcon className="ml-auto text-xl transition-transform duration-200 group-hover:translate-x-1" />
      )}
    </button>
  );
}

// Two copies of the path side by side so translateX(-50%) loops seamlessly.
function Wave({ fast, className = "" }: { fast?: boolean; className?: string }) {
  const W = 400;
  const pts: string[] = [];
  for (let x = 0; x <= W; x += 4) {
    const y = fast
      ? 20 + Math.sin(x * 0.21) * 9 * Math.sin(x * 0.045) + Math.sin(x * 0.63) * 6 * Math.cos(x * 0.03)
      : 20 + Math.sin((x / W) * Math.PI * 4) * 8;
    pts.push(`${x},${y.toFixed(1)}`);
  }
  const d = `M${pts.join(" L")}`;
  return (
    <svg viewBox={`0 0 ${W * 2} 40`} preserveAspectRatio="none" className={`h-full w-[200%] ${className}`}>
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
        <path d={d} />
        <path d={d} transform={`translate(${W} 0)`} />
      </g>
    </svg>
  );
}

function HeroVisual() {
  return (
    <div className="rise relative" style={{ animationDelay: "120ms" }} aria-hidden="true">
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-amber/15 blur-2xl" />
      <div className="rounded-3xl bg-ink p-5 sm:p-6 text-paper shadow-[var(--shadow-lift)]">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="uppercase tracking-[0.18em] text-paper/60">In the lecture hall</span>
          <span className="whitespace-nowrap rounded-full bg-bad/80 px-2.5 py-0.5 text-white">180 wpm</span>
        </div>
        <div className="mt-3 h-12 overflow-hidden text-paper/50">
          <Wave fast className="wave-scroll" />
        </div>
        <p className="mt-2 text-sm leading-relaxed text-paper/55 line-clamp-2">
          &ldquo;…because we&apos;ve included the interaction term, that three point one is the return to experience
          only for the baseline group…&rdquo;
        </p>
      </div>

      <div className="relative z-10 -mt-4 mx-auto grid h-11 w-11 place-items-center rounded-full border-4 border-paper bg-amber text-ink shadow-[var(--shadow-soft)]">
        <ArrowIcon className="rotate-90" />
      </div>

      <div className="-mt-4 rounded-3xl border border-line bg-card p-5 sm:p-6 shadow-[var(--shadow-lift)]">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="uppercase tracking-[0.18em] font-bold text-amber-dark">With Second Ear</span>
          <span className="whitespace-nowrap rounded-full bg-good-soft px-2.5 py-0.5 font-bold text-good">0.75x · one idea per line</span>
        </div>
        <div className="mt-3 h-10 overflow-hidden text-amber">
          <Wave className="wave-scroll-slow" />
        </div>
        <ul className="mt-2 space-y-1.5 text-lg leading-snug">
          <li className="rounded-xl bg-amber-soft px-3 py-1.5 shadow-[inset_0_0_0_2px_var(--color-amber)]">
            Each extra year of experience adds $3,100.
          </li>
          <li className="px-3 text-ink/45">But only for the baseline group: men.</li>
        </ul>
      </div>
    </div>
  );
}

const STEPS: { phase: Phase; label: string; hint: string }[] = [
  { phase: "transcribing", label: "Transcribe", hint: "StepAudio ASR is listening to your clip." },
  {
    phase: "simplifying",
    label: "Rewrite",
    hint: "step-3.7-flash is rewriting the lecture, picking the hard words, and writing your check. Usually 30 to 60 seconds.",
  },
  { phase: "ready", label: "Listen", hint: "" },
];

function Loading({ phase, transcript }: { phase: Phase; transcript: string }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    setSecs(0);
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);
  const at = STEPS.findIndex((s) => s.phase === phase);
  return (
    <div className="rise mt-2 rounded-3xl bg-card border border-line p-6 sm:p-8 shadow-[var(--shadow-soft)]" aria-live="polite">
      <ol className="flex items-center gap-2 text-sm">
        {STEPS.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2">
            {i > 0 && <span className={`h-px w-6 sm:w-10 ${i <= at ? "bg-ink/50" : "bg-line"}`} />}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${
                i < at ? "bg-good-soft text-good" : i === at ? "bg-ink text-paper" : "bg-paper text-muted"
              }`}
            >
              {i < at ? <CheckIcon /> : i === at ? <Bars className="text-amber" /> : null}
              {s.label}
            </span>
          </li>
        ))}
        <span className="ml-auto text-muted tabular-nums">{secs}s</span>
      </ol>
      <p className="mt-5 text-xl font-bold">{STEPS[at]?.hint}</p>
      <div className="mt-6 space-y-3" aria-hidden="true">
        {[92, 78, 85, 60].map((w, i) => (
          <div key={i} className="skeleton h-6 rounded-lg" style={{ width: `${w}%` }} />
        ))}
      </div>
      {transcript && (
        <div className="mt-6 rounded-2xl bg-paper p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-muted">What you heard</div>
          <p className="mt-2 leading-relaxed text-ink/60">{transcript}</p>
        </div>
      )}
    </div>
  );
}

function CostFooter({ meter, live, demo }: { meter: Meter | null; live: boolean | null; demo: boolean }) {
  const remaining = meter ? Math.max(0, meter.budgetUsd - meter.spendUsd) : null;
  const status = live ? (demo ? "Demo fallback" : "Live") : live === false ? "Demo mode" : "Connecting";
  return (
    <footer className="border-t border-line bg-paper/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 text-sm text-muted flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-card border border-line px-3 py-1 font-bold text-ink">
          <span className={`h-2 w-2 rounded-full ${live && !demo ? "bg-good" : "bg-amber-dark"}`} />
          StepFun · {status}
        </span>
        {meter && (
          <>
            <Chip>{meter.calls} calls</Chip>
            <Chip>{meter.tokens.toLocaleString()} tokens</Chip>
            <Chip>{meter.ttsChars.toLocaleString()} chars voiced</Chip>
            <Chip>est. ${meter.spendUsd.toFixed(4)}</Chip>
            <Chip>
              ${remaining!.toFixed(2)} of ${meter.budgetUsd} left
            </Chip>
          </>
        )}
      </div>
    </footer>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full px-2.5 py-1 tabular-nums">{children}</span>;
}

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

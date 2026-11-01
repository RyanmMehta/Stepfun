# Second Ear

**A transcript moves the problem from listening to reading. Second Ear re-delivers the lecture at a pace an international student can actually absorb, then checks they understood it.**

Built for the StepFun × NYU PMC Case Jam, Track 2: Build with StepFun.

## The problem

International and ESL students lose lectures in real time to two things: unfamiliar accents and fast speech. In research on international students, 42% named native-accented speech as the biggest factor hurting their listening comprehension and 36% named fast speech rate. Existing tools hand them a transcript, which turns fast listening in a second language into fast reading in a second language.

**Target user:** an international undergraduate in a US lecture course, strong in their subject, losing marks only to listening speed and vocabulary in weeks 1 to 8 of their first semester abroad.

## What it does

Second Ear takes a short lecture clip (upload, record, or the built-in sample) and moves the student through three stages:

1. **Hear.** StepAudio ASR transcribes the clip ("What you heard"). step-3.7-flash rewrites it into short plain-English sentences, one idea per line. StepFun TTS reads them aloud at 0.75x or 1x while the current line lights up amber. Tap any line to replay just that line. "Original speed" plays the professor's version for contrast.
2. **Understand.** A glossary of the 5 to 8 hardest terms as tappable chips, each with a simple meaning, an example sentence, and a pronunciation button (TTS). Plus 3 to 5 key points.
3. **Check.** Three comprehension questions, one at a time, with instant right/wrong and an explanation. It ends with a score and the terms to review.

A cost meter in the footer shows StepFun calls, tokens, characters voiced, estimated spend, and budget left.

## Run it

```bash
npm install
cp .env.local.example .env.local   # then put your key in STEPFUN_API_KEY
npm run dev                        # http://localhost:3000
```

Optional connectivity check (one tiny step-3.7-flash call):

```bash
node scripts/test-stepfun.mjs
```

Click **Try the sample lecture** for the stage demo. With no API key, the whole app still runs end to end on the sample in **Demo mode** (canned transcript, rewrite, and quiz; the browser's voice reads it aloud).

## StepFun model roles

| Model | Role in Second Ear | Endpoint |
|---|---|---|
| `stepaudio-3-asr-max` (fallback `stepaudio-2.5-asr`) | Lecture transcription: audio in | `POST /v1/audio/transcriptions` |
| `step-3.7-flash`, `reasoning_effort: medium` | Plain-English re-delivery, glossary, key points, comprehension quiz (strict JSON) | `POST /v1/chat/completions` |
| `stepaudio-3-tts` (voice `elegantgentle-female`) | Slowed sentence-by-sentence voice re-delivery and term pronunciation: audio out | `POST /v1/audio/speech` |

All calls go through one server-side helper (`lib/stepfun.ts`): 30 s timeouts (90 s for the reasoning rewrite), one retry on 5xx, automatic fallback to the `step_plan` base URL only on a 401, token usage captured for the meter. The key never reaches the browser.

## Reliability

- **Demo mode:** no key, or the rewrite fails twice on the sample → canned sample lesson with a visible banner.
- **TTS fails** → the browser's `speechSynthesis` reads the lines, so Listen never dies.
- **ASR fails on a recording** → the transcript captured by the browser's Web Speech API during recording (Chromium) is used instead.
- **Caching:** every rewrite and every voiced sentence is cached in memory and on disk (`.cache/`), so replays, reloads, and the stage demo after rehearsal cost nothing and load instantly.
- Price assumptions for the meter live in one object in `lib/config.ts`.

## Judging map

| Rubric line (weight) | What answers it |
|---|---|
| Problem significance and real-world impact (20%) | A specific user (first-semester international students) and a measured problem (42% accent, 36% speed). Transcripts don't fix it. |
| Meaningful use of StepFun models (25%) | Three StepFun models in the core loop: audio in (StepAudio ASR), reasoning (step-3.7-flash builds the rewrite, glossary, and quiz), audio out (stepaudio-3-tts re-delivers and pronounces). Take StepFun out and nothing is left. |
| Technical execution and functionality (20%) | Upload, record, and sample inputs. Server-side helper with timeouts, retry, and defensive JSON parsing. Layered fallbacks, disk cache, live cost meter. `npm run build` passes. |
| Innovation and product experience (15%) | Re-delivery, not summary. Follow-along voice with a highlighted line, tap-to-replay, glossary pronunciation, and a comprehension check at the end. Laid out as a listening room, not a chat window. |
| Presentation and demo (10%) | One-tap sample built for the stage, `DEMO_SCRIPT.md`, cached for an instant demo. |
| Overall potential (10%) | Every international student at every English-medium university. Next: live lecture mode. |

## Future work

- **Live lecture mode** with realtime StepAudio (`stepaudio-3-realtime-preview`): re-deliver each minute of the lecture as it happens.
- **Personal vocabulary:** remember the terms each student keeps missing and pre-teach them before the next lecture.
- **Professor mode:** show which terms a whole class stumbled on, so the instructor can re-explain them next session.

## Project layout

```
app/api/transcribe   StepAudio ASR
app/api/simplify     step-3.7-flash rewrite + glossary + quiz (JSON)
app/api/tts          stepaudio-3-tts, cached
app/api/status       live/demo + meter
lib/stepfun.ts       the one StepFun helper
lib/sample.ts        sample lecture + canned lesson for Demo mode
components/          UI (SecondEar, Quiz, useVoice, Recorder)
```

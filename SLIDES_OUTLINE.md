# Second Ear: slide outline (6 slides)

## 1. The problem
- Title: **International students lose lectures to accent and speed, not to the subject.**
- 42% of international students name native-accented speech as the biggest factor hurting their listening comprehension.
- 36% name fast speech rate.
- User: a first-semester international undergrad in a US lecture course. Strong in the subject, losing marks to listening speed and vocabulary in weeks 1 to 8.

## 2. The gap
- Title: **A transcript isn't comprehension.**
- Existing tools (captions, Otter-style transcripts) turn fast listening in a second language into fast reading in a second language.
- Nothing re-delivers the lecture at a pace the student can absorb.
- Nothing checks that they understood it.

## 3. The product
- Title: **Hear. Understand. Check.**
- Hear: the original transcript next to a plain-English re-delivery, read aloud slowly with the current line highlighted. Tap any line to replay it.
- Understand: glossary chips with simple meaning, example, and pronunciation, plus key points.
- Check: a 3-question comprehension check, ending in a score and the terms to review.
- Visual: one screenshot of the Hear stage mid-playback (amber line highlighted).

## 4. StepFun inside
- Title: **Audio in, reasoning, audio out: all StepFun.**

| Model | Role |
|---|---|
| StepAudio ASR (`stepaudio-3-asr-max`) | Transcribes the lecture clip |
| `step-3.7-flash` (medium reasoning) | Plain-English rewrite, glossary, key points, quiz as strict JSON |
| `stepaudio-3-tts` | Slow sentence-by-sentence voice, term pronunciation |

- Cost per lecture segment: take the number from the footer meter after one full run on the sample (under $0.01 in testing).
- Caching means a replay costs $0.

## 5. Why it isn't a generic AI wrapper
- **Re-delivery, not summary:** every fact and number is kept, one idea per sentence.
- **Follow-along voice:** audio and text in sync, at 0.75x, with tap-to-replay per sentence.
- **Pronunciation:** the student hears the word they'll need to say in office hours.
- **Proof of comprehension:** the quiz closes the loop that transcripts leave open.
- Built as a listening room, not a chat box. Every StepFun model is in the core loop.

## 6. Market and next
- Over 1 million international students in the US, and millions more at English-medium universities worldwide. Every one of them sits in lectures.
- Next: **live lecture mode** with realtime StepAudio, per-student vocabulary that adapts to the terms they keep missing, and **professor mode** showing which terms a whole class stumbled on.
- Ask: StepFun credits to pilot with NYU's international student cohort.

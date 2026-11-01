"use client";

// MediaRecorder capture (webm on Chrome/Firefox, mp4 on Safari) plus an optional
// Web Speech API transcript recorded alongside, used only if StepFun ASR fails.

export const MAX_SECONDS = 180;

type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function pickMime(): { mime: string; ext: string } {
  const options = [
    { mime: "audio/webm;codecs=opus", ext: "webm" },
    { mime: "audio/webm", ext: "webm" },
    { mime: "audio/mp4", ext: "m4a" },
    { mime: "audio/ogg;codecs=opus", ext: "ogg" },
  ];
  if (typeof MediaRecorder !== "undefined") {
    for (const o of options) if (MediaRecorder.isTypeSupported?.(o.mime)) return o;
  }
  return { mime: "", ext: "webm" };
}

export type Recording = { blob: Blob; ext: string; seconds: number; browserTranscript: string };

export async function startRecording(onTick: (s: number) => void, onAutoStop: () => void) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const { mime, ext } = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  // Browser speech recognition only on Chromium desktop/Android, where it coexists with MediaRecorder.
  let browserText = "";
  let sr: SpeechRec | null = null;
  const w = window as unknown as { webkitSpeechRecognition?: new () => SpeechRec; SpeechRecognition?: new () => SpeechRec; chrome?: unknown };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (Ctor && w.chrome && !isIOS) {
    try {
      sr = new Ctor();
      sr.continuous = true;
      sr.interimResults = false;
      sr.lang = "en-US";
      sr.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) browserText += e.results[i][0].transcript + " ";
        }
      };
      sr.onerror = () => {};
      sr.start();
    } catch {
      sr = null;
    }
  }

  const started = Date.now();
  rec.start(1000);
  const timer = setInterval(() => {
    const s = Math.floor((Date.now() - started) / 1000);
    onTick(s);
    if (s >= MAX_SECONDS) onAutoStop();
  }, 250);

  const stop = () =>
    new Promise<Recording>((resolve) => {
      clearInterval(timer);
      try {
        sr?.stop();
      } catch {}
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        resolve({
          blob: new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" }),
          ext,
          seconds: Math.max(1, Math.round((Date.now() - started) / 1000)),
          browserTranscript: browserText.trim(),
        });
      };
      if (rec.state !== "inactive") rec.stop();
    });

  return { stop };
}

export function audioDuration(file: Blob): Promise<number> {
  return new Promise((resolve) => {
    const a = document.createElement("audio");
    const url = URL.createObjectURL(file);
    a.preload = "metadata";
    a.onloadedmetadata = () => {
      const d = isFinite(a.duration) ? a.duration : 60;
      URL.revokeObjectURL(url);
      resolve(d);
    };
    a.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(60);
    };
    a.src = url;
  });
}

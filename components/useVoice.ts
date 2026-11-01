"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Meter } from "@/lib/types";

// Plays text through StepFun TTS (via /api/tts), one sentence at a time, with an in-memory cache.
// If TTS fails, it falls back to the browser's speechSynthesis so Listen never dies on stage.
export function useVoice(onMeter: (m: Meter) => void) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urls = useRef(new Map<string, string>());
  const inflight = useRef(new Map<string, Promise<string | null>>());
  const runId = useRef(0);
  const [fallback, setFallback] = useState(false);
  const fallbackRef = useRef(false);
  const [current, setCurrent] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const onMeterRef = useRef(onMeter);
  onMeterRef.current = onMeter;

  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.preload = "auto";
    const map = urls.current;
    return () => {
      audioRef.current?.pause();
      map.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const fetchUrl = useCallback((text: string): Promise<string | null> => {
    const hit = urls.current.get(text);
    if (hit) return Promise.resolve(hit);
    if (fallbackRef.current) return Promise.resolve(null);
    const pending = inflight.current.get(text);
    if (pending) return pending;
    const p = (async () => {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) throw new Error(`tts ${res.status}`);
        const meter = res.headers.get("X-Meter");
        if (meter) onMeterRef.current(JSON.parse(meter));
        const url = URL.createObjectURL(await res.blob());
        urls.current.set(text, url);
        return url;
      } catch {
        fallbackRef.current = true;
        setFallback(true);
        return null;
      } finally {
        inflight.current.delete(text);
      }
    })();
    inflight.current.set(text, p);
    return p;
  }, []);

  const speakOne = useCallback(
    (text: string, rate: number, id: number): Promise<void> =>
      new Promise(async (resolve) => {
        const url = await fetchUrl(text);
        if (id !== runId.current) return resolve();
        if (url && audioRef.current) {
          const a = audioRef.current;
          a.src = url;
          a.playbackRate = rate;
          (a as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
          a.onended = () => resolve();
          a.onerror = () => resolve();
          a.play().catch(() => resolve());
        } else if (typeof window !== "undefined" && "speechSynthesis" in window) {
          const u = new SpeechSynthesisUtterance(text);
          u.lang = "en-US";
          u.rate = rate < 1 ? 0.75 : 0.95;
          u.onend = () => resolve();
          u.onerror = () => resolve();
          window.speechSynthesis.speak(u);
        } else {
          resolve();
        }
      }),
    [fetchUrl],
  );

  const stop = useCallback(() => {
    runId.current += 1;
    audioRef.current?.pause();
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setPlaying(false);
    setPreparing(false);
    setCurrent(null);
  }, []);

  // Unlock audio on mobile Safari: must touch the element inside the user's tap.
  const unlock = () => {
    const a = audioRef.current;
    if (a && !a.src) a.play().catch(() => {});
  };

  const playAll = useCallback(
    async (sentences: string[], start: number, rate: number, highlight = true) => {
      unlock();
      stop();
      const id = runId.current;
      setPlaying(true);
      setPreparing(!urls.current.has(sentences[start]));
      // Warm the first two lines in parallel so playback starts quickly.
      fetchUrl(sentences[start]);
      if (sentences[start + 1]) fetchUrl(sentences[start + 1]);
      for (let i = start; i < sentences.length; i++) {
        if (id !== runId.current) return;
        await fetchUrl(sentences[i]);
        if (id !== runId.current) return;
        setPreparing(false);
        setCurrent(highlight ? i : -1);
        if (sentences[i + 1]) fetchUrl(sentences[i + 1]);
        await speakOne(sentences[i], rate, id);
        // A short breath between sentences helps a second-language listener.
        if (highlight) await new Promise((r) => setTimeout(r, rate < 1 ? 450 : 250));
      }
      if (id === runId.current) {
        setPlaying(false);
        setCurrent(null);
      }
    },
    [fetchUrl, speakOne, stop],
  );

  const playOnly = useCallback(
    async (text: string, rate: number, index: number | null = null) => {
      unlock();
      stop();
      const id = runId.current;
      setPlaying(true);
      setPreparing(!urls.current.has(text));
      await fetchUrl(text);
      if (id !== runId.current) return;
      setPreparing(false);
      setCurrent(index);
      await speakOne(text, rate, id);
      if (id === runId.current) {
        setPlaying(false);
        setCurrent(null);
      }
    },
    [fetchUrl, speakOne, stop],
  );

  return { playAll, playOnly, stop, current, playing, preparing, fallback, prefetch: fetchUrl };
}

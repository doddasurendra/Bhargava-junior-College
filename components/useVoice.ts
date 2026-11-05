'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Voice for the website assistant: speak a question (speech-to-text) and hear the answer (text-to-speech),
 * in English, Telugu or Hindi, using the browser's built-in Web Speech API — no keys, nothing sent to us
 * except the recognised text. Hidden in browsers without speech recognition (e.g. Firefox).
 */
export const VOICE_LANGS = [
  { code: 'en-IN', label: 'EN' },
  { code: 'te-IN', label: 'తె' },
  { code: 'hi-IN', label: 'हि' },
] as const;
export type VoiceLang = (typeof VOICE_LANGS)[number]['code'];

type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

export function useVoice(onText: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakOn, setSpeakOn] = useState(false);
  const [lang, setLang] = useState<VoiceLang>('en-IN');
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const cb = useRef(onText);
  cb.current = onText;

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    setCanSpeak('speechSynthesis' in window);
    return () => rec.current?.stop();
  }, []);

  const listen = useCallback(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    if (listening) {
      rec.current?.stop();
      return;
    }
    setError(null);
    const r = new Ctor();
    r.lang = lang;
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const text = Array.from(e.results).map((x) => x[0]?.transcript ?? '').join(' ').trim();
      if (text) cb.current(text);
    };
    r.onerror = (e) => setError(e.error === 'not-allowed' ? 'Allow the microphone to speak your question.' : e.error === 'no-speech' ? 'Didn’t catch that. Tap the mic and speak again.' : 'Voice input stopped.');
    r.onend = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  }, [lang, listening]);

  const speak = useCallback(
    (text: string) => {
      if (!speakOn || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/\s+/g, ' ').slice(0, 1200));
      u.lang = lang;
      const v = window.speechSynthesis.getVoices().find((x) => x.lang === lang) ?? window.speechSynthesis.getVoices().find((x) => x.lang.startsWith(lang.slice(0, 2)));
      if (v) u.voice = v;
      window.speechSynthesis.speak(u);
    },
    [lang, speakOn],
  );

  const toggleSpeak = useCallback(() => {
    setSpeakOn((on) => {
      if (on && 'speechSynthesis' in window) window.speechSynthesis.cancel();
      return !on;
    });
  }, []);

  return { supported, canSpeak, listening, speakOn, lang, setLang, error, listen, speak, toggleSpeak };
}

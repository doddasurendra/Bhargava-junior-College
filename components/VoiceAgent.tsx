'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { college } from '@/content/college';

/**
 * BJC AI Voice Agent — voice-to-voice only (no text input). Separate from the chat agent: its own endpoint
 * (/api/voice/turn), its own session (localStorage key), its own history. Speech recognition: the browser's
 * Web Speech API (Chrome, Edge, Safari, Android Chrome). Voice: Azure female neural voice via /api/voice/tts
 * when configured on the server, else the browser's female voice for that language.
 */
type Status = 'IDLE' | 'CONNECTING' | 'LISTENING' | 'PROCESSING' | 'RETRIEVING_INFORMATION' | 'SPEAKING' | 'STOPPED' | 'ERROR';
type Lang = 'en' | 'te' | 'hi';
const LOCALE: Record<Lang, string> = { en: 'en-IN', te: 'te-IN', hi: 'hi-IN' };
const LANG_LABEL: Record<Lang, string> = { en: 'English', te: 'తెలుగు', hi: 'हिंदी' };
const STATUS_TEXT: Record<Status, string> = {
  IDLE: 'Tap “Start conversation” and ask your question out loud.',
  CONNECTING: 'Connecting… please allow the microphone.',
  LISTENING: 'Listening… ask your question.',
  PROCESSING: 'Thinking…',
  RETRIEVING_INFORMATION: 'Finding verified college information…',
  SPEAKING: 'Speaking… start talking any time to interrupt.',
  STOPPED: 'Stopped. Press Start conversation to talk again.',
  ERROR: 'Something went wrong.',
};
/** Short status chip in the chosen language (the long help line stays in English as before). */
const CHIP: Record<Lang, Partial<Record<Status, string>>> = {
  en: { LISTENING: 'Listening', PROCESSING: 'Processing', RETRIEVING_INFORMATION: 'Processing', SPEAKING: 'Speaking', STOPPED: 'Stopped', IDLE: 'Ready', CONNECTING: 'Connecting', ERROR: 'Error' },
  te: { LISTENING: 'వింటోంది', PROCESSING: 'ప్రాసెస్ చేస్తోంది', RETRIEVING_INFORMATION: 'ప్రాసెస్ చేస్తోంది', SPEAKING: 'మాట్లాడుతోంది', STOPPED: 'ఆపబడింది', IDLE: 'సిద్ధం', CONNECTING: 'కనెక్ట్ అవుతోంది', ERROR: 'లోపం' },
  hi: { LISTENING: 'सुन रही है', PROCESSING: 'प्रोसेस हो रहा है', RETRIEVING_INFORMATION: 'प्रोसेस हो रहा है', SPEAKING: 'बोल रही है', STOPPED: 'रुका हुआ', IDLE: 'तैयार', CONNECTING: 'जुड़ रहा है', ERROR: 'त्रुटि' },
};
const POS_KEY = 'bjc_voice_y';
const SESSION_KEY = 'bjc_voice';
const FEMALE = /female|woman|neerja|heera|swara|shruti|kalpana|lekha|veena|zira|samantha|aditi|raveena|priya|google.*(हिन्दी|తెలుగు|india)/i;
const MALE = /\bmale\b|ravi|hemant|prabhat|madhur|mohan|david|mark|rishi|guy|george/i;

type Rec = { lang: string; continuous: boolean; interimResults: boolean; onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void; abort: () => void };

function pickFemaleVoice(lang: Lang): SpeechSynthesisVoice | null {
  const all = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis.getVoices() : [];
  const forLang = all.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith(lang === 'en' ? 'en-in' : LOCALE[lang].toLowerCase()));
  const pool = forLang.length ? forLang : all.filter((v) => v.lang.toLowerCase().startsWith(lang));
  return pool.find((v) => FEMALE.test(v.name) && !MALE.test(v.name)) ?? pool.find((v) => !MALE.test(v.name)) ?? pool[0] ?? null;
}

export function VoiceAgent({ embedded = false }: { embedded?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(embedded);
  const [status, setStatus] = useState<Status>('IDLE');
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>('en');
  const [muted, setMuted] = useState(false);
  const [heard, setHeard] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<{ label: string; href: string }[]>([]);
  const [voiceKind, setVoiceKind] = useState<'azure' | 'browser' | null>(null);
  const [supported, setSupported] = useState(true);
  const [latency, setLatency] = useState<number | null>(null);

  const active = useRef(false);
  const rec = useRef<Rec | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const speaking = useRef('');
  const turn = useRef(0);
  const inflight = useRef<AbortController | null>(null);
  const statusRef = useRef<Status>('IDLE');
  const micStream = useRef<MediaStream | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const raf = useRef<number | null>(null);
  const [level, setLevel] = useState(0);
  // vertical position (px from the top) when dragged; null = the default place near the bottom
  const [y, setY] = useState<number | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const drag = useRef<{ startY: number; startTop: number; id: number } | null>(null);
  const langRef = useRef<Lang>('en');
  const mutedRef = useRef(false);
  statusRef.current = status;
  langRef.current = lang;
  mutedRef.current = muted;

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    const htmlLang = document.documentElement.lang?.slice(0, 2);
    if (htmlLang === 'te' || htmlLang === 'hi') setLang(htmlLang);
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices(); // warm the voice list
    const offline = () => { if (active.current) fail('You are offline. Check the internet connection and start again.'); };
    window.addEventListener('offline', offline);
    return () => window.removeEventListener('offline', offline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopAudio = useCallback(() => {
    speaking.current = '';
    if (audio.current) {
      audio.current.pause();
      audio.current.src = '';
      audio.current = null;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  function fail(msg: string) {
    setError(msg);
    setStatus('ERROR');
    end(false);
  }

  /** Speak with Azure neural female voice if the server has it, else the browser's female voice. */
  async function speak(text: string, l: Lang, myTurn: number) {
    stopAudio();
    if (mutedRef.current || !text) {
      if (active.current) setStatus('LISTENING');
      return;
    }
    speaking.current = text.toLowerCase();
    setStatus('SPEAKING');
    const done = () => {
      if (turn.current !== myTurn) return;
      speaking.current = '';
      if (active.current) setStatus('LISTENING');
    };
    try {
      const res = await fetch('/api/voice/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, lang: l }) });
      if (turn.current !== myTurn) return;
      if (res.status === 200) {
        setVoiceKind('azure');
        const url = URL.createObjectURL(await res.blob());
        const a = new Audio(url);
        audio.current = a;
        a.onended = () => { URL.revokeObjectURL(url); done(); };
        a.onerror = done;
        await a.play();
        return;
      }
    } catch {
      /* fall through to the browser voice */
    }
    if (turn.current !== myTurn) return;
    setVoiceKind('browser');
    if (!('speechSynthesis' in window)) return done();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LOCALE[l];
    const v = pickFemaleVoice(l);
    if (v) u.voice = v;
    u.rate = 0.97;
    u.pitch = 1.08;
    u.onend = done;
    u.onerror = done;
    window.speechSynthesis.speak(u);
  }

  async function ask(text: string) {
    const myTurn = ++turn.current;
    inflight.current?.abort();
    const ctrl = new AbortController();
    inflight.current = ctrl;
    stopAudio();
    setHeard(text);
    setAnswer('');
    setSources([]);
    setStatus('PROCESSING');
    const t0 = performance.now();
    const retrieving = setTimeout(() => { if (turn.current === myTurn) setStatus('RETRIEVING_INFORMATION'); }, 350);
    try {
      let session: { c?: string; t?: string } = {};
      try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}'); } catch { /* ignore */ }
      const res = await fetch('/api/voice/turn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal, body: JSON.stringify({ ...session, text, lang: langRef.current }) });
      const data = await res.json().catch(() => ({}));
      clearTimeout(retrieving);
      if (turn.current !== myTurn) return; // a newer question replaced this one
      if (!res.ok) {
        if (res.status === 404 || res.status === 409) try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
        setAnswer(data.error ?? 'Sorry, I could not answer that. Please try again.');
        return void speak(data.error ?? 'Sorry, I could not answer that. Please try again.', langRef.current, myTurn);
      }
      try { localStorage.setItem(SESSION_KEY, JSON.stringify({ c: data.c, t: data.t })); } catch { /* ignore */ }
      setLatency(Math.round(performance.now() - t0));
      setAnswer(data.caption ?? data.speech);
      setSources((data.sources ?? []).slice(0, 3));
      await speak(data.speech, langRef.current, myTurn);
    } catch (e) {
      clearTimeout(retrieving);
      if ((e as Error).name === 'AbortError') return;
      if (turn.current === myTurn) fail(navigator.onLine ? 'Could not reach the assistant. Please try again.' : 'You are offline. Check the internet connection and start again.');
    }
  }

  function listen() {
    const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return fail('Voice conversations need Chrome, Edge or Safari. Please use the chat assistant instead.');
    const r = new Ctor();
    r.lang = LOCALE[langRef.current];
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const said = res[0].transcript.trim();
        if (!said) continue;
        // Barge-in: the visitor speaks while the assistant is talking → stop the audio at once.
        // Ignore the assistant's own voice picked up by the microphone (echo).
        if (statusRef.current === 'SPEAKING') {
          const echo = speaking.current && said.toLowerCase().split(/\s+/).filter((wd) => speaking.current.includes(wd)).length >= said.split(/\s+/).length * 0.6;
          if (echo) continue;
          turn.current++;
          stopAudio();
          setStatus('LISTENING');
        }
        if (res.isFinal && said.split(/\s+/).length >= 1) void ask(said);
        else setHeard(said);
      }
    };
    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') return fail('Microphone is blocked for this site. Click the icon left of the address bar → Microphone → Allow, reload the page and press Start again. On Windows also check Settings → Privacy & security → Microphone: microphone access and desktop app access must be On.');
      if (e.error === 'audio-capture') return fail('No microphone found. Connect a microphone and start again.');
      if (e.error === 'network') return fail('Speech recognition needs an internet connection. Check the connection and start again.');
      if (e.error === 'language-not-supported') return fail(`This browser can’t recognise ${LANG_LABEL[langRef.current]} speech. Try English, or use Chrome.`);
    };
    // Browsers end recognition after silence; keep listening while the conversation is on.
    r.onend = () => { if (active.current && rec.current === r) try { r.start(); } catch { /* already started */ } };
    rec.current = r;
    r.start();
  }

  /** Live microphone level for the activity meter; released by Stop / Close / leaving the page. */
  function startMeter(stream: MediaStream) {
    micStream.current = stream;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(an);
      audioCtx.current = ctx;
      const buf = new Uint8Array(an.frequencyBinCount);
      const tick = () => {
        an.getByteTimeDomainData(buf);
        let peak = 0;
        for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
        setLevel(Math.min(1, peak / 64));
        raf.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* the meter is optional */ }
  }
  function stopMeter() {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    micStream.current?.getTracks().forEach((t) => t.stop());
    micStream.current = null;
    void audioCtx.current?.close().catch(() => undefined);
    audioCtx.current = null;
    setLevel(0);
  }

  async function start() {
    // one microphone session at a time
    if (active.current || statusRef.current === 'CONNECTING') return;
    setError(null);
    setStatus('CONNECTING');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      startMeter(stream); // recognition opens its own stream; this one only drives the activity meter
    } catch (e) {
      const n = (e as Error).name;
      return fail(n === 'NotAllowedError' ? 'Microphone is blocked for this site. Click the icon left of the address bar → Microphone → Allow, reload the page and press Start again. On Windows also check Settings → Privacy & security → Microphone: microphone access and desktop app access must be On.' : n === 'NotFoundError' ? 'No microphone found. Connect a microphone and start again.' : 'Could not open the microphone.');
    }
    active.current = true;
    setStatus('LISTENING');
    listen();
  }

  /** Releases everything: recognition, microphone, pending answer, any speech playing or queued. */
  function end(resetStatus = true) {
    active.current = false;
    turn.current++;
    inflight.current?.abort();
    const r = rec.current;
    rec.current = null;
    try { r?.abort(); } catch { /* ignore */ }
    stopAudio();
    stopMeter();
    if (resetStatus) setStatus('IDLE');
  }

  /** STOP: stop listening and speaking now; captions and the conversation stay; Start again any time. */
  function stopConversation() {
    end(false);
    setStatus('STOPPED');
  }

  /** CLOSE: release the microphone and speech, close the window; the conversation history is kept. */
  function close() {
    end();
    setOpen(false);
  }

  function restart() {
    end();
    try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    setHeard('');
    setAnswer('');
    setSources([]);
    setError(null);
  }

  function changeLang(l: Lang) {
    setLang(l);
    langRef.current = l;
    if (active.current) {
      const r = rec.current;
      rec.current = null;
      try { r?.abort(); } catch { /* ignore */ }
      listen();
    }
  }

  useEffect(() => () => end(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- vertical dragging (mouse, touch and pen via pointer events; arrow keys on the header)
  const clampY = useCallback((top: number) => {
    const h = panelRef.current?.offsetHeight ?? 400;
    return Math.max(8, Math.min(top, window.innerHeight - h - 8));
  }, []);
  useEffect(() => {
    try { const v = Number(sessionStorage.getItem(POS_KEY)); if (v > 0) setY(v); } catch { /* ignore */ }
    const onResize = () => setY((cur) => (cur === null ? cur : clampY(cur)));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampY]);
  useEffect(() => { if (y !== null) try { sessionStorage.setItem(POS_KEY, String(Math.round(y))); } catch { /* ignore */ } }, [y]);
  // keep it on screen when it grows (captions appear)
  useEffect(() => { if (open && y !== null) setY((cur) => (cur === null ? cur : clampY(cur))); }, [open, heard, answer, error, clampY]); // eslint-disable-line react-hooks/exhaustive-deps

  function onDragStart(e: React.PointerEvent<HTMLElement>) {
    if (embedded || (e.target as HTMLElement).closest('button,a,select,input')) return; // controls stay clickable
    const top = panelRef.current?.getBoundingClientRect().top ?? 0;
    drag.current = { startY: e.clientY, startTop: top, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }
  function onDragMove(e: React.PointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    setY(clampY(d.startTop + (e.clientY - d.startY)));
  }
  function onDragEnd(e: React.PointerEvent<HTMLElement>) {
    if (drag.current?.id === e.pointerId) drag.current = null;
  }
  function onHeaderKey(e: React.KeyboardEvent<HTMLElement>) {
    if (embedded || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const top = panelRef.current?.getBoundingClientRect().top ?? 0;
    setY(clampY(top + (e.key === 'ArrowUp' ? -40 : 40)));
  }

  const busy = status === 'PROCESSING' || status === 'RETRIEVING_INFORMATION';
  const panel = (
    <section
      ref={panelRef}
      aria-label="BJC AI Voice Assistant"
      style={!embedded && y !== null ? { top: y, bottom: 'auto' } : undefined}
      className={`${embedded ? 'card mx-auto max-w-xl' : 'fixed bottom-36 left-4 z-50 w-[min(92vw,380px)] md:bottom-24 rounded-2xl border border-line bg-surface shadow-2xl'} overflow-hidden`}
    >
      <header
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        onKeyDown={onHeaderKey}
        tabIndex={embedded ? undefined : 0}
        aria-label={embedded ? undefined : 'Drag up or down to move the voice assistant (or use the arrow keys)'}
        className={`flex items-center gap-3 bg-navy px-4 py-3 text-white ${embedded ? '' : 'cursor-grab touch-none select-none active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-gold'}`}
      >
        {!embedded && <span aria-hidden className="-ml-1 text-white/50" title="Drag to move">⠿</span>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={college.logoSrc} alt="" width={36} height={36} draggable={false} className="h-9 w-9 rounded-full bg-white" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">BJC AI Voice Assistant</p>
          <p className="text-xs text-white/70">Voice only · {LANG_LABEL[lang]} · <span data-testid="voice-status">{CHIP[lang][status] ?? status}</span></p>
        </div>
        {!embedded && <button type="button" onClick={close} aria-label="Close voice assistant" title="Close" className="rounded-full px-2 text-lg text-white/80 hover:text-white">×</button>}
      </header>

      <div className="flex flex-col items-center gap-3 px-5 py-6 text-center">
        <div className="relative grid h-28 w-28 place-items-center">
          <span aria-hidden className={`absolute inset-0 rounded-full ${status === 'LISTENING' ? 'animate-ping bg-gold/30' : status === 'SPEAKING' ? 'animate-pulse bg-maroon/25' : busy ? 'animate-spin border-4 border-gold/40 border-t-gold' : ''}`} />
          <span aria-hidden className="relative grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-gold-100 to-white text-5xl shadow-inner dark:from-gold/30 dark:to-navy">👩‍💼</span>
        </div>
        {/* microphone activity */}
        <div className="flex h-3 w-40 items-end justify-center gap-0.5" aria-label={active.current ? 'Microphone is on' : 'Microphone is off'} role="img">
          {Array.from({ length: 12 }, (_, i) => <span key={i} className={`w-2 rounded-sm transition-all duration-75 ${active.current && level * 12 > i ? 'bg-gold' : 'bg-line'}`} style={{ height: `${4 + (i % 4) * 2}px` }} />)}
        </div>
        <p role="status" aria-live="polite" className={`min-h-[2.5rem] text-sm ${status === 'ERROR' ? 'text-maroon' : 'text-heading'}`}>{status === 'ERROR' && error ? error : STATUS_TEXT[status]}</p>

        <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Language">
          {(Object.keys(LANG_LABEL) as Lang[]).map((l) => (
            <button key={l} type="button" onClick={() => changeLang(l)} aria-pressed={lang === l} className={`rounded-full px-3 py-1 text-xs ${lang === l ? 'bg-navy text-white dark:bg-gold dark:text-navy-950' : 'border border-line text-muted hover:text-heading'}`}>{LANG_LABEL[l]}</button>
          ))}
        </div>

        {!supported ? (
          <p className="text-sm text-muted">Voice conversations need Chrome, Edge or Safari. <Link href="/" className="underline">Use the chat assistant</Link> instead.</p>
        ) : (
          <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Conversation controls">
            <button type="button" onClick={start} disabled={status !== 'IDLE' && status !== 'ERROR' && status !== 'STOPPED'} className="btn-primary px-5 py-2.5 disabled:opacity-40">🎙️ Start conversation</button>
            <button type="button" onClick={stopConversation} disabled={status === 'IDLE' || status === 'STOPPED' || status === 'ERROR'} className="btn-outline px-4 py-2.5 disabled:opacity-40">⏹ Stop conversation</button>
            {!embedded && <button type="button" onClick={close} className="btn-outline px-4 py-2.5">✕ Close</button>}
            {status !== 'IDLE' && status !== 'STOPPED' && status !== 'ERROR' && <button type="button" onClick={() => { setMuted((m) => !m); if (!muted) { turn.current++; stopAudio(); if (active.current) setStatus('LISTENING'); } }} aria-pressed={muted} className="btn-outline px-4 py-2.5">{muted ? '🔇 Unmute' : '🔊 Mute'}</button>}
            {(heard || answer) && <button type="button" onClick={restart} className="px-2 py-2.5 text-xs text-muted underline">Clear conversation</button>}
          </div>
        )}
        {(heard || answer) && (
          <div className="w-full space-y-2 rounded-xl bg-bg p-3 text-left text-sm" aria-label="Captions">
            {heard && <p><span className="text-xs font-semibold uppercase text-muted">You</span><br />{heard}</p>}
            {answer && <p><span className="text-xs font-semibold uppercase text-muted">Assistant</span><br />{answer}</p>}
            {sources.length > 0 && <p className="text-xs text-muted">Sources: {sources.map((s, i) => <Link key={s.href + i} href={s.href} className="mr-2 underline">{s.label}</Link>)}</p>}
          </div>
        )}
        <p className="text-[10px] leading-4 text-muted">
          AI assistant, not a person. Answers come only from verified college information; it never promises seats or ranks.
          {voiceKind === 'browser' && ' Using this device’s voice.'}{latency !== null && ` Answered in ${(latency / 1000).toFixed(1)} s.`}
        </p>
      </div>
    </section>
  );

  if (embedded) return panel;
  if (pathname === '/voice-assistant') return null; // the page shows the agent itself
  return (
    <>
      {open && panel}
      <button type="button" onClick={() => (open ? close() : setOpen(true))} aria-expanded={open} className="fixed bottom-20 left-4 z-40 flex h-14 items-center gap-2 rounded-full bg-maroon px-4 md:bottom-6 md:left-6 font-semibold text-white shadow-lg transition hover:brightness-110">
        <span aria-hidden>🎙️</span> {open ? 'Close voice' : 'Voice assistant'}
      </button>
    </>
  );
}

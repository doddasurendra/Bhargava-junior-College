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
const POS_KEY = 'bjc_voice_pos';
const PILL_KEY = 'bjc_voice_pill';
/** Move / minimise controls and their screen-reader text, in the visitor's language. */
const T: Record<Lang, { move: string; moveLabel: string; drag: string; min: string; expand: string; reset: string; resetBtn: string; close: string; moved: string; pill: string; pillClose: string; pillHint: string }> = {
  en: { move: 'Move', moveLabel: 'Move voice assistant', drag: 'Drag to move', min: 'Minimise', expand: 'Expand', reset: 'Position reset', resetBtn: 'Reset position', close: 'Close voice assistant', moved: 'Voice assistant moved', pill: 'Voice assistant', pillClose: 'Close voice', pillHint: 'Drag up or down to move' },
  te: { move: 'కదిలించు', moveLabel: 'వాయిస్ అసిస్టెంట్‌ను కదిలించండి', drag: 'కదిలించడానికి లాగండి', min: 'చిన్నదిగా చేయి', expand: 'విస్తరించు', reset: 'స్థానం రీసెట్ అయింది', resetBtn: 'స్థానం రీసెట్ చేయి', close: 'వాయిస్ అసిస్టెంట్‌ను మూసివేయండి', moved: 'వాయిస్ అసిస్టెంట్ కదిలింది', pill: 'వాయిస్ అసిస్టెంట్', pillClose: 'వాయిస్ మూసివేయి', pillHint: 'కదిలించడానికి పైకి లేదా కిందికి లాగండి' },
  hi: { move: 'खिसकाएँ', moveLabel: 'वॉइस असिस्टेंट को खिसकाएँ', drag: 'खिसकाने के लिए खींचें', min: 'छोटा करें', expand: 'बड़ा करें', reset: 'स्थिति रीसेट हुई', resetBtn: 'स्थिति रीसेट करें', close: 'वॉइस असिस्टेंट बंद करें', moved: 'वॉइस असिस्टेंट खिसकाया गया', pill: 'वॉइस असिस्टेंट', pillClose: 'वॉइस बंद करें', pillHint: 'खिसकाने के लिए ऊपर या नीचे खींचें' },
};
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
  // panel position (px from the top-left) once moved; null = the default place near the bottom-left
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [pillY, setPillY] = useState<number | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [sheet, setSheet] = useState<'normal' | 'full' | 'min'>('normal');
  const [sheetDy, setSheetDy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [said, setSaid] = useState('');
  const panelRef = useRef<HTMLElement | null>(null);
  const drag = useRef<{ sx: number; sy: number; x: number; y: number; id: number; moved: boolean } | null>(null);
  const pillDrag = useRef<{ sy: number; y: number; id: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
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

  // ---- moving the panel and the floating button (mouse, touch and pen via Pointer Events; keyboard on the handles)
  // Moving never touches the conversation: no restart of recognition, microphone or audio.
  const bucket = () => (typeof window === 'undefined' ? 'd' : `${window.innerWidth <= 480 ? 'm' : window.innerWidth <= 1024 ? 't' : 'd'}-${window.innerWidth > window.innerHeight ? 'l' : 'p'}`);
  const insets = useCallback(() => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    const r = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
    probe.remove();
    return r;
  }, []);
  /** Keep the panel on screen: the whole panel when it fits, else at least its header. */
  const clamp = useCallback((x: number, top: number) => {
    const el = panelRef.current;
    const w = el?.offsetWidth ?? 380, h = el?.offsetHeight ?? 400;
    const s = insets();
    const minX = 8 + s.l, maxX = Math.max(minX, window.innerWidth - w - 8 - s.r);
    const minY = 8 + s.t, maxY = Math.max(minY, window.innerHeight - Math.min(h, window.innerHeight - 16 - s.t - s.b) - 8 - s.b);
    return { x: Math.round(Math.min(Math.max(x, minX), maxX)), y: Math.round(Math.min(Math.max(top, minY), maxY)) };
  }, [insets]);
  const save = useCallback((pt: { x: number; y: number } | null) => {
    try {
      if (pt) localStorage.setItem(`${POS_KEY}:${bucket()}`, JSON.stringify({ ...pt, w: window.innerWidth, h: window.innerHeight }));
      else localStorage.removeItem(`${POS_KEY}:${bucket()}`);
    } catch { /* storage may be blocked */ }
  }, []);
  const announce = (msg: string) => { setSaid(''); requestAnimationFrame(() => setSaid(msg)); };

  // restore the saved position for this kind of screen, rescaled if the screen size changed
  useEffect(() => {
    const onResize = () => {
      setMobile(window.innerWidth <= 480);
      setPos(() => {
        try {
          const raw = localStorage.getItem(`${POS_KEY}:${bucket()}`);
          if (!raw) return null;
          const v = JSON.parse(raw) as { x: number; y: number; w: number; h: number };
          return clamp((v.x / (v.w || window.innerWidth)) * window.innerWidth, (v.y / (v.h || window.innerHeight)) * window.innerHeight);
        } catch { return null; }
      });
      setPillY(() => { try { const v = Number(localStorage.getItem(`${PILL_KEY}:${bucket()}`)); return v > 0 ? Math.min(Math.max(v, 72), window.innerHeight - 72) : null; } catch { return null; } });
    };
    onResize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('orientationchange', onResize); };
  }, [clamp]);
  // keep it on screen when it grows (captions) or shrinks (minimised)
  useEffect(() => { if (open && pos) setPos((cur) => (cur ? clamp(cur.x, cur.y) : cur)); }, [open, heard, answer, error, minimized, clamp]); // eslint-disable-line react-hooks/exhaustive-deps

  /** After a move, step clear of the chat button, WhatsApp button and other floating widgets. */
  const avoidOverlap = useCallback((pt: { x: number; y: number }) => {
    const el = panelRef.current;
    if (!el) return pt;
    const w = el.offsetWidth, h = el.offsetHeight;
    let { x, y: top } = pt;
    for (let pass = 0; pass < 3; pass++) {
      const hit = [...document.querySelectorAll<HTMLElement>('[data-floating-widget]')].map((n) => n.getBoundingClientRect()).find((r) => r.width && r.left < x + w && r.right > x && r.top < top + h && r.bottom > top);
      if (!hit) break;
      const above = hit.top - h - 8, left = hit.left - w - 8;
      if (above >= 8) top = above; else if (left >= 8) x = left; else top = hit.bottom + 8;
      ({ x, y: top } = clamp(x, top));
    }
    return { x, y: top };
  }, [clamp]);

  const isHandle = (t: HTMLElement) => !!t.closest('[data-drag-handle]') || !t.closest('button,a,select,input,textarea,label');
  function onDragStart(e: React.PointerEvent<HTMLElement>) {
    if (embedded || !isHandle(e.target as HTMLElement)) return; // controls stay clickable
    const r = panelRef.current?.getBoundingClientRect();
    if (!r) return;
    drag.current = { sx: e.clientX, sy: e.clientY, x: r.left, y: r.top, id: e.pointerId, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
    setDragging(true);
  }
  function onDragMove(e: React.PointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (mobile) { setSheetDy(dy); return; } // bottom sheet: vertical gesture only
    setPos(clamp(d.x + dx, d.y + dy));
  }
  function onDragEnd(e: React.PointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (mobile) {
      const dy = e.clientY - d.sy;
      setSheetDy(0);
      if (dy < -40) { setMinimized(false); setSheet((s) => (s === 'min' ? 'normal' : 'full')); }
      else if (dy > 40) setSheet((s) => { if (s === 'full') return 'normal'; setMinimized(true); return 'min'; });
      return;
    }
    if (!d.moved) return;
    setPos((cur) => { const next = cur ? avoidOverlap(cur) : cur; save(next); return next; });
    announce(T[langRef.current].moved);
  }
  function resetPos() {
    setPos(null);
    save(null);
    setSheet('normal');
    setMinimized(false);
    announce(T[langRef.current].reset);
  }
  function onHandleKey(e: React.KeyboardEvent<HTMLElement>) {
    if (embedded) return;
    // only the header itself or a drag handle moves the panel (arrow keys on other buttons do their normal thing)
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).closest('[data-drag-handle]')) return;
    if (e.key === 'Home') { e.preventDefault(); resetPos(); return; }
    const step = e.shiftKey ? 80 : 20;
    const dir = { ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] }[e.key];
    if (!dir) return;
    e.preventDefault();
    if (mobile) { if (dir[1] < 0) { setMinimized(false); setSheet((s) => (s === 'min' ? 'normal' : 'full')); } else if (dir[1] > 0) setSheet((s) => { if (s === 'full') return 'normal'; setMinimized(true); return 'min'; }); return; }
    const r = panelRef.current?.getBoundingClientRect();
    if (!r) return;
    const next = clamp(r.left + dir[0], r.top + dir[1]);
    setPos(next);
    save(next);
    announce(T[langRef.current].moved);
  }

  // floating button: drag up and down along the left edge; a tap (< 6 px) still opens / closes
  function onPillDown(e: React.PointerEvent<HTMLButtonElement>) {
    pillDrag.current = { sy: e.clientY, y: e.currentTarget.getBoundingClientRect().top, id: e.pointerId, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPillMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = pillDrag.current;
    if (!d || d.id !== e.pointerId) return;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.abs(dy) <= 6) return;
    d.moved = true;
    const s = insets();
    setPillY(Math.min(Math.max(d.y + dy, 8 + s.t), window.innerHeight - 64 - s.b));
  }
  function onPillUp(e: React.PointerEvent<HTMLButtonElement>) {
    const d = pillDrag.current;
    pillDrag.current = null;
    if (!d || d.id !== e.pointerId) return;
    if (d.moved) {
      suppressClick.current = true;
      setPillY((v) => { if (v !== null) try { localStorage.setItem(`${PILL_KEY}:${bucket()}`, String(Math.round(v))); } catch { /* ignore */ } return v; });
      announce(T[langRef.current].moved);
    }
  }
  function onPillKey(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const top = e.currentTarget.getBoundingClientRect().top + (e.key === 'ArrowUp' ? -1 : 1) * (e.shiftKey ? 80 : 20);
    const v = Math.min(Math.max(top, 8), window.innerHeight - 64);
    setPillY(v);
    try { localStorage.setItem(`${PILL_KEY}:${bucket()}`, String(Math.round(v))); } catch { /* ignore */ }
    announce(T[langRef.current].moved);
  }
  const busy = status === 'PROCESSING' || status === 'RETRIEVING_INFORMATION';
  const panel = (
    <section
      ref={panelRef}
      aria-label="BJC AI Voice Assistant"
      data-testid="voice-panel"
      data-minimized={minimized ? 'true' : 'false'}
      style={embedded ? undefined : mobile
        ? { left: 0, right: 0, bottom: 0, top: 'auto', maxHeight: sheet === 'full' ? '88vh' : '70vh', transform: sheetDy ? `translateY(${Math.max(-120, sheetDy)}px)` : undefined, paddingBottom: 'env(safe-area-inset-bottom)' }
        : pos ? { left: pos.x, top: pos.y, bottom: 'auto', right: 'auto' } : undefined}
      className={`${embedded ? 'card mx-auto max-w-xl' : mobile ? 'fixed z-[60] w-full overflow-y-auto rounded-t-2xl border border-line bg-surface shadow-2xl' : `fixed bottom-36 left-4 z-[60] w-[min(92vw,380px)] md:bottom-24 rounded-2xl border border-line bg-surface shadow-2xl ${dragging ? 'ring-2 ring-gold' : ''}`} overflow-hidden`}
    >
      {!embedded && mobile && <div aria-hidden className="flex justify-center bg-navy pt-2"><span className="h-1.5 w-12 rounded-full bg-white/50" /></div>}
      <header
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        onKeyDown={onHandleKey}
        onDoubleClick={(e) => { if (!embedded && isHandle(e.target as HTMLElement)) resetPos(); }}
        tabIndex={embedded ? undefined : 0}
        role={embedded ? undefined : 'group'}
        aria-label={embedded ? undefined : `${T[lang].moveLabel}. ${T[lang].drag}`}
        title={embedded ? undefined : T[lang].drag}
        data-testid="voice-header"
        className={`flex items-center gap-2 bg-navy px-3 py-3 text-white ${embedded ? '' : 'cursor-grab touch-none select-none active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-gold'}`}
      >
        {!embedded && <span aria-hidden data-drag-handle className="-ml-1 px-1 text-lg leading-none text-white/60" title={T[lang].drag}>⋮⋮</span>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={college.logoSrc} alt="" width={36} height={36} draggable={false} className="h-9 w-9 rounded-full bg-white" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">BJC AI Voice Assistant</p>
          <p className="text-xs text-white/70">Voice only · {LANG_LABEL[lang]} · <span data-testid="voice-status">{CHIP[lang][status] ?? status}</span></p>
        </div>
        {!embedded && (
          <>
            <button type="button" data-drag-handle data-testid="voice-move" aria-label={T[lang].moveLabel} title={T[lang].drag} className="cursor-grab touch-none rounded-full px-1.5 text-base text-white/80 hover:text-white active:cursor-grabbing">⇅</button>
            <button type="button" onClick={resetPos} aria-label={T[lang].resetBtn} title={T[lang].resetBtn} data-testid="voice-reset" className="rounded-full px-1.5 text-base text-white/80 hover:text-white">↺</button>
            <button type="button" onClick={() => { setMinimized((v) => !v); if (mobile) setSheet((s) => (s === 'min' ? 'normal' : 'min')); }} aria-label={minimized ? T[lang].expand : T[lang].min} aria-expanded={!minimized} title={minimized ? T[lang].expand : T[lang].min} data-testid="voice-minimize" className="rounded-full px-1.5 text-lg leading-none text-white/80 hover:text-white">{minimized ? '▢' : '–'}</button>
            <button type="button" onClick={close} aria-label={T[lang].close} title={T[lang].close} className="rounded-full px-1.5 text-lg text-white/80 hover:text-white">×</button>
          </>
        )}
      </header>
      <span className="sr-only" aria-live="polite" data-testid="voice-announce">{said}</span>
      <div className={`${!embedded && minimized ? 'hidden' : 'flex'} flex-col items-center gap-3 px-5 py-6 text-center`} aria-hidden={!embedded && minimized ? true : undefined}>
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
      <button
        type="button"
        data-testid="voice-pill"
        onPointerDown={onPillDown}
        onPointerMove={onPillMove}
        onPointerUp={onPillUp}
        onPointerCancel={onPillUp}
        onKeyDown={onPillKey}
        onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } if (open) close(); else { setMinimized(false); setOpen(true); } }}
        aria-expanded={open}
        aria-describedby="voice-pill-hint"
        style={pillY !== null ? { top: pillY, bottom: 'auto' } : undefined}
        className="fixed bottom-20 left-4 z-40 flex h-14 touch-none select-none items-center gap-2 rounded-full bg-maroon px-4 md:bottom-6 md:left-6 font-semibold text-white shadow-lg transition hover:brightness-110"
      >
        <span aria-hidden>🎙️</span> {open ? T[lang].pillClose : T[lang].pill}
      </button>
      <span id="voice-pill-hint" className="sr-only">{T[lang].pillHint}</span>
    </>
  );
}

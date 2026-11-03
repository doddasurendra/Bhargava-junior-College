'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { college } from '@/content/college';
import { CHIPS, GREETING, reply as localReply, type BotFacts } from '@/lib/chat/faqBot';
import { getAttribution, postJson } from '@/lib/attribution';
import { Consent, PhoneInput } from './forms';

type Line = { key: string; from: 'user' | 'bot' | 'staff' | 'system'; text: string; links?: { label: string; href: string }[]; name?: string | null; quick?: boolean };
type Session = { c: string; t: string; mode: 'bot' | 'live' };
type Stage = 'bot' | 'form' | 'live' | 'closed';

const SESSION_KEY = 'bjc_chat';
const store = {
  get: (): Session | null => {
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      return s?.c && s?.t ? { mode: 'live', ...s } : null;
    } catch {
      return null;
    }
  },
  set: (s: Session | null) => {
    try {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  },
};

interface TurnResponse {
  c: string;
  t: string;
  reply: string;
  links: { label: string; href: string }[];
  fallback: boolean;
  needsConsent: boolean;
  consent: boolean;
  live: boolean;
  handoffForm: { reason: string } | null;
}

export function ChatWidget({ facts }: { facts: BotFacts }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([{ key: 'g', from: 'bot', text: GREETING.text }]);
  const [stage, setStage] = useState<Stage>('bot');
  const [session, setSession] = useState<Session | null>(null);
  const [agent, setAgent] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [unread, setUnread] = useState(0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastAt = useRef<string | null>(null);
  const seen = useRef(new Set<string>());
  const scroller = useRef<HTMLDivElement>(null);

  const saveSession = (s: Session | null) => {
    setSession(s);
    store.set(s);
  };

  // Restore after a reload: the server holds the transcript (both bot and live chats).
  useEffect(() => {
    const s = store.get();
    if (s) {
      setSession(s);
      setLines([]);
      if (s.mode === 'live') setStage('live');
    }
  }, []);

  // Proactive nudge after 20 s on fee and program pages (brief §5.2), once per browser session.
  useEffect(() => {
    if (open || !/^\/(fees|programs)/.test(pathname)) return;
    try {
      if (sessionStorage.getItem('bjc_chat_nudge')) return;
    } catch {
      return;
    }
    const t = setTimeout(() => {
      setNudge(true);
      try {
        sessionStorage.setItem('bjc_chat_nudge', '1');
      } catch {
        /* ignore */
      }
    }, 20_000);
    return () => clearTimeout(t);
  }, [pathname, open]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [lines, stage, typing, needsConsent]);

  const poll = useCallback(async () => {
    if (!session) return;
    const q = new URLSearchParams({ c: session.c, t: session.t, ...(lastAt.current ? { after: lastAt.current } : {}) });
    const res = await fetch(`/api/chat/messages?${q}`).catch(() => null);
    if (!res) return;
    if (res.status === 404) {
      saveSession(null);
      setStage('bot');
      setLines([{ key: 'g', from: 'bot', text: GREETING.text }]);
      return;
    }
    const d = await res.json().catch(() => null);
    if (!d?.ok) return;
    setAgent(d.agent);
    if (d.status === 'closed') setStage('closed');
    else if (d.status !== 'bot' && session.mode === 'bot') {
      saveSession({ ...session, mode: 'live' });
      setStage('live');
    }
    const fresh: Line[] = [];
    for (const m of d.messages as { id: string; author: string; text: string; at: string; name: string | null }[]) {
      if (seen.current.has(m.id)) continue;
      seen.current.add(m.id);
      lastAt.current = m.at;
      fresh.push({ key: m.id, from: m.author === 'contact' ? 'user' : (m.author as Line['from']), text: m.text, name: m.name });
    }
    if (fresh.length) {
      setLines((l) => [...l.filter((x) => !x.key.startsWith('pending-')), ...fresh]);
      if (!open) setUnread((n) => n + fresh.filter((f) => f.from === 'staff').length);
    }
  }, [session, open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bot chats load their transcript once; live chats keep polling for the counsellor's replies.
  const restored = useRef(false);
  useEffect(() => {
    if (!session) return;
    if (session.mode === 'bot') {
      if (!restored.current) {
        restored.current = true;
        poll();
      }
      return;
    }
    poll();
    const id = setInterval(poll, open ? 4000 : 15000);
    return () => clearInterval(id);
  }, [session, open, poll]);

  function goLive(s: { c: string; t: string }) {
    seen.current = new Set();
    lastAt.current = null;
    restored.current = true;
    setLines([]);
    setStage('live');
    setNeedsConsent(false);
    saveSession({ c: s.c, t: s.t, mode: 'live' });
  }

  async function ask(text: string, opts: { consent?: true } = {}) {
    setLines((l) => [...l, { key: `pending-u${Date.now()}`, from: 'user', text }]);
    setTyping(true);
    setError(null);
    const r = await postJson<TurnResponse>('/api/assistant', { c: session?.c, t: session?.t, text, ...opts, attribution: getAttribution() });
    setTyping(false);
    if (!r.ok || !r.c || !r.t) {
      if (r.error?.includes('counsellor now')) return poll();
      // Network or server trouble: answer locally from site content.
      const fb = localReply(text, facts);
      setLines((l) => [...l, { key: `fb${Date.now()}`, from: 'bot', text: fb.text, links: fb.links, quick: true }]);
      if (fb.intent === 'handoff') setStage('form');
      return;
    }
    const s: Session = { c: r.c, t: r.t, mode: 'bot' };
    if (!session) {
      restored.current = true;
      saveSession(s);
    }
    setLines((l) => [...l, { key: `b${Date.now()}`, from: 'bot', text: r.reply ?? '', links: r.links, quick: Boolean(r.fallback) }]);
    setNeedsConsent(Boolean(r.needsConsent));
    if (r.live) goLive(s);
    else if (r.handoffForm) {
      setReason(r.handoffForm.reason);
      setStage('form');
    }
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || typing) return;
    setInput('');
    if (stage === 'live' && session) {
      setLines((l) => [...l, { key: `pending-${Date.now()}`, from: 'user', text }]);
      const r = await postJson('/api/chat/messages', { c: session.c, t: session.t, text });
      if (!r.ok) setError(r.error ?? 'Not sent.');
      poll();
      return;
    }
    await ask(text);
  }

  async function handoff(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const transcript = lines.filter((l) => l.from === 'user' || l.from === 'bot').map((l) => ({ from: l.from as 'user' | 'bot', text: l.text }));
    const r = await postJson<{ conversationId: string; token: string }>('/api/chat/handoff', {
      name,
      phone,
      consent,
      question: reason ?? undefined,
      transcript: session ? [] : transcript,
      c: session?.c,
      t: session?.t,
      attribution: getAttribution(),
    });
    setBusy(false);
    if (!r.ok || !r.conversationId || !r.token) return setError(r.error ?? 'Could not reach a counsellor. Please call us.');
    goLive({ c: r.conversationId, t: r.token });
  }

  function newChat() {
    saveSession(null);
    restored.current = false;
    setAgent(null);
    setStage('bot');
    setNeedsConsent(false);
    setLines([{ key: 'g', from: 'bot', text: GREETING.text }]);
  }

  if (pathname.startsWith('/crm')) return null;

  return (
    <>
      {nudge && !open && (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setNudge(false);
          }}
          className="fixed bottom-[9.5rem] right-4 z-40 max-w-[220px] animate-rise rounded-2xl rounded-br-sm bg-surface px-4 py-3 text-left text-sm shadow-lg ring-1 ring-line md:bottom-24 md:right-6"
        >
          {pathname.startsWith('/fees') ? 'Questions about fees or scholarships? Ask me.' : 'Not sure which program fits? Ask me.'}
        </button>
      )}

      <button
        type="button"
        aria-label={open ? 'Close chat' : 'Ask admissions'}
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          setNudge(false);
          setUnread(0);
        }}
        className="fixed bottom-20 right-4 z-40 flex h-14 items-center gap-2 rounded-full bg-navy pl-1.5 pr-4 text-white shadow-lg transition hover:bg-navy-800 md:bottom-6 md:right-6"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={college.logoSrc} alt="" width={44} height={44} className="h-11 w-11 rounded-full bg-white" />
        <span className="text-sm font-semibold">{open ? 'Close' : 'Ask admissions'}</span>
        {unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-maroon px-1 text-[11px] font-bold">{unread}</span>}
      </button>

      {open && (
        <section role="dialog" aria-label="Bhargava Admission Assistant" className="fixed inset-x-2 bottom-[9.5rem] z-50 flex max-h-[70vh] animate-rise flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl ring-1 ring-line md:inset-x-auto md:bottom-24 md:right-6 md:h-[560px] md:w-[380px]">
          <header className="flex items-center gap-3 bg-navy px-4 py-3 text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={college.logoSrc} alt="" width={36} height={36} className="h-9 w-9 rounded-full bg-white" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{stage === 'live' && agent ? agent : 'Bhargava Admission Assistant'}</p>
              <p className="text-xs text-white/70">{stage === 'live' ? (agent ? 'Admissions team' : 'Waiting for a counsellor…') : 'Online · English, తెలుగు, हिंदी'}</p>
            </div>
            {(stage === 'bot' || stage === 'form') && session && (
              <button type="button" onClick={newChat} className="rounded-full px-2 py-1 text-[11px] text-white/80 underline hover:text-white">
                New chat
              </button>
            )}
          </header>

          <div ref={scroller} className="flex-1 space-y-2 overflow-y-auto bg-bg p-3" aria-live="polite">
            {lines.map((l) => (
              <div key={l.key} className={`flex ${l.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                {l.from === 'system' ? (
                  <p className="mx-auto max-w-[90%] rounded-lg bg-gold-100 px-3 py-1.5 text-center text-xs text-navy">{l.text}</p>
                ) : (
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${l.from === 'user' ? 'rounded-br-sm bg-navy text-white' : 'rounded-bl-sm bg-surface text-ink ring-1 ring-line'}`}>
                    {l.from === 'staff' && l.name && <p className="mb-0.5 text-[11px] font-semibold text-maroon dark:text-gold">{l.name}</p>}
                    {l.quick && <p className="mb-0.5 text-[10px] uppercase tracking-wider text-muted">Quick answer</p>}
                    <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{l.text}</p>
                    {l.links && l.links.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {l.links.map((k) => (
                          <Link key={k.href} href={k.href} onClick={() => setOpen(false)} className="rounded-full bg-gold-100 px-2.5 py-1 text-xs font-semibold text-navy hover:bg-gold-300">
                            {k.label} →
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {typing && (
              <div className="flex justify-start" aria-label="Assistant is typing">
                <span className="rounded-2xl rounded-bl-sm bg-surface px-3 py-2 text-sm text-muted ring-1 ring-line">
                  <span className="inline-block animate-pulse">●●●</span>
                </span>
              </div>
            )}

            {needsConsent && stage === 'bot' && !typing && (
              <div className="rounded-xl bg-surface p-3 text-xs leading-5 text-muted ring-1 ring-line">
                <p>
                  {college.name} may contact you by call, SMS and WhatsApp about admissions and store the details you share for that purpose (DPDP Act 2023).
                </p>
                <button type="button" className="btn-primary mt-2 w-full py-2" onClick={() => ask('I agree', { consent: true })}>
                  I agree
                </button>
              </div>
            )}

            {stage === 'bot' && lines.length <= 1 && !typing && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {CHIPS.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => (c.intent === 'handoff' ? setStage('form') : ask(c.label))}
                    className="rounded-full border border-navy/30 bg-surface px-3 py-1 text-xs font-medium text-navy hover:border-gold dark:border-white/30 dark:text-white"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}

            {stage === 'form' && (
              <form onSubmit={handoff} className="space-y-2 rounded-xl bg-surface p-3 ring-1 ring-line">
                <p className="text-xs font-semibold text-heading">Connect me to a counsellor</p>
                <input className="input py-2 text-sm" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoComplete="name" />
                <PhoneInput value={phone} onChange={setPhone} />
                <Consent checked={consent} onChange={setConsent} />
                {error && <p className="text-xs font-medium text-maroon">{error}</p>}
                <div className="flex gap-2">
                  <button className="btn-primary flex-1 py-2" disabled={busy}>
                    {busy ? 'Connecting…' : 'Connect me'}
                  </button>
                  <button type="button" className="btn-outline py-2" onClick={() => setStage('bot')}>
                    Back
                  </button>
                </div>
              </form>
            )}

            {stage === 'closed' && (
              <div className="rounded-xl bg-surface p-3 text-center text-sm ring-1 ring-line">
                <p>This chat has ended. Thank you!</p>
                <button type="button" className="mt-2 text-xs font-semibold text-maroon underline dark:text-gold" onClick={newChat}>
                  Start a new chat
                </button>
              </div>
            )}
            {error && stage !== 'form' && <p className="text-center text-xs text-maroon">{error}</p>}
          </div>

          {(stage === 'bot' || stage === 'live') && (
            <form onSubmit={send} className="flex gap-2 border-t border-line p-2">
              <label className="sr-only" htmlFor="chat-input">
                Message
              </label>
              <input
                id="chat-input"
                className="input py-2 text-sm"
                placeholder={stage === 'live' ? 'Message the counsellor…' : 'Ask in English, తెలుగు or हिंदी…'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={1000}
                autoComplete="off"
              />
              <button className="btn-primary px-4 py-2" aria-label="Send" disabled={typing}>
                ➤
              </button>
            </form>
          )}
          {stage === 'bot' && (
            <p className="px-3 pb-2 text-[10px] leading-4 text-muted">
              AI assistant answering from our published information; it can make mistakes, and we never promise ranks or seats.{' '}
              <button type="button" className="underline" onClick={() => setStage('form')}>
                Talk to a person
              </button>{' '}
              or call <a href={`tel:${college.phones[0].tel}`} className="underline">{college.phones[0].display}</a>.
            </p>
          )}
        </section>
      )}
    </>
  );
}

'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { college } from '@/content/college';
import { answer, CHIPS, GREETING, reply, type BotReply } from '@/lib/chat/faqBot';
import { getAttribution, postJson } from '@/lib/attribution';
import { Consent, PhoneInput } from './forms';

type Line = { key: string; from: 'user' | 'bot' | 'staff' | 'system'; text: string; links?: BotReply['links']; name?: string | null; at?: string };
type Session = { c: string; t: string };

const SESSION_KEY = 'bjc_chat';
const loadSession = (): Session | null => {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
};

export function ChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([{ key: 'g', from: 'bot', text: GREETING.text }]);
  const [stage, setStage] = useState<'bot' | 'form' | 'live' | 'closed'>('bot');
  const [session, setSession] = useState<Session | null>(null);
  const [agent, setAgent] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [nudge, setNudge] = useState(false);
  const [unread, setUnread] = useState(0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastAt = useRef<string | null>(null);
  const seen = useRef(new Set<string>());
  const scroller = useRef<HTMLDivElement>(null);

  // Restore a live chat after a reload.
  useEffect(() => {
    const s = loadSession();
    if (s) {
      setSession(s);
      setStage('live');
      setLines([]);
    }
  }, []);

  // Proactive greeting after 20 s on fee and program pages (brief §5.2), once per browser session.
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
  }, [lines, stage]);

  const poll = useCallback(async () => {
    if (!session) return;
    const q = new URLSearchParams({ c: session.c, t: session.t, ...(lastAt.current ? { after: lastAt.current } : {}) });
    const res = await fetch(`/api/chat/messages?${q}`).catch(() => null);
    if (!res) return;
    if (res.status === 404) {
      try {
        localStorage.removeItem(SESSION_KEY);
      } catch {
        /* ignore */
      }
      setSession(null);
      setStage('bot');
      setLines([{ key: 'g', from: 'bot', text: GREETING.text }]);
      return;
    }
    const d = await res.json().catch(() => null);
    if (!d?.ok) return;
    setAgent(d.agent);
    if (d.status === 'closed') setStage('closed');
    const fresh: Line[] = [];
    for (const m of d.messages as { id: string; author: string; text: string; at: string; name: string | null }[]) {
      if (seen.current.has(m.id)) continue;
      seen.current.add(m.id);
      lastAt.current = m.at;
      fresh.push({ key: m.id, from: m.author === 'contact' ? 'user' : (m.author as Line['from']), text: m.text, name: m.name, at: m.at });
    }
    if (fresh.length) {
      setLines((l) => [...l.filter((x) => !x.key.startsWith('pending-')), ...fresh]);
      if (!open) setUnread((n) => n + fresh.filter((f) => f.from === 'staff').length);
    }
  }, [session, open]);

  useEffect(() => {
    if (!session) return;
    poll();
    const id = setInterval(poll, open ? 4000 : 15000);
    return () => clearInterval(id);
  }, [session, open, poll]);

  function botSay(r: BotReply) {
    setLines((l) => [...l, { key: `b${l.length}`, from: 'bot', text: r.text, links: r.links }]);
    if (r.intent === 'handoff') setStage('form');
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput('');
    if (stage === 'live' && session) {
      setLines((l) => [...l, { key: `pending-${Date.now()}`, from: 'user', text }]);
      const r = await postJson('/api/chat/messages', { c: session.c, t: session.t, text });
      if (!r.ok) setError(r.error ?? 'Not sent.');
      poll();
      return;
    }
    setLines((l) => [...l, { key: `u${l.length}`, from: 'user', text }]);
    setTimeout(() => botSay(reply(text)), 250);
  }

  async function handoff(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const transcript = lines.filter((l) => l.from === 'user' || l.from === 'bot').map((l) => ({ from: l.from as 'user' | 'bot', text: l.text }));
    const r = await postJson<{ conversationId: string; token: string }>('/api/chat/handoff', { name, phone, consent, transcript, attribution: getAttribution() });
    setBusy(false);
    if (!r.ok || !r.conversationId || !r.token) return setError(r.error ?? 'Could not reach a counsellor. Please call us.');
    const s = { c: r.conversationId, t: r.token };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
    seen.current = new Set();
    lastAt.current = null;
    setLines([]);
    setSession(s);
    setStage('live');
  }

  function newChat() {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    setSession(null);
    setAgent(null);
    setStage('bot');
    setLines([{ key: 'g', from: 'bot', text: GREETING.text }]);
  }

  if (pathname.startsWith('/crm')) return null;

  return (
    <>
      {nudge && !open && (
        <button
          type="button"
          onClick={() => { setOpen(true); setNudge(false); botSay(answer(pathname.startsWith('/fees') ? 'fees' : 'courses')); }}
          className="fixed bottom-[9.5rem] right-4 z-40 max-w-[220px] animate-rise rounded-2xl rounded-br-sm bg-surface px-4 py-3 text-left text-sm shadow-lg ring-1 ring-line md:bottom-24 md:right-6"
        >
          {pathname.startsWith('/fees') ? 'Questions about fees or scholarships? Ask me.' : 'Not sure which program fits? Ask me.'}
        </button>
      )}

      <button
        type="button"
        aria-label={open ? 'Close chat' : 'Ask admissions'}
        aria-expanded={open}
        onClick={() => { setOpen((o) => !o); setNudge(false); setUnread(0); }}
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
              <p className="text-xs text-white/70">{stage === 'live' ? (agent ? 'Admissions team' : 'Waiting for a counsellor…') : 'Online · answers from our official information'}</p>
            </div>
          </header>

          <div ref={scroller} className="flex-1 space-y-2 overflow-y-auto bg-bg p-3" aria-live="polite">
            {lines.map((l) => (
              <div key={l.key} className={`flex ${l.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                {l.from === 'system' ? (
                  <p className="mx-auto max-w-[90%] rounded-lg bg-gold-100 px-3 py-1.5 text-center text-xs text-navy">{l.text}</p>
                ) : (
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${l.from === 'user' ? 'rounded-br-sm bg-navy text-white' : 'rounded-bl-sm bg-surface text-ink ring-1 ring-line'}`}>
                    {l.from === 'staff' && l.name && <p className="mb-0.5 text-[11px] font-semibold text-maroon dark:text-gold">{l.name}</p>}
                    <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{l.text}</p>
                    {l.links && (
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

            {stage === 'bot' && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {CHIPS.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => {
                      setLines((l) => [...l, { key: `u${l.length}`, from: 'user', text: c.label }]);
                      setTimeout(() => botSay(answer(c.intent)), 200);
                    }}
                    className="rounded-full border border-navy/30 bg-surface px-3 py-1 text-xs font-medium text-navy hover:border-gold dark:border-white/30 dark:text-white"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}

            {stage === 'form' && (
              <form onSubmit={handoff} className="space-y-2 rounded-xl bg-surface p-3 ring-1 ring-line">
                <input className="input py-2 text-sm" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoComplete="name" />
                <PhoneInput value={phone} onChange={setPhone} />
                <Consent checked={consent} onChange={setConsent} />
                {error && <p className="text-xs font-medium text-maroon">{error}</p>}
                <div className="flex gap-2">
                  <button className="btn-primary flex-1 py-2" disabled={busy}>{busy ? 'Connecting…' : 'Connect me'}</button>
                  <button type="button" className="btn-outline py-2" onClick={() => setStage('bot')}>Back</button>
                </div>
              </form>
            )}

            {stage === 'closed' && (
              <div className="rounded-xl bg-surface p-3 text-center text-sm ring-1 ring-line">
                <p>This chat has ended. Thank you!</p>
                <button type="button" className="mt-2 text-xs font-semibold text-maroon underline dark:text-gold" onClick={newChat}>Start a new chat</button>
              </div>
            )}
          </div>

          {(stage === 'bot' || stage === 'live') && (
            <form onSubmit={send} className="flex gap-2 border-t border-line p-2">
              <label className="sr-only" htmlFor="chat-input">Message</label>
              <input id="chat-input" className="input py-2 text-sm" placeholder={stage === 'live' ? 'Message the counsellor…' : 'Ask about fees, hostel, BSAT…'} value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000} autoComplete="off" />
              <button className="btn-primary px-4 py-2" aria-label="Send">➤</button>
            </form>
          )}
          {stage === 'bot' && (
            <p className="px-3 pb-2 text-[10px] text-muted">
              Automated answers from our published information. We never promise ranks or seats. Prefer a call? <a href={`tel:${college.phones[0].tel}`} className="underline">{college.phones[0].display}</a>
            </p>
          )}
        </section>
      )}
    </>
  );
}

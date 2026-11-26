'use client';
import { useEffect, useState } from 'react';
import { sm2, type Rating } from '@/lib/openbook/sm2';

/**
 * Offline flashcard review (§19). While online, the flashcards page saves the student's cards due in the next
 * 14 days on this phone and registers the offline worker. Offline, /app/cards-offline reviews them with the
 * same SM-2 schedule and queues every rating; the queue is sent to the server as soon as the phone is online.
 */
export const CARDS_KEY = 'bjc_ob_cards_v1';
const QUEUE_KEY = 'bjc_ob_card_queue_v1';
export interface OfflineCard { id: string; front: string; back: string; kind: string; ef: number; interval: number; reps: number; lapses: number; due: string }
type Queued = { cardId: string; rating: Rating; at: string };

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const readQueue = (): Queued[] => { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]'); } catch { return []; } };

export async function flushQueue(): Promise<number> {
  const q = readQueue();
  if (!q.length || !navigator.onLine) return 0;
  const r = await fetch('/api/openbook/cards/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ratings: q }) }).catch(() => null);
  if (!r?.ok) return 0;
  const { applied } = (await r.json()) as { applied: number };
  localStorage.setItem(QUEUE_KEY, JSON.stringify(readQueue().slice(q.length)));
  return applied;
}

/** On the online flashcards page: save cards for offline use, send any ratings made offline. */
export function OfflineCardSync({ cards, studentKey }: { cards: OfflineCard[]; studentKey: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const sent = await flushQueue();
      try { localStorage.setItem(CARDS_KEY, JSON.stringify({ at: new Date().toISOString(), student: studentKey, cards })); } catch { /* storage full */ }
      if ('serviceWorker' in navigator) navigator.serviceWorker.register('/kb-sw.js', { scope: '/app/' }).catch(() => undefined);
      setMsg(`📶 ${cards.length} cards saved on this phone for offline review${sent ? ` · ${sent} offline ratings synced` : ''}.`);
    })();
    const on = () => { void flushQueue(); };
    window.addEventListener('online', on);
    return () => window.removeEventListener('online', on);
  }, [cards, studentKey]);
  return msg ? <p className="text-[11px] text-muted">{msg} <a className="underline" href="/app/cards-offline">Offline review</a></p> : null;
}

/** The offline reviewer: works without a connection, from this phone's storage. */
export function OfflineCardReview() {
  const [cards, setCards] = useState<OfflineCard[] | null>(null);
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [queued, setQueued] = useState(0);
  const [online, setOnline] = useState(true);
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(CARDS_KEY) ?? 'null') as { cards: OfflineCard[] } | null;
      setCards((raw?.cards ?? []).filter((c) => c.due <= today()));
    } catch { setCards([]); }
    setQueued(readQueue().length);
    setOnline(navigator.onLine);
    const on = async () => { setOnline(true); await flushQueue(); setQueued(readQueue().length); };
    const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  if (!cards) return null;
  if (!cards.length) return <p className="text-sm text-muted">No cards due on this phone. Open Flashcards once while online to save your cards here.</p>;
  const c = cards[i];
  const rate = async (r: Rating) => {
    const next = sm2(c, r, today());
    const all = JSON.parse(localStorage.getItem(CARDS_KEY) ?? '{"cards":[]}') as { cards: OfflineCard[] };
    all.cards = all.cards.map((x) => (x.id === c.id ? { ...x, ...next } : x));
    localStorage.setItem(CARDS_KEY, JSON.stringify(all));
    localStorage.setItem(QUEUE_KEY, JSON.stringify([...readQueue(), { cardId: c.id, rating: r, at: new Date().toISOString() }]));
    setQueued(readQueue().length);
    setFlip(false); setI((x) => x + 1);
    if (navigator.onLine) { await flushQueue(); setQueued(readQueue().length); }
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">{online ? '🟢 Online' : '📴 Offline'} · {queued} rating{queued === 1 ? '' : 's'} waiting to sync</p>
      {c ? (
        <>
          <p className="text-xs text-muted">Card {i + 1} of {cards.length}</p>
          <button onClick={() => setFlip((f) => !f)} className="card block min-h-[160px] w-full whitespace-pre-line p-5 text-left text-[15px] text-heading">{flip ? c.back : c.front}<span className="mt-3 block text-[11px] text-muted">{flip ? 'Answer' : 'Tap to show the answer'}</span></button>
          {flip && <div className="grid grid-cols-4 gap-2">{(['again', 'hard', 'good', 'easy'] as const).map((r) => <button key={r} onClick={() => rate(r)} className="btn-outline py-2 text-sm capitalize">{r}</button>)}</div>}
        </>
      ) : <p className="card p-4 text-sm">Session done. Your ratings sync when you are online.</p>}
    </div>
  );
}

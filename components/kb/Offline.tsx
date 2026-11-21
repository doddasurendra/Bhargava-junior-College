'use client';
import { useEffect, useState } from 'react';

export const OFFLINE_KEY = 'bjc_kb_offline_v1';
export interface OfflineArticle {
  id: string;
  title: string;
  body: string;
  centre: string;
}

/** Saves the readable KB articles on this phone and registers the offline worker (articles only, no live records). */
export function OfflineCache({ articles, label }: { articles: OfflineArticle[]; label: string }) {
  const [saved, setSaved] = useState<number | null>(null);
  useEffect(() => {
    try {
      localStorage.setItem(OFFLINE_KEY, JSON.stringify({ at: new Date().toISOString(), articles }));
      setSaved(articles.length);
    } catch {
      /* storage full or blocked: offline reading just isn't available */
    }
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/kb-sw.js', { scope: '/app/' }).catch(() => undefined);
  }, [articles]);
  return saved === null ? null : <p className="text-[11px] text-muted">📶 {label.replace('{n}', String(saved))}</p>;
}

/** The offline reader: shows what was saved on this device. */
export function OfflineReader() {
  const [data, setData] = useState<{ at: string; articles: OfflineArticle[] } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(OFFLINE_KEY);
      if (raw) setData(JSON.parse(raw));
    } catch {
      setData(null);
    }
  }, []);
  if (!data) return <p className="text-sm text-muted">Nothing saved on this phone yet. Open Knowledge once while online.</p>;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">You are offline. Showing {data.articles.length} articles saved on {new Date(data.at).toLocaleString()}.</p>
      <ul className="space-y-2">
        {data.articles.map((a) => (
          <li key={a.id} className="card p-3">
            <button type="button" className="w-full text-left font-semibold text-heading" onClick={() => setOpen(open === a.id ? null : a.id)} aria-expanded={open === a.id}>
              {a.title}
            </button>
            {open === a.id && <p className="mt-2 whitespace-pre-line text-sm leading-6">{a.body}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

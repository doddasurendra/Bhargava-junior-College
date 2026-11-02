'use client';
import type { Attribution } from './validation';

const KEY = 'bjc_attr';
const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

/** Remember first-touch UTM parameters, landing page and referrer for this browser session. */
export function captureFirstTouch() {
  try {
    if (sessionStorage.getItem(KEY)) return;
    const params = new URL(window.location.href).searchParams;
    const a: Record<string, string> = { landing: window.location.pathname };
    for (const k of UTM) {
      const v = params.get(k);
      if (v) a[k] = v.slice(0, 150);
    }
    if (document.referrer && !document.referrer.startsWith(window.location.origin)) a.referrer = document.referrer.slice(0, 500);
    sessionStorage.setItem(KEY, JSON.stringify(a));
  } catch {
    /* storage unavailable */
  }
}

export function getAttribution(): Attribution {
  let stored: Attribution = {};
  try {
    stored = JSON.parse(sessionStorage.getItem(KEY) || '{}');
  } catch {
    /* ignore */
  }
  const w = window.innerWidth;
  return { ...stored, page: window.location.pathname, device: w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop' };
}

export async function postJson<T = Record<string, unknown>>(url: string, body: unknown): Promise<{ ok: boolean; error?: string } & Partial<T>> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data.ok !== false, ...data, error: data.error ?? (res.ok ? undefined : 'Something went wrong. Please try again.') };
  } catch {
    return { ok: false, error: 'Network error. Please check your connection and try again.' } as { ok: boolean; error?: string } & Partial<T>;
  }
}

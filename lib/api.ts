import { NextResponse } from 'next/server';
import type { z } from 'zod';

export const ok = (data: Record<string, unknown> = {}) => NextResponse.json({ ok: true, ...data });
export const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

type Parsed<T> = { data: T } | { error: string } | { spam: true };

/** Parse JSON and validate. A filled `website` honeypot field marks the request as spam. */
export async function parseBody<S extends z.ZodTypeAny>(req: Request, schema: S): Promise<Parsed<z.output<S>>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { error: 'Invalid request' };
  }
  if (raw && typeof raw === 'object' && 'website' in raw && (raw as { website?: unknown }).website) return { spam: true };
  const r = schema.safeParse(raw);
  if (!r.success) return { error: r.error.issues[0]?.message ?? 'Invalid request' };
  return { data: r.data };
}

const hits = new Map<string, number[]>();

/**
 * In-memory sliding-window limiter. Good enough for one Node instance; move to Redis/Upstash
 * (or Supabase) when running several instances.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  const allowed = arr.length < limit;
  if (allowed) arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) {
    for (const k of hits.keys()) {
      hits.delete(k);
      if (hits.size < 4000) break;
    }
  }
  return allowed;
}

export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
}

export function deviceFromUA(req: Request): 'mobile' | 'tablet' | 'desktop' {
  const ua = req.headers.get('user-agent') ?? '';
  if (/iPad|Tablet/i.test(ua)) return 'tablet';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
  return 'desktop';
}

/**
 * Small in-memory rate limiter for search and AI (§20). Per server instance (Vercel runs several), so it
 * caps bursts rather than being an exact global quota.
 */
const buckets = new Map<string, { n: number; reset: number }>();

export function allow(key: string, limit: number, windowMs = 60_000, now = Date.now()) {
  const b = buckets.get(key);
  if (!b || b.reset <= now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
    return true;
  }
  if (b.n >= limit) return false;
  b.n++;
  return true;
}

/** Requests per minute by viewer kind. */
export const LIMITS = { public: { search: 30, ai: 10 }, student: { search: 60, ai: 20 }, parent: { search: 60, ai: 20 }, staff: { search: 120, ai: 40 } } as const;

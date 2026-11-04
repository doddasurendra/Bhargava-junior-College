import * as React from 'react';

/**
 * Per-request memoisation in the Next.js server runtime (React's `cache`); a plain pass-through elsewhere
 * (unit tests, scripts), where React's stable build doesn't export `cache`.
 */
export function reqCache<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const c = (React as unknown as { cache?: <F>(f: F) => F }).cache;
  return typeof c === 'function' ? c(fn) : fn;
}

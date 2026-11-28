/**
 * Where a staff member was going before the sign-in page. Only same-site CRM paths are accepted (never an
 * external URL, a protocol-relative "//host" or the login pages themselves), so this cannot become an open redirect.
 */
export const NEXT_COOKIE = 'bjc_next';

export function safeNext(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (s.length > 300 || !s.startsWith('/crm/') || s.startsWith('//') || s.includes('\\') || /[\u0000-\u001f]/.test(s)) return null;
  if (s.startsWith('/crm/login')) return null;
  try {
    const u = new URL(s, 'https://bjc.invalid');
    if (u.origin !== 'https://bjc.invalid') return null;
    return u.pathname + u.search;
  } catch {
    return null;
  }
}

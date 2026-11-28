/**
 * What a pending (not yet verified) student account may open. Everything else in the app is batch-specific or
 * private (marks, attendance, fees, hostel, parents, mentor notes) and is refused on the server by the app layout.
 * A pending account also has its own id ("pending-<id>"), so no private record can ever be keyed to it.
 */
export const PENDING_ALLOWED = ['/app/openbook', '/app/open-book', '/app/practice', '/app/knowledge', '/app/notices', '/app/events', '/app/more'] as const;

export function pendingAllowed(path: string | null | undefined): boolean {
  const p = (path ?? '').split('?')[0].replace(/\/+$/, '') || '/app';
  if (p === '/app') return true;
  return PENDING_ALLOWED.some((a) => p === a || p.startsWith(`${a}/`));
}

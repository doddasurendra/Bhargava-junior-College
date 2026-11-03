/** Office hours (brief §2): Mon–Fri 7 AM–5 PM, Sat 9 AM–3 PM, Sun closed, Asia/Kolkata. Pure. */
const IST_OFFSET_MIN = 330;

/** [open, close] in minutes after midnight IST, by weekday (0 = Sunday). */
export const OFFICE_HOURS: Record<number, [number, number] | null> = {
  0: null,
  1: [7 * 60, 17 * 60],
  2: [7 * 60, 17 * 60],
  3: [7 * 60, 17 * 60],
  4: [7 * 60, 17 * 60],
  5: [7 * 60, 17 * 60],
  6: [9 * 60, 15 * 60],
};

function istParts(d: Date) {
  const ist = new Date(d.getTime() + IST_OFFSET_MIN * 60_000);
  return { day: ist.getUTCDay(), minutes: ist.getUTCHours() * 60 + ist.getUTCMinutes(), y: ist.getUTCFullYear(), m: ist.getUTCMonth(), d: ist.getUTCDate() };
}

export function isOfficeOpen(now: Date = new Date()): boolean {
  const { day, minutes } = istParts(now);
  const h = OFFICE_HOURS[day];
  return Boolean(h && minutes >= h[0] && minutes < h[1]);
}

/** The next moment the office opens (now if it is open). */
export function nextOpening(now: Date = new Date()): Date {
  if (isOfficeOpen(now)) return now;
  const p = istParts(now);
  for (let i = 0; i < 8; i++) {
    const h = OFFICE_HOURS[(p.day + i) % 7];
    if (!h) continue;
    if (i === 0 && p.minutes >= h[0]) continue; // already past today's opening (closed for the day)
    // midnight IST of that day, as UTC ms, plus the opening minutes
    const midnightUtc = Date.UTC(p.y, p.m, p.d + i) - IST_OFFSET_MIN * 60_000;
    return new Date(midnightUtc + h[0] * 60_000);
  }
  throw new Error('no opening found');
}

export function formatOpening(d: Date): string {
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', hour: 'numeric', minute: '2-digit' });
}

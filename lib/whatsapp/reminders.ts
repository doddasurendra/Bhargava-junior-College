/** Campus-visit reminders (brief §7.1 step 5B): 1 day before and 2 hours before. Pure. */
export interface ReminderVisit {
  id: string;
  date: string;
  slot: string;
  status: string;
  createdAt: string;
}

export type ReminderKind = 'day_before' | 'two_hours';

const HOUR = 3_600_000;

/** Visit start as an instant: date + 'HH:MM' in IST. */
export const visitStart = (date: string, slot: string) => new Date(`${date}T${slot}:00+05:30`);

/**
 * Which reminders are due now. A cron runs this every ~15 minutes; dedupe keys make repeats harmless.
 * - day_before: from 24h before until 2h before. Skipped if the visit was booked less than 24h ahead
 *   (the confirmation just went out).
 * - two_hours: from 2h before until the visit starts.
 */
export function dueReminders(visits: ReminderVisit[], now: Date): { visitId: string; kind: ReminderKind; dedupeKey: string }[] {
  const out: { visitId: string; kind: ReminderKind; dedupeKey: string }[] = [];
  for (const v of visits) {
    if (v.status !== 'scheduled') continue;
    const start = visitStart(v.date, v.slot).getTime();
    const t = now.getTime();
    if (Number.isNaN(start) || t >= start) continue;
    if (t >= start - 2 * HOUR) out.push({ visitId: v.id, kind: 'two_hours', dedupeKey: `visit:${v.id}:two_hours` });
    else if (t >= start - 24 * HOUR && new Date(v.createdAt).getTime() <= start - 24 * HOUR) out.push({ visitId: v.id, kind: 'day_before', dedupeKey: `visit:${v.id}:day_before` });
  }
  return out;
}

import type { Content } from './cms/blocks';
import { addDays, isIsoDate, todayIST, weekday } from './dates';

/** Live slots come from the CMS (`getContent().visitSlots`). */
export type VisitSlots = Content['visitSlots'];

export function slotsFor(date: string, cfg: VisitSlots) {
  const wd = weekday(date);
  if (wd === 0) return [];
  return cfg.slots.filter((s) => wd !== 6 || s.saturday);
}

/** Bookable dates: from tomorrow, Mon–Sat, up to `count` days. */
export function bookableDates(cfg: VisitSlots, today: string = todayIST(), count = 12): string[] {
  const out: string[] = [];
  for (let i = 1; out.length < count && i <= cfg.maxDaysAhead; i++) {
    const d = addDays(today, i);
    if (weekday(d) !== 0) out.push(d);
  }
  return out;
}

/** Returns an error message, or null when the date/slot is bookable. */
export function validateVisit(date: string, slot: string, cfg: VisitSlots, today: string = todayIST()): string | null {
  if (!isIsoDate(date)) return 'Please choose a valid date.';
  if (date <= today) return 'Please choose a date from tomorrow onwards.';
  if (date > addDays(today, cfg.maxDaysAhead)) return `Visits can be booked up to ${cfg.maxDaysAhead} days ahead.`;
  if (weekday(date) === 0) return 'The campus is closed on Sundays.';
  if (!slotsFor(date, cfg).some((s) => s.slot === slot)) return 'This time slot is not available on the chosen day.';
  return null;
}

/** Label for a slot code, e.g. "10:00" → "10:00 AM". */
export const slotLabel = (slot: string, cfg: VisitSlots) => cfg.slots.find((s) => s.slot === slot)?.label ?? slot;

import { visitSlots } from '@/content/sample';
import { addDays, isIsoDate, todayIST, weekday } from './dates';

export function slotsFor(date: string) {
  const wd = weekday(date);
  if (wd === 0) return [];
  return visitSlots.slots.filter((s) => wd !== 6 || s.saturday);
}

/** Bookable dates: from tomorrow, Mon–Sat, up to `count` days. */
export function bookableDates(today: string = todayIST(), count = 12): string[] {
  const out: string[] = [];
  for (let i = 1; out.length < count && i <= visitSlots.maxDaysAhead; i++) {
    const d = addDays(today, i);
    if (weekday(d) !== 0) out.push(d);
  }
  return out;
}

/** Returns an error message, or null when the date/slot is bookable. */
export function validateVisit(date: string, slot: string, today: string = todayIST()): string | null {
  if (!isIsoDate(date)) return 'Please choose a valid date.';
  if (date <= today) return 'Please choose a date from tomorrow onwards.';
  if (date > addDays(today, visitSlots.maxDaysAhead)) return `Visits can be booked up to ${visitSlots.maxDaysAhead} days ahead.`;
  if (weekday(date) === 0) return 'The campus is closed on Sundays.';
  if (!slotsFor(date).some((s) => s.slot === slot)) return 'This time slot is not available on the chosen day.';
  return null;
}

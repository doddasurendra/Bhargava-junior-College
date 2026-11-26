/** SM-2 scheduling, shared by the server and the offline flashcard reviewer (pure, no imports). */
export type Rating = 'again' | 'hard' | 'good' | 'easy';

export function addDaysIso(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Anki-style buttons on SM-2: returns the next ease, interval (days), reps, lapses and due date. */
export function sm2(card: { ef: number; interval: number; reps: number; lapses: number }, rating: Rating, today: string) {
  const qmap: Record<Rating, number> = { again: 1, hard: 3, good: 4, easy: 5 };
  const q = qmap[rating];
  let { ef, interval, reps, lapses } = card;
  if (q < 3) {
    reps = 0; lapses++; interval = 1;
  } else {
    reps++;
    interval = reps === 1 ? 1 : reps === 2 ? (rating === 'easy' ? 4 : 3) : Math.round(interval * ef * (rating === 'hard' ? 0.8 : rating === 'easy' ? 1.3 : 1));
  }
  ef = Math.max(1.3, Math.min(3, ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))));
  return { ef: Math.round(ef * 100) / 100, interval, reps, lapses, due: addDaysIso(today, Math.max(1, interval)) };
}

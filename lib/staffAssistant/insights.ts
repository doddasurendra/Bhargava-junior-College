/**
 * Weak chapters from real test answers: chapters where the student got under 50% of attempted-or-skipped
 * questions right across all their tests, with at least 3 questions seen. Weakest first.
 */
export function weakChapters(results: { byChapter?: Record<string, { right: number; wrong: number; skipped: number }> }[], limit = 5) {
  const tally = new Map<string, { right: number; total: number }>();
  for (const r of results) {
    for (const [chapter, c] of Object.entries(r.byChapter ?? {})) {
      const t = tally.get(chapter) ?? { right: 0, total: 0 };
      t.right += c.right;
      t.total += c.right + c.wrong + c.skipped;
      tally.set(chapter, t);
    }
  }
  return [...tally.entries()]
    .filter(([, t]) => t.total >= 3 && t.right / t.total < 0.5)
    .map(([chapter, t]) => ({ chapter, accuracy: Math.round((t.right / t.total) * 100), questions: t.total }))
    .sort((a, b) => a.accuracy - b.accuracy || b.questions - a.questions)
    .slice(0, limit);
}

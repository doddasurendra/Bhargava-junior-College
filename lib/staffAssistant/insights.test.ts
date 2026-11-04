import { describe, expect, it } from 'vitest';
import { weakChapters } from './insights';

describe('weak chapters', () => {
  it('combines tests, needs 3+ questions, and lists under-50% chapters weakest first', () => {
    const out = weakChapters([
      { byChapter: { Optics: { right: 0, wrong: 2, skipped: 0 }, Kinematics: { right: 3, wrong: 0, skipped: 0 }, Thermo: { right: 1, wrong: 1, skipped: 0 } } },
      { byChapter: { Optics: { right: 1, wrong: 1, skipped: 1 }, Thermo: { right: 0, wrong: 0, skipped: 0 } } },
      {},
    ]);
    expect(out).toEqual([{ chapter: 'Optics', accuracy: 20, questions: 5 }]);
    expect(weakChapters([])).toEqual([]);
  });
});

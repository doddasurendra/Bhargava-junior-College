import { describe, expect, it } from 'vitest';
import { buildTimeline } from './admission';
import { calculateFee, formatINR, scholarshipPercent } from './fees';
import { maskPhone, normalizeIndianMobile } from './phone';
import { bookableDates, validateVisit } from './visits';

describe('phone', () => {
  it('normalises common Indian formats', () => {
    for (const v of ['8143237575', '+91 81432 37575', '918143237575', '08143237575', '0091 8143237575']) {
      expect(normalizeIndianMobile(v)).toBe('+918143237575');
    }
  });
  it('rejects invalid numbers', () => {
    for (const v of ['', '12345', '5143237575', '81432375', 'abcdefghij']) expect(normalizeIndianMobile(v)).toBeNull();
  });
  it('masks', () => expect(maskPhone('+918143237575')).toBe('******7575'));
});

describe('scholarship', () => {
  it('applies slabs', () => {
    expect(scholarshipPercent(null)).toBe(0);
    expect(scholarshipPercent(49)).toBe(0);
    expect(scholarshipPercent(50)).toBe(10);
    expect(scholarshipPercent(69.9)).toBe(20);
    expect(scholarshipPercent(85)).toBe(45);
    expect(scholarshipPercent(90)).toBe(60);
  });
  it('adds the GPA bonus and caps at 60%', () => {
    expect(scholarshipPercent(null, true)).toBe(10);
    expect(scholarshipPercent(75, true)).toBe(40);
    expect(scholarshipPercent(85, true)).toBe(55);
    expect(scholarshipPercent(95, true)).toBe(60);
  });
});

describe('fee calculator', () => {
  it('two-year day scholar, no scholarship', () => {
    const r = calculateFee({ track: 'two-year', stay: 'day', instalments: 1 });
    expect(r.yearOne).toBe(135000 + 15000 + 5000);
    expect(r.yearTwo).toBe(135000 + 15000);
  });
  it('two-year AC hostel with 80% BSAT in 10 instalments', () => {
    const r = calculateFee({ track: 'two-year', stay: 'hostel-ac', bsatScore: 80, instalments: 10 });
    // tuition 135000 - 45% (60750) = 74250; + 15000 + 150000 + 5000
    expect(r.scholarship).toBe(60750);
    expect(r.yearOne).toBe(244250);
    expect(r.perInstalment).toBe(24425);
  });
  it('long term has no second year', () => {
    const r = calculateFee({ track: 'long-term', stay: 'day-transport', instalments: 3 });
    expect(r.yearOne).toBe(110000 + 15000 + 18000 + 5000);
    expect(r.yearTwo).toBeNull();
    expect(r.perInstalment).toBe(Math.ceil(148000 / 3));
  });
  it('rejects unsupported instalment counts', () => {
    expect(calculateFee({ track: 'long-term', stay: 'day', instalments: 7 }).instalments).toBe(1);
  });
  it('formats rupees in Indian grouping', () => expect(formatINR(135000)).toBe('₹1,35,000'));
});

describe('visits', () => {
  // 2026-11-02 is a Monday
  it('skips Sundays and today', () => {
    const dates = bookableDates('2026-11-02', 7);
    expect(dates[0]).toBe('2026-11-03');
    expect(dates).not.toContain('2026-11-08');
  });
  it('validates', () => {
    expect(validateVisit('2026-11-02', '10:00', '2026-11-02')).toMatch(/tomorrow/);
    expect(validateVisit('2026-11-08', '10:00', '2026-11-02')).toMatch(/Sunday/);
    expect(validateVisit('2026-11-07', '15:30', '2026-11-02')).toMatch(/not available/); // Saturday afternoon
    expect(validateVisit('2026-11-07', '10:00', '2026-11-02')).toBeNull();
    expect(validateVisit('2026-12-30', '10:00', '2026-11-02')).toMatch(/30 days/);
  });
});

describe('admission timeline', () => {
  it('marks completed, current and pending steps', () => {
    const t = buildTimeline('visit', [{ stage: 'enquiry', at: '2026-11-01T10:00:00Z', owner: 'Priya' }]);
    expect(t.map((s) => s.status).slice(0, 4)).toEqual(['done', 'done', 'current', 'pending']);
    expect(t[0].owner).toBe('Priya');
    expect(t[2].owner).toBe('Admission counsellor');
  });
});

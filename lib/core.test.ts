import { describe, expect, it } from 'vitest';
import { buildTimeline } from './admission';
import { calculateFee, formatINR, scholarshipPercent } from './fees';
import { maskPhone, normalizeIndianMobile } from './phone';
import { bookableDates, validateVisit } from './visits';
import { defaultContent } from './cms/blocks';
import { jeeRank, likelyColleges, neetRank } from './predictor';

const C = defaultContent();

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
    expect(scholarshipPercent(null, false, C.bsat)).toBe(0);
    expect(scholarshipPercent(49, false, C.bsat)).toBe(0);
    expect(scholarshipPercent(50, false, C.bsat)).toBe(10);
    expect(scholarshipPercent(69.9, false, C.bsat)).toBe(20);
    expect(scholarshipPercent(85, false, C.bsat)).toBe(45);
    expect(scholarshipPercent(90, false, C.bsat)).toBe(60);
  });
  it('adds the GPA bonus and caps at 60%', () => {
    expect(scholarshipPercent(null, true, C.bsat)).toBe(10);
    expect(scholarshipPercent(75, true, C.bsat)).toBe(40);
    expect(scholarshipPercent(85, true, C.bsat)).toBe(55);
    expect(scholarshipPercent(95, true, C.bsat)).toBe(60);
  });
});

describe('fee calculator', () => {
  it('two-year day scholar, no scholarship', () => {
    const r = calculateFee({ track: 'two-year', stay: 'day', instalments: 1 }, C.fees, C.bsat);
    expect(r.yearOne).toBe(135000 + 15000 + 5000);
    expect(r.yearTwo).toBe(135000 + 15000);
  });
  it('two-year AC hostel with 80% BSAT in 10 instalments', () => {
    const r = calculateFee({ track: 'two-year', stay: 'hostel-ac', bsatScore: 80, instalments: 10 }, C.fees, C.bsat);
    // tuition 135000 - 45% (60750) = 74250; + 15000 + 150000 + 5000
    expect(r.scholarship).toBe(60750);
    expect(r.yearOne).toBe(244250);
    expect(r.perInstalment).toBe(24425);
  });
  it('long term has no second year', () => {
    const r = calculateFee({ track: 'long-term', stay: 'day-transport', instalments: 3 }, C.fees, C.bsat);
    expect(r.yearOne).toBe(110000 + 15000 + 18000 + 5000);
    expect(r.yearTwo).toBeNull();
    expect(r.perInstalment).toBe(Math.ceil(148000 / 3));
  });
  it('rejects unsupported instalment counts', () => {
    expect(calculateFee({ track: 'long-term', stay: 'day', instalments: 7 }, C.fees, C.bsat).instalments).toBe(1);
  });
  it('formats rupees in Indian grouping', () => expect(formatINR(135000)).toBe('₹1,35,000'));
  it('uses the fees and slabs from the CMS, not hard-coded ones', () => {
    const fees = { ...C.fees, twoYear: { ...C.fees.twoYear, tuition: 100000 } };
    const bsat = { ...C.bsat, slabs: [{ min: 50, label: '50%+', pct: 25 }] };
    const r = calculateFee({ track: 'two-year', stay: 'day', bsatScore: 55, instalments: 1 }, fees, bsat);
    expect(r.scholarship).toBe(25000);
    expect(r.yearOne).toBe(100000 - 25000 + 15000 + 5000);
  });
});

describe('visits', () => {
  // 2026-11-02 is a Monday
  it('skips Sundays and today', () => {
    const dates = bookableDates(C.visitSlots, '2026-11-02', 7);
    expect(dates[0]).toBe('2026-11-03');
    expect(dates).not.toContain('2026-11-08');
  });
  it('validates', () => {
    expect(validateVisit('2026-11-02', '10:00', C.visitSlots, '2026-11-02')).toMatch(/tomorrow/);
    expect(validateVisit('2026-11-08', '10:00', C.visitSlots, '2026-11-02')).toMatch(/Sunday/);
    expect(validateVisit('2026-11-07', '15:30', C.visitSlots, '2026-11-02')).toMatch(/not available/); // Saturday afternoon
    expect(validateVisit('2026-11-07', '10:00', C.visitSlots, '2026-11-02')).toBeNull();
    expect(validateVisit('2026-12-30', '10:00', C.visitSlots, '2026-11-02')).toMatch(/30 days/);
  });
});

describe('rank & college predictor', () => {
  it('turns a JEE percentile into an approximate rank band', () => {
    const r = jeeRank(99, C.predictor)!;
    expect(r.estimate).toBe(12000);
    expect(r.from).toBeLessThan(12000);
    expect(r.to).toBeGreaterThan(12000);
    expect(jeeRank(101, C.predictor)).toBeNull();
    expect(jeeRank(100, C.predictor)!.estimate).toBe(1);
  });
  it('maps a NEET score to its band and lists reachable colleges', () => {
    expect(neetRank(655, C.predictor)).toMatchObject({ from: 1500, to: 6000 });
    expect(neetRank(720, C.predictor)!.from).toBe(1);
    expect(neetRank(800, C.predictor)).toBeNull();
    expect(likelyColleges('neet', 1500, C.predictor).map((c) => c.maxRank)).toEqual([2000, 25000, 100000]);
    expect(likelyColleges('jee', 500000, C.predictor)).toEqual([]);
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

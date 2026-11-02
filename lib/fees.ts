import { bsat as bsatData, fees as feeData, type BsatData, type FeeData } from '@/content/sample';
import type { Track } from '@/content/programs';

export type Stay = 'day' | 'day-transport' | 'hostel-nonac' | 'hostel-ac';

export const STAY_OPTIONS: { value: Stay; label: string; hint: string }[] = [
  { value: 'day', label: 'Day scholar', hint: 'Own transport' },
  { value: 'day-transport', label: 'Day scholar + bus', hint: 'College transport' },
  { value: 'hostel-nonac', label: 'Hostel non-AC', hint: '4-sharing, incl. food' },
  { value: 'hostel-ac', label: 'Hostel AC', hint: '3-sharing, incl. food' },
];

export interface FeeInput {
  track: Track;
  stay: Stay;
  /** BSAT percentage (0–100). null/undefined = not taken. */
  bsatScore?: number | null;
  ssc10Gpa?: boolean;
  instalments: number;
}

export interface FeeLine {
  label: string;
  amount: number;
  kind?: 'discount' | 'one-time';
}

export function scholarshipPercent(score: number | null | undefined, ssc10Gpa = false, data: BsatData = bsatData): number {
  let pct = 0;
  if (typeof score === 'number' && Number.isFinite(score)) {
    pct = data.slabs.find((s) => score >= s.min)?.pct ?? 0;
  }
  if (ssc10Gpa) pct += data.gpaBonus;
  return Math.min(pct, data.cap);
}

export function stayFee(stay: Stay, data: FeeData = feeData): { label: string; amount: number } | null {
  switch (stay) {
    case 'hostel-ac':
      return { label: 'Hostel AC (incl. food)', amount: data.hostelAc };
    case 'hostel-nonac':
      return { label: 'Hostel non-AC (incl. food)', amount: data.hostelNonAc };
    case 'day-transport':
      return { label: 'Transport', amount: data.transport };
    default:
      return null;
  }
}

export function calculateFee(input: FeeInput, data: FeeData = feeData) {
  const base = input.track === 'two-year' ? data.twoYear : data.longTerm;
  const scholarshipPct = scholarshipPercent(input.bsatScore, input.ssc10Gpa);
  const scholarship = Math.round((base.tuition * scholarshipPct) / 100);
  const stay = stayFee(input.stay, data);

  const lines: FeeLine[] = [{ label: 'Tuition', amount: base.tuition }];
  if (scholarship > 0) lines.push({ label: `BSAT scholarship (${scholarshipPct}% of tuition)`, amount: -scholarship, kind: 'discount' });
  lines.push({ label: 'Study material & test series', amount: base.material });
  if (stay) lines.push(stay);
  lines.push({ label: 'Admission fee (one time)', amount: base.admission, kind: 'one-time' });

  const recurring = base.tuition - scholarship + base.material + (stay?.amount ?? 0);
  const yearOne = recurring + base.admission;
  const yearTwo = input.track === 'two-year' ? recurring : null;
  const instalments = data.instalmentOptions.includes(input.instalments) ? input.instalments : 1;

  return {
    lines,
    scholarshipPct,
    scholarship,
    yearOne,
    yearTwo,
    total: yearOne + (yearTwo ?? 0),
    instalments,
    perInstalment: Math.ceil(yearOne / instalments),
  };
}

export function formatINR(amount: number): string {
  const sign = amount < 0 ? '−' : '';
  return `${sign}₹${Math.abs(amount).toLocaleString('en-IN')}`;
}

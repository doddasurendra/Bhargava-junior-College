export const PROGRAM_SLUGS = ['iit-jee', 'neet', 'long-term-jee', 'long-term-neet'] as const;
export type ProgramSlug = (typeof PROGRAM_SLUGS)[number];
export type Track = 'two-year' | 'long-term';

export interface Program {
  slug: ProgramSlug;
  name: string;
  short: string;
  goal: 'Engineering' | 'Medical';
  track: Track;
  duration: string;
  targets: string[];
  subjects: string[];
  summary: string;
  /** Sample copy until confirmed by the college (shown with a Sample badge). */
  eligibility: string;
  batchTimings: string;
}

export const programIncludes = [
  'Daily practice papers (DPPs)',
  'Weekly tests',
  'Full-length mock test series',
  'NCERT-based study material',
  'Periodic progress tracking',
];

export const programs: Program[] = [
  {
    slug: 'iit-jee',
    name: 'IIT-JEE Integrated',
    short: 'IIT-JEE',
    goal: 'Engineering',
    track: 'two-year',
    duration: '2 years',
    targets: ['JEE Main', 'JEE Advanced', 'TS Intermediate Board (MPC)'],
    subjects: ['Mathematics', 'Physics', 'Chemistry'],
    summary:
      'Two years of Intermediate (MPC) with integrated preparation for JEE Main and JEE Advanced, for students aiming at IITs, NITs and top engineering colleges.',
    eligibility: 'Students who have passed or are appearing for Class 10 (SSC, CBSE or ICSE).',
    batchTimings: 'Classes 8:30 AM – 5:30 PM, with a doubt clinic in the afternoon.',
  },
  {
    slug: 'neet',
    name: 'NEET UG Integrated',
    short: 'NEET',
    goal: 'Medical',
    track: 'two-year',
    duration: '2 years',
    targets: ['NEET UG', 'TS Intermediate Board (BiPC)'],
    subjects: ['Physics', 'Chemistry', 'Botany', 'Zoology'],
    summary:
      'Two years of Intermediate (BiPC) with integrated NEET UG preparation, for students aiming at MBBS, BDS and allied medical courses.',
    eligibility: 'Students who have passed or are appearing for Class 10 (SSC, CBSE or ICSE).',
    batchTimings: 'Classes 8:30 AM – 5:30 PM, with a doubt clinic in the afternoon.',
  },
  {
    slug: 'long-term-jee',
    name: 'Long Term IIT-JEE',
    short: 'Long Term JEE',
    goal: 'Engineering',
    track: 'long-term',
    duration: '1 year',
    targets: ['JEE Main', 'JEE Advanced'],
    subjects: ['Mathematics', 'Physics', 'Chemistry'],
    summary: 'A focused one-year repeater program for students who have completed Intermediate / Class 12 and want another serious attempt at JEE.',
    eligibility: 'Students who have completed Intermediate / Class 12 with MPC.',
    batchTimings: 'Classes 8:30 AM – 5:30 PM, with a doubt clinic in the afternoon.',
  },
  {
    slug: 'long-term-neet',
    name: 'Long Term NEET UG',
    short: 'Long Term NEET',
    goal: 'Medical',
    track: 'long-term',
    duration: '1 year',
    targets: ['NEET UG'],
    subjects: ['Physics', 'Chemistry', 'Botany', 'Zoology'],
    summary: 'A focused one-year repeater program for students who have completed Intermediate / Class 12 and want another serious attempt at NEET UG.',
    eligibility: 'Students who have completed Intermediate / Class 12 with BiPC.',
    batchTimings: 'Classes 8:30 AM – 5:30 PM, with a doubt clinic in the afternoon.',
  },
];

export function getProgram(slug: string): Program | undefined {
  return programs.find((p) => p.slug === slug);
}

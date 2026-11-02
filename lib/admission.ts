/** Admission journey shown to parents on "Track your admission" (brief §6.3, §7.4). */
export const STAGES = [
  { key: 'enquiry', label: 'Enquiry received', owner: 'Admissions team' },
  { key: 'visit', label: 'Campus visit', owner: 'Front desk' },
  { key: 'counselling', label: 'Admission counselling', owner: 'Admission counsellor' },
  { key: 'application', label: 'Application completed', owner: 'Admission counsellor' },
  { key: 'documents', label: 'Documents verified', owner: 'Admission office' },
  { key: 'fee', label: 'Fee payment confirmed', owner: 'Accounts' },
  { key: 'receipt', label: 'Official receipt issued', owner: 'Accounts' },
  { key: 'student_record', label: 'Student record created', owner: 'Admin office' },
  { key: 'college_id', label: 'College ID issued', owner: 'Admin office' },
] as const;

export type StageKey = (typeof STAGES)[number]['key'];
export type StageStatus = 'done' | 'current' | 'pending';

export interface StageEvent {
  stage: StageKey;
  at: string | null;
  owner: string | null;
}

export interface TimelineStep {
  key: StageKey;
  label: string;
  status: StageStatus;
  at: string | null;
  owner: string;
}

/**
 * `completed` is the latest stage that has been completed (leads start at 'enquiry').
 * Steps up to it are done, the next one is current, the rest are pending.
 */
export function buildTimeline(completed: StageKey, events: StageEvent[]): TimelineStep[] {
  const idx = STAGES.findIndex((s) => s.key === completed);
  return STAGES.map((s, i) => {
    const ev = events.find((e) => e.stage === s.key);
    return {
      key: s.key,
      label: s.label,
      status: i <= idx ? 'done' : i === idx + 1 ? 'current' : 'pending',
      at: ev?.at ?? null,
      owner: ev?.owner ?? s.owner,
    };
  });
}

/** Show staff by first name only on public pages. */
export function firstName(full: string | null | undefined): string | null {
  return full ? full.trim().split(/\s+/)[0] : null;
}

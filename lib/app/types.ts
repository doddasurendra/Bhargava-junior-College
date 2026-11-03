import type { StudentRow } from '../crm/verification';

export const RELATIONS = ['father', 'mother', 'guardian', 'other'] as const;
export type Relation = (typeof RELATIONS)[number];

export interface Guardian {
  studentId: string;
  phone: string;
  name: string;
  relation: Relation;
  addedBy: string | null;
  addedAt: string;
}

export interface HostelEvent {
  id: string;
  studentId: string;
  direction: 'in' | 'out';
  at: string;
  device: string;
  deviceEventId: string;
  alerted: number;
}

/** A thing this phone can see in the app. One phone can hold several (two children, or a child plus a sibling's application). */
export type Profile =
  | { key: string; kind: 'parent'; studentId: string; leadId: string; name: string; collegeId: string; relation: Relation }
  | { key: string; kind: 'student'; studentId: string; leadId: string; name: string; collegeId: string }
  | { key: string; kind: 'applicant'; leadId: string; name: string };

export interface AppStore {
  getStudent(id: string): Promise<StudentRow | null>;
  studentByCollegeId(collegeId: string): Promise<StudentRow | null>;
  /** students with an issued College ID whose own login phone is this number */
  studentsByLoginPhone(phone: string): Promise<StudentRow[]>;
  guardiansByPhone(phone: string): Promise<Guardian[]>;
  guardiansOf(studentId: string): Promise<Guardian[]>;
  addGuardian(g: Omit<Guardian, 'addedAt'>): Promise<'added' | 'exists'>;
  removeGuardian(studentId: string, phone: string): Promise<void>;
  /** leads (applications) on this phone or student phone that have no College ID yet */
  applicationsByPhone(phone: string): Promise<{ leadId: string; name: string }[]>;
  /** false if (device, deviceEventId) was already recorded */
  addHostelEvent(e: Omit<HostelEvent, 'id' | 'alerted'>): Promise<HostelEvent | null>;
  markAlerted(id: string, n: number): Promise<void>;
  hostelEvents(studentId: string, limit?: number): Promise<HostelEvent[]>;
}

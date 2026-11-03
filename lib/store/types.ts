import type { StageKey, StageEvent } from '../admission';
import type { Attribution, LeadSource } from '../validation';
import type { ProgramSlug } from '@/content/programs';

export interface LeadInput {
  name: string;
  studentName?: string;
  /** E.164, already normalised */
  phone: string;
  studentClass?: string;
  program?: ProgramSlug;
  source: LeadSource;
  note?: string;
  consent: true;
  attribution?: Attribution;
}

export interface VisitInput extends Omit<LeadInput, 'source'> {
  date: string;
  slot: string;
  familySize: number;
}

export interface BsatInput extends Omit<LeadInput, 'source'> {
  stream: 'MPC' | 'BiPC';
  sessionId: string;
}

export interface AdmissionRecord {
  studentName: string | null;
  contactName: string | null;
  program: string | null;
  completedStage: StageKey;
  events: StageEvent[];
  owner: string | null;
  nextUpdate: string | null;
  upcomingVisit: { date: string; slot: string } | null;
}

export interface OtpRecord {
  phone: string;
  codeHash: string;
  expiresAt: string;
  attempts: number;
  consumed: boolean;
}

export class StoreError extends Error {
  constructor(public code: 'slot_full' | 'session_full' | 'invalid_slot' | 'invalid_session' | 'closed_day') {
    super(code);
  }
}

export interface Store {
  /** Create or merge (by phone) a lead and record the touchpoint. */
  captureLead(input: LeadInput): Promise<{ leadId: string; isNew: boolean }>;
  /** Active bookings per slot on a date. */
  slotBookings(date: string): Promise<Record<string, number>>;
  createVisit(input: VisitInput): Promise<{ visitId: string }>;
  registerBsat(input: BsatInput): Promise<{ hallTicket: string; alreadyRegistered: boolean }>;
  /** The family's admissions for a parent phone: the primary lead, then siblings. Empty if unknown. */
  findAdmissions(phone: string): Promise<AdmissionRecord[]>;
  putOtp(rec: OtpRecord): Promise<void>;
  getOtp(phone: string): Promise<OtpRecord | null>;
  patchOtp(phone: string, patch: Partial<OtpRecord>): Promise<void>;
}

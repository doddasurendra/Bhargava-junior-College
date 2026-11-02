import type { StageKey } from '../admission';
import type { ImportRecord } from './importer';

export const ROLES = [
  'super_admin',
  'management',
  'principal',
  'admission_manager',
  'data_executive',
  'telecaller',
  'admission_counsellor',
  'front_desk',
  'admission_office',
  'accounts',
  'admin_office',
  'academic_coordinator',
  'class_teacher',
  'faculty',
  'hostel_warden',
  'transport_incharge',
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  management: 'Management',
  principal: 'Principal',
  admission_manager: 'Admission Manager',
  data_executive: 'Data / Marketing',
  telecaller: 'Telecaller',
  admission_counsellor: 'Admission Counsellor',
  front_desk: 'Front Desk',
  admission_office: 'Admission Office',
  accounts: 'Accounts',
  admin_office: 'Admin Office',
  academic_coordinator: 'Academic Coordinator',
  class_teacher: 'Class Teacher / Mentor',
  faculty: 'Faculty',
  hostel_warden: 'Hostel Warden',
  transport_incharge: 'Transport In-charge',
};

export const LEAD_CATEGORIES = ['hot', 'warm', 'cold', 'invalid'] as const;
export type LeadCategory = (typeof LEAD_CATEGORIES)[number];

export const LEAD_STATUSES = ['open', 'visit_scheduled', 'visited', 'counselled', 'decision_pending', 'confirmed', 'lost', 'admitted', 'invalid'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const STATUS_LABELS: Record<LeadStatus, string> = {
  open: 'Open',
  visit_scheduled: 'Visit scheduled',
  visited: 'Visited',
  counselled: 'Counselled',
  decision_pending: 'Decision pending',
  confirmed: 'Confirmed',
  lost: 'Lost',
  admitted: 'Admitted',
  invalid: 'Invalid',
};

/** Closed leads need no follow-up date (brief §7.1 step 4). */
export const CLOSED_STATUSES: LeadStatus[] = ['lost', 'invalid', 'admitted'];

export const CALL_OUTCOMES = [
  { value: 'connected', label: 'Connected' },
  { value: 'not_answered', label: 'Not answered' },
  { value: 'busy', label: 'Busy' },
  { value: 'switched_off', label: 'Switched off' },
  { value: 'wrong_number', label: 'Wrong number' },
] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number]['value'];

export const LOST_REASONS = [
  { value: 'fees', label: 'Fees' },
  { value: 'distance', label: 'Distance' },
  { value: 'competitor', label: 'Chose a competitor' },
  { value: 'hostel', label: 'Hostel' },
  { value: 'results_doubt', label: 'Doubts about results' },
  { value: 'other', label: 'Other' },
] as const;
export type LostReason = (typeof LOST_REASONS)[number]['value'];

export interface Staff {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  roles: Role[];
  active: boolean;
}

export interface CrmLead {
  id: string;
  phone: string;
  contactName: string | null;
  parentName: string | null;
  studentName: string | null;
  studentPhone: string | null;
  school: string | null;
  classLevel: string | null;
  board: string | null;
  area: string | null;
  program: string | null;
  category: LeadCategory | null;
  status: LeadStatus;
  stage: StageKey;
  ownerId: string | null;
  /** when the current owner was assigned (starts the follow-up clock for imported leads) */
  assignedAt: string | null;
  firstSource: string;
  lastSource: string;
  nextFollowUpAt: string | null;
  lastContactAt: string | null;
  lostReason: string | null;
  lostCompetitor: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CallLog {
  id: string;
  leadId: string;
  actorId: string;
  outcome: CallOutcome;
  interest: LeadCategory | null;
  notes: string | null;
  nextFollowUpAt: string | null;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  leadId: string;
  actorId: string | null;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  at: string;
}
export type AuditInput = Pick<AuditEntry, 'action'> & Partial<Pick<AuditEntry, 'actorId' | 'field' | 'oldValue' | 'newValue' | 'reason'>>;

export interface Touchpoint {
  id: string;
  leadId: string;
  source: string;
  program: string | null;
  note: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  page: string | null;
  device: string | null;
  createdAt: string;
}

export const VISIT_STATUSES = ['scheduled', 'arrived', 'no_show', 'completed', 'cancelled'] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export interface VisitRow {
  id: string;
  leadId: string;
  date: string;
  slot: string;
  familySize: number;
  program: string | null;
  status: VisitStatus;
  outcome: string | null;
  outcomeAt: string | null;
  outcomeBy: string | null;
  createdAt: string;
}

export type LeadPatch = Partial<Pick<CrmLead, 'category' | 'status' | 'stage' | 'ownerId' | 'assignedAt' | 'nextFollowUpAt' | 'lastContactAt' | 'lostReason' | 'lostCompetitor'>>;
export type VisitPatch = Partial<Pick<VisitRow, 'status' | 'outcome' | 'outcomeAt' | 'outcomeBy'>>;

export interface LeadFilter {
  ownerId?: string;
  unassigned?: boolean;
  category?: LeadCategory | 'none';
  status?: LeadStatus;
  program?: string;
  source?: string;
  q?: string;
  ids?: string[];
  limit?: number;
}

export interface LeadHistory {
  touchpoints: Touchpoint[];
  calls: CallLog[];
  audit: AuditEntry[];
  visits: VisitRow[];
}

export interface ImportMeta {
  fileName: string;
  source: string;
  actorId: string;
  totalRows: number;
  invalid: number;
  duplicatesInFile: number;
}

export interface ImportBatch extends ImportMeta {
  id: string;
  created: number;
  merged: number;
  createdAt: string;
}

/** Storage primitives. Business rules live in ./service.ts. */
export interface CrmRepo {
  /** Which of these phones already belong to an active lead (as its phone or student phone). */
  findExistingPhones(phones: string[]): Promise<Set<string>>;
  /** Create new leads or merge into existing ones (fill blanks only), recording one import batch. */
  importLeads(records: ImportRecord[], meta: ImportMeta): Promise<{ batchId: string; created: number; merged: number }>;
  listImportBatches(limit?: number): Promise<ImportBatch[]>;
  listStaff(): Promise<Staff[]>;
  getStaff(id: string): Promise<Staff | null>;
  listLeads(filter: LeadFilter): Promise<CrmLead[]>;
  getLead(id: string): Promise<CrmLead | null>;
  getLeadHistory(id: string): Promise<LeadHistory>;
  updateLead(id: string, patch: LeadPatch, audit: AuditInput[]): Promise<void>;
  addCall(call: Omit<CallLog, 'id' | 'createdAt'>): Promise<void>;
  listVisits(filter: { from?: string; to?: string; statuses?: VisitStatus[] }): Promise<VisitRow[]>;
  getVisit(id: string): Promise<VisitRow | null>;
  updateVisit(id: string, patch: VisitPatch, audit: AuditInput[]): Promise<void>;
}

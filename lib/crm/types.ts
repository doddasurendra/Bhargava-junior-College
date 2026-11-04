import type { StageKey } from '../admission';
import type { ImportRecord } from './importer';
import type { DocStatus, PaymentRow, ReversalRow, StudentRow, VerificationRecord, VerifyStage } from './verification';

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
export type BuiltinRole = (typeof ROLES)[number];
/** Built-in roles, plus custom roles the Super Admin creates (§9A.1 admin console), keyed custom_<slug>. */
export type Role = BuiltinRole | `custom_${string}`;

/** Labels for display. Custom role labels are added at runtime by lib/crm/rbac.ts. */
export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  management: 'Management / Chairman',
  principal: 'Principal',
  admission_manager: 'Admission Manager',
  data_executive: 'Content & Marketing',
  telecaller: 'Telecaller',
  admission_counsellor: 'Admission Counsellor',
  front_desk: 'Front Desk',
  admission_office: 'Admission Office',
  accounts: 'Accounts',
  admin_office: 'Admin Office',
  academic_coordinator: 'Academic Coordinator / Exam Cell',
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
  /** For the signed-in user: just the active role (see `allRoles`). From the repo: every role. */
  roles: Role[];
  active: boolean;
  /** Signed-in user only: every role they hold, for the role switcher. */
  allRoles?: Role[];
  /** Signed-in user only: effective permissions of the active role (editable matrix). */
  perms?: string[];
  /** Signed-in user only: set while a Super Admin is viewing as this user (read-only). */
  viewedBy?: string;
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
  /** set on a sibling's lead: the family's primary lead (same parent phone). Primary leads have null. */
  siblingOf: string | null;
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

export interface SiblingInput {
  studentName: string;
  classLevel: string | null;
  program: string | null;
  school: string | null;
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

/** Thrown by a repo when a write conflicts with current state (already signed off, gate not met…). */
export class RepoConflict extends Error {}

export interface VerifyRepo {
  getVerification(leadId: string): Promise<VerificationRecord>;
  /** Atomic: record the sign-off, advance the lead's stage, audit. Throws RepoConflict if already signed off. */
  signOffStage(leadId: string, stage: VerifyStage, actorId: string, note: string | null): Promise<void>;
  setDocument(leadId: string, key: string, status: DocStatus, note: string | null, actorId: string): Promise<void>;
  addPayment(p: Omit<PaymentRow, 'id' | 'recordedAt' | 'receiptNo' | 'receiptAt'>): Promise<string>;
  getPayment(id: string): Promise<PaymentRow | null>;
  /** Only from pending_approval. */
  decidePayment(id: string, approve: boolean, actorId: string): Promise<void>;
  /** Atomic: number every approved payment without a receipt, sign off 'receipt'. Returns the numbers issued. */
  issueReceipts(leadId: string, actorId: string): Promise<string[]>;
  /** Atomic: create the student record and sign off 'student_record'. */
  createStudent(leadId: string, s: Omit<StudentRow, 'id' | 'leadId' | 'collegeId' | 'createdAt' | 'createdBy'>, actorId: string): Promise<void>;
  /** Atomic: re-check the gate, take the next number, set the College ID, mark the lead admitted, sign off. */
  issueCollegeId(leadId: string, actorId: string): Promise<string>;
  /** One pending request per lead + stage; the stage must be signed off. */
  requestReversal(leadId: string, stage: VerifyStage, reason: string, actorId: string): Promise<string>;
  getReversal(id: string): Promise<ReversalRow | null>;
  /**
   * Atomic. Approve: clear the stage and its signed dependents (reversalCascade), delete the student record if
   * 'student_record' is cleared, recompute the lead's stage, audit. Reject: just record the decision.
   */
  decideReversal(id: string, approve: boolean, actorId: string, note: string | null): Promise<VerifyStage[]>;
}

/** Storage primitives. Business rules live in ./service.ts. */
export interface CrmRepo extends VerifyRepo {
  /** Which of these phones already belong to an active lead (as its phone or student phone). */
  findExistingPhones(phones: string[]): Promise<Set<string>>;
  /** Create new leads or merge into existing ones (fill blanks only), recording one import batch. */
  importLeads(records: ImportRecord[], meta: ImportMeta): Promise<{ batchId: string; created: number; merged: number }>;
  listImportBatches(limit?: number): Promise<ImportBatch[]>;
  /** The family of a lead: its primary lead first, then siblings in creation order. */
  familyOf(leadId: string): Promise<CrmLead[]>;
  /** A sibling's lead under the family's primary lead, sharing the parent phone. */
  createSibling(primaryId: string, s: SiblingInput, actorId: string): Promise<string>;
  /**
   * Everything the management dashboard needs: all active leads (current state), and calls, audit entries,
   * sign-offs since `sinceIso`, plus visits created since then or still awaiting an outcome.
   */
  exportForMetrics(sinceIso: string): Promise<{
    leads: CrmLead[];
    calls: CallLog[];
    audit: AuditEntry[];
    visits: VisitRow[];
    signOffs: { leadId: string; stage: string; at: string }[];
    /** approved payments, approved since `sinceIso` */
    payments: { leadId: string; amount: number; approvedAt: string }[];
    /** every student with a College ID (for seats filled vs target) */
    admitted: { leadId: string; program: string; collegeId: string }[];
  }>;
  /** active staff only */
  listStaff(): Promise<Staff[]>;
  /** including deactivated — for the staff admin page */
  listAllStaff(): Promise<Staff[]>;
  getStaff(id: string): Promise<Staff | null>;
  /** Create or update profile + roles together. Throws if no active Super Admin would remain. */
  saveStaff(s: Staff): Promise<void>;
  listLeads(filter: LeadFilter): Promise<CrmLead[]>;
  getLead(id: string): Promise<CrmLead | null>;
  getLeadHistory(id: string): Promise<LeadHistory>;
  updateLead(id: string, patch: LeadPatch, audit: AuditInput[]): Promise<void>;
  addCall(call: Omit<CallLog, 'id' | 'createdAt'>): Promise<void>;
  listVisits(filter: { from?: string; to?: string; statuses?: VisitStatus[] }): Promise<VisitRow[]>;
  getVisit(id: string): Promise<VisitRow | null>;
  updateVisit(id: string, patch: VisitPatch, audit: AuditInput[]): Promise<void>;
}

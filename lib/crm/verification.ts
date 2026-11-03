/** Admission verification checkpoint (brief §7.4). Pure rules — unit tested in verification.test.ts. */
import type { ChecklistItem } from '@/content/sample';
import type { Content } from '../cms/blocks';

/** Live checklist and numbering come from the CMS (getContent / cmsBlock). */
export type ChecklistCfg = Content['documentChecklist'];
export type NumberingCfg = Content['numbering'];
import type { LeadStatus, Role, Staff } from './types';

export const VERIFY_STEPS = [
  { stage: 'application', label: 'Application completed', owner: 'Admission counsellor', roles: ['admission_counsellor', 'admission_manager'] },
  { stage: 'documents', label: 'Documents verified', owner: 'Admission office', roles: ['admission_office'] },
  { stage: 'fee', label: 'Fee payment confirmed', owner: 'Accounts', roles: ['accounts'] },
  { stage: 'receipt', label: 'Official receipt generated', owner: 'Accounts', roles: ['accounts'] },
  { stage: 'student_record', label: 'Student record created', owner: 'Admin office', roles: ['admin_office'] },
  { stage: 'college_id', label: 'College ID generated', owner: 'Admin office', roles: ['admin_office'] },
] as const satisfies readonly { stage: string; label: string; owner: string; roles: readonly Role[] }[];

export type VerifyStage = (typeof VERIFY_STEPS)[number]['stage'];
export const GATE_STAGES: VerifyStage[] = ['application', 'documents', 'fee', 'receipt', 'student_record'];

export const DOC_STATUSES = ['pending', 'received', 'verified', 'not_applicable', 'rejected'] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

export interface DocRow {
  key: string;
  status: DocStatus;
  note: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
}

export type PaymentStatus = 'pending_approval' | 'approved' | 'rejected';

export interface PaymentRow {
  id: string;
  leadId: string;
  amount: number;
  mode: string;
  reference: string | null;
  paidOn: string;
  status: PaymentStatus;
  recordedBy: string;
  recordedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  receiptNo: string | null;
  receiptAt: string | null;
}

export interface StudentRow {
  id: string;
  leadId: string;
  fullName: string;
  dob: string;
  gender: 'female' | 'male' | 'other';
  program: string;
  stay: 'day' | 'hostel';
  guardianName: string;
  guardianPhone: string;
  /** the student's own mobile, for the student login (optional) */
  loginPhone?: string | null;
  collegeId: string | null;
  createdBy: string;
  createdAt: string;
}

export interface StageSignOff {
  stage: VerifyStage;
  signedOffBy: string;
  at: string;
  note: string | null;
}

export interface ReversalRow {
  id: string;
  leadId: string;
  stage: VerifyStage;
  reason: string;
  requestedBy: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
}

export interface VerificationRecord {
  signOffs: StageSignOff[];
  documents: DocRow[];
  payments: PaymentRow[];
  student: StudentRow | null;
  reversals: ReversalRow[];
}

// ---------------------------------------------------------------- reversals

/** Reversal of a wrong sign-off: requested by the step owner or a manager, approved by a *different* manager. */
export const REVERSAL_APPROVERS: Role[] = ['super_admin', 'management', 'admission_manager'];
const DEPENDENTS: Partial<Record<VerifyStage, VerifyStage[]>> = { application: ['student_record'], fee: ['receipt'] };

/**
 * Stages cleared when `stage` is reversed: the stage itself plus signed stages that were built on it.
 * Throws once a College ID exists. Withdrawing an admission is a separate process.
 */
export function reversalCascade(stage: VerifyStage, signed: VerifyStage[]): VerifyStage[] {
  if (stage === 'college_id' || signed.includes('college_id')) throw new Error('A College ID has been issued; sign-offs can no longer be reversed.');
  if (!signed.includes(stage)) throw new Error('That step is not signed off.');
  return [stage, ...(DEPENDENTS[stage] ?? []).filter((s) => signed.includes(s))];
}

export const canRequestReversal = (user: Pick<Staff, 'roles'>, stage: VerifyStage) => stage !== 'college_id' && (canSignOff(user, stage) || user.roles.some((r) => REVERSAL_APPROVERS.includes(r)));

export const canApproveReversal = (user: Pick<Staff, 'id' | 'roles'>, r: Pick<ReversalRow, 'requestedBy' | 'status'>) =>
  r.status === 'pending' && r.requestedBy !== user.id && user.roles.some((x) => REVERSAL_APPROVERS.includes(x));

export const VERIFY_STATUSES: LeadStatus[] = ['confirmed', 'admitted'];

export function checklistFor(program: string | null, cfg: ChecklistCfg): ChecklistItem[] {
  return (program && cfg.byProgram[program]) || cfg.default;
}

export function canSignOff(user: Pick<Staff, 'roles'>, stage: VerifyStage): boolean {
  const step = VERIFY_STEPS.find((s) => s.stage === stage)!;
  return user.roles.some((r) => (step.roles as readonly Role[]).includes(r));
}

/** Documents outstanding: required items must be verified; "if applicable" items verified or marked N/A. */
export function outstandingDocuments(checklist: ChecklistItem[], docs: DocRow[]): ChecklistItem[] {
  return checklist.filter((item) => {
    const s = docs.find((d) => d.key === item.key)?.status ?? 'pending';
    return item.required ? s !== 'verified' : s !== 'verified' && s !== 'not_applicable';
  });
}

export interface StepState {
  stage: VerifyStage;
  label: string;
  owner: string;
  done: StageSignOff | null;
  blockers: string[];
}

export function stepStates(leadStatus: LeadStatus, program: string | null, v: VerificationRecord, cfg: { checklist: ChecklistCfg; numbering: NumberingCfg }): StepState[] {
  const signed = (s: VerifyStage) => v.signOffs.find((x) => x.stage === s) ?? null;
  const approved = v.payments.filter((p) => p.status === 'approved');
  const pending = v.payments.filter((p) => p.status === 'pending_approval');

  return VERIFY_STEPS.map((step) => {
    const blockers: string[] = [];
    switch (step.stage) {
      case 'application':
        if (!VERIFY_STATUSES.includes(leadStatus)) blockers.push('The admission decision must be Confirmed first.');
        break;
      case 'documents':
        for (const d of outstandingDocuments(checklistFor(program, cfg.checklist), v.documents)) blockers.push(`${d.label}: not yet ${d.required ? 'verified' : 'verified or marked N/A'}`);
        break;
      case 'fee':
        if (approved.length === 0) blockers.push('No approved payment yet.');
        if (pending.length > 0) blockers.push(`${pending.length} payment${pending.length === 1 ? '' : 's'} awaiting Accounts approval.`);
        break;
      case 'receipt':
        if (!signed('fee')) blockers.push('Fee payment must be confirmed first.');
        break;
      case 'student_record':
        if (!signed('application')) blockers.push('The application must be completed first.');
        break;
      case 'college_id':
        for (const s of GATE_STAGES) if (!signed(s)) blockers.push(`${VERIFY_STEPS.find((x) => x.stage === s)!.label}: not signed off`);
        if (v.student && !cfg.numbering.collegeId.programCodes[v.student.program]) blockers.push('The student record has no valid program.');
        break;
    }
    return { stage: step.stage, label: step.label, owner: step.owner, done: signed(step.stage), blockers };
  });
}

export function formatCollegeId(program: string, seq: number, cfg: NumberingCfg['collegeId']): string {
  const code = cfg.programCodes[program];
  if (!code) throw new Error(`No College ID code for program ${program}`);
  return cfg.template
    .replace('{YEAR}', String(cfg.year))
    .replace('{PROGRAM}', code)
    .replace('{SEQ}', String(seq).padStart(cfg.seqDigits, '0'));
}

export const collegeIdCounterKey = (program: string, cfg: NumberingCfg['collegeId']) => `college_id:${cfg.year}:${cfg.programCodes[program]}`;

export function formatReceiptNo(seq: number, cfg: NumberingCfg['receipt']): string {
  return `${cfg.prefix}/${cfg.academicYear}/${String(seq).padStart(cfg.seqDigits, '0')}`;
}

export const receiptCounterKey = (cfg: NumberingCfg['receipt']) => `receipt:${cfg.academicYear}`;

/** Amount in words for the receipt (Indian numbering). */
export function rupeesInWords(n: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x: number) => (x < 20 ? ones[x] : `${tens[Math.floor(x / 10)]}${x % 10 ? ` ${ones[x % 10]}` : ''}`);
  const three = (x: number) => (x >= 100 ? `${ones[Math.floor(x / 100)]} Hundred${x % 100 ? ` ${two(x % 100)}` : ''}` : two(x));
  if (!Number.isInteger(n) || n < 0) throw new Error('amount must be a non-negative integer');
  if (n === 0) return 'Rupees Zero Only';
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7);
  const lakh = Math.floor((n % 1e7) / 1e5);
  const thousand = Math.floor((n % 1e5) / 1e3);
  const rest = n % 1e3;
  if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (rest) parts.push(three(rest));
  return `Rupees ${parts.join(' ')} Only`;
}

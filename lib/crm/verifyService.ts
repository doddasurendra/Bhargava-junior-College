import 'server-only';
import { PAYMENT_MODES } from '@/content/sample';
import { PROGRAM_SLUGS } from '@/content/programs';
import { isIsoDate, todayIST } from '../dates';
import { normalizeIndianMobile } from '../phone';
import { siteUrl } from '../seo';
import { sendTemplate } from '../whatsapp/service';
import { can, canSeeLead } from './permissions';
import { getCrmRepo } from './repo';
import { CrmError } from './service';
import { RepoConflict, type CrmLead, type Staff } from './types';
import {
  canApproveReversal,
  canRequestReversal,
  canSignOff,
  checklistFor,
  DOC_STATUSES,
  reversalCascade,
  stepStates,
  VERIFY_STATUSES,
  VERIFY_STEPS,
  type DocStatus,
  type StudentRow,
  type VerifyStage,
} from './verification';

async function load(user: Staff, leadId: string) {
  if (!can(user, 'verify.view')) throw new CrmError('You cannot view admission verification.');
  const repo = getCrmRepo();
  const lead = await repo.getLead(leadId);
  if (!lead || !canSeeLead(user, lead)) throw new CrmError('Lead not found.');
  const record = await repo.getVerification(leadId);
  return { lead, record, steps: stepStates(lead.status, lead.program, record) };
}

function requireStep(user: Staff, steps: ReturnType<typeof stepStates>, stage: VerifyStage, lead: CrmLead) {
  if (!VERIFY_STATUSES.includes(lead.status)) throw new CrmError('Verification starts once the admission decision is Confirmed.');
  const step = steps.find((s) => s.stage === stage)!;
  if (!canSignOff(user, stage)) throw new CrmError(`Only ${step.owner} can sign off “${step.label}”.`);
  if (step.done) throw new CrmError('This step has already been signed off.');
  return step;
}

async function wrap<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof RepoConflict) throw new CrmError(e.message);
    throw e;
  }
}

export async function verification(user: Staff, leadId: string) {
  const { lead, record, steps } = await load(user, leadId);
  return { lead, record, steps, checklist: checklistFor(lead.program) };
}

/** Application, documents and fee are signed off explicitly; receipt, student record and College ID by their actions. */
export async function signOff(user: Staff, leadId: string, stage: 'application' | 'documents' | 'fee', note: string | null) {
  const { lead, steps } = await load(user, leadId);
  const step = requireStep(user, steps, stage, lead);
  if (step.blockers.length) throw new CrmError(step.blockers[0]);
  await wrap(() => getCrmRepo().signOffStage(leadId, stage, user.id, note));
}

export async function updateDocument(user: Staff, leadId: string, key: string, status: DocStatus, note: string | null) {
  const { lead, steps } = await load(user, leadId);
  requireStep(user, steps, 'documents', lead);
  const item = checklistFor(lead.program).find((d) => d.key === key);
  if (!item) throw new CrmError('Unknown document.');
  if (!DOC_STATUSES.includes(status)) throw new CrmError('Unknown document status.');
  if (status === 'not_applicable' && item.required) throw new CrmError(`${item.label} is required and cannot be marked not applicable.`);
  if (status === 'rejected' && !note) throw new CrmError('Say why the document was rejected.');
  await getCrmRepo().setDocument(leadId, key, status, note, user.id);
}

export interface PaymentInput {
  amount: number;
  mode: string;
  reference: string | null;
  paidOn: string;
}

/** Offline payments need Accounts approval; a payment recorded by Accounts is approved as it is recorded. */
export async function recordPayment(user: Staff, leadId: string, p: PaymentInput) {
  if (!can(user, 'payment.record')) throw new CrmError('You cannot record payments.');
  const { lead, steps } = await load(user, leadId);
  if (!VERIFY_STATUSES.includes(lead.status) || lead.status === 'admitted') throw new CrmError('Payments can be recorded once the admission is Confirmed.');
  if (steps.find((s) => s.stage === 'fee')!.done) throw new CrmError('The fee step is already signed off.');
  if (!Number.isInteger(p.amount) || p.amount <= 0 || p.amount > 1_000_000) throw new CrmError('Enter an amount between ₹1 and ₹10,00,000.');
  if (!PAYMENT_MODES.some((m) => m.value === p.mode)) throw new CrmError('Choose the payment mode.');
  if (p.mode !== 'cash' && !p.reference) throw new CrmError('Enter the transaction / UTR / cheque reference.');
  if (!isIsoDate(p.paidOn) || p.paidOn > todayIST()) throw new CrmError('The payment date cannot be in the future.');
  const byAccounts = can(user, 'payment.approve');
  const now = new Date().toISOString();
  await getCrmRepo().addPayment({
    leadId,
    amount: p.amount,
    mode: p.mode,
    reference: p.reference,
    paidOn: p.paidOn,
    status: byAccounts ? 'approved' : 'pending_approval',
    recordedBy: user.id,
    approvedBy: byAccounts ? user.id : null,
    approvedAt: byAccounts ? now : null,
  });
  return byAccounts ? 'Payment recorded and approved.' : 'Payment recorded. Accounts must approve it.';
}

export async function decidePayment(user: Staff, paymentId: string, approve: boolean) {
  if (!can(user, 'payment.approve')) throw new CrmError('Only Accounts can approve payments.');
  const payment = await getCrmRepo().getPayment(paymentId);
  if (!payment) throw new CrmError('Payment not found.');
  await load(user, payment.leadId); // visibility
  await wrap(() => getCrmRepo().decidePayment(paymentId, approve, user.id));
}

export async function generateReceipts(user: Staff, leadId: string) {
  const { lead, steps } = await load(user, leadId);
  const step = requireStep(user, steps, 'receipt', lead);
  if (step.blockers.length) throw new CrmError(step.blockers[0]);
  const nos = await wrap(() => getCrmRepo().issueReceipts(leadId, user.id));
  // TODO(phase 2): render the PDF on the letterhead and send it on WhatsApp and email.
  return nos;
}

export interface StudentInput {
  fullName: string;
  dob: string;
  gender: StudentRow['gender'];
  program: string;
  stay: StudentRow['stay'];
  guardianName: string;
  guardianPhone: string;
}

export async function createStudentRecord(user: Staff, leadId: string, s: StudentInput) {
  const { lead, steps } = await load(user, leadId);
  const step = requireStep(user, steps, 'student_record', lead);
  if (step.blockers.length) throw new CrmError(step.blockers[0]);
  const phone = normalizeIndianMobile(s.guardianPhone);
  if (s.fullName.trim().length < 2) throw new CrmError('Enter the student’s full name as on the SSC memo.');
  if (!isIsoDate(s.dob)) throw new CrmError('Enter a valid date of birth.');
  const age = (Date.parse(todayIST()) - Date.parse(s.dob)) / (365.25 * 86_400_000);
  if (age < 12 || age > 25) throw new CrmError('The date of birth looks wrong for a junior college student.');
  if (!['female', 'male', 'other'].includes(s.gender)) throw new CrmError('Choose the gender.');
  if (!(PROGRAM_SLUGS as readonly string[]).includes(s.program)) throw new CrmError('Choose the program.');
  if (!['day', 'hostel'].includes(s.stay)) throw new CrmError('Choose day scholar or hostel.');
  if (s.guardianName.trim().length < 2) throw new CrmError('Enter the guardian’s name.');
  if (!phone) throw new CrmError('Enter a valid guardian mobile number.');
  await wrap(() =>
    getCrmRepo().createStudent(
      leadId,
      { fullName: s.fullName.trim(), dob: s.dob, gender: s.gender, program: s.program, stay: s.stay, guardianName: s.guardianName.trim(), guardianPhone: phone, loginPhone: lead.studentPhone && lead.studentPhone !== phone ? lead.studentPhone : null },
      user.id,
    ),
  );
}

export async function generateCollegeId(user: Staff, leadId: string) {
  const { lead, steps } = await load(user, leadId);
  const step = requireStep(user, steps, 'college_id', lead);
  if (step.blockers.length) throw new CrmError(step.blockers[0]);
  const id = await wrap(() => getCrmRepo().issueCollegeId(leadId, user.id));
  // The College ID unlocks the Student & Parent app: the primary guardian was given access in the same
  // transaction; tell them. (Applicant logins upgrade automatically — profiles are resolved per request.)
  const student = (await getCrmRepo().getVerification(leadId)).student;
  if (student) {
    await sendTemplate({ template: 'app_welcome', to: student.guardianPhone, params: [student.fullName, id, `${siteUrl}/app`], leadId, dedupeKey: `app_welcome:${student.id}:${student.guardianPhone}` }).catch(() => undefined);
  }
  return id;
}

export async function requestReversal(user: Staff, leadId: string, stage: VerifyStage, reason: string) {
  const { record } = await load(user, leadId);
  if (!canRequestReversal(user, stage)) throw new CrmError('Only the step owner or a manager can request a reversal.');
  if (reason.trim().length < 5) throw new CrmError('Explain what was wrong (at least a few words).');
  try {
    reversalCascade(stage, record.signOffs.map((s) => s.stage));
  } catch (e) {
    throw new CrmError((e as Error).message);
  }
  await wrap(() => getCrmRepo().requestReversal(leadId, stage, reason.trim().slice(0, 300), user.id));
}

export async function decideReversal(user: Staff, reversalId: string, approve: boolean, note: string | null) {
  const repo = getCrmRepo();
  const r = await repo.getReversal(reversalId);
  if (!r) throw new CrmError('Reversal request not found.');
  await load(user, r.leadId);
  if (r.requestedBy === user.id) throw new CrmError('You cannot approve your own reversal request. Another manager must decide it.');
  if (!canApproveReversal(user, r)) throw new CrmError('Only a manager can decide reversal requests.');
  const cleared = await wrap(() => repo.decideReversal(reversalId, approve, user.id, note));
  return { leadId: r.leadId, cleared };
}

export async function receiptFor(user: Staff, paymentId: string) {
  const payment = await getCrmRepo().getPayment(paymentId);
  if (!payment || !payment.receiptNo) throw new CrmError('Receipt not found.');
  const { lead, record } = await load(user, payment.leadId);
  return { payment, lead, student: record.student };
}

export interface QueueRow {
  lead: CrmLead;
  done: number;
  next: (typeof VERIFY_STEPS)[number] | null;
  mine: boolean;
  collegeId: string | null;
  pendingReversals: number;
}

/** Confirmed and admitted leads with their gate progress; "mine" = the next step belongs to one of my roles. */
export async function verificationQueue(user: Staff): Promise<QueueRow[]> {
  if (!can(user, 'verify.view')) throw new CrmError('You cannot view admission verification.');
  const repo = getCrmRepo();
  const leads = (await Promise.all(VERIFY_STATUSES.map((status) => repo.listLeads({ status })))).flat().filter((l) => canSeeLead(user, l));
  const rows = await Promise.all(
    leads.map(async (lead) => {
      const record = await repo.getVerification(lead.id);
      const steps = stepStates(lead.status, lead.program, record);
      const pending = steps.filter((s) => !s.done);
      // Several steps can be open at once (e.g. documents and fee); "mine" if any open, unblocked step is mine.
      const mine = pending.some((s) => canSignOff(user, s.stage) && (s.blockers.length === 0 || s.stage === 'documents' || s.stage === 'fee'));
      const pendingApproval = can(user, 'payment.approve') && record.payments.some((p) => p.status === 'pending_approval');
      const reversalsForMe = record.reversals.filter((r) => canApproveReversal(user, r)).length;
      return {
        lead,
        done: steps.filter((s) => s.done).length,
        next: VERIFY_STEPS.find((s) => s.stage === pending[0]?.stage) ?? null,
        mine: mine || pendingApproval || reversalsForMe > 0,
        collegeId: record.student?.collegeId ?? null,
        pendingReversals: record.reversals.filter((r) => r.status === 'pending').length,
      };
    }),
  );
  return rows.sort((a, b) => Number(b.mine) - Number(a.mine) || a.done - b.done);
}

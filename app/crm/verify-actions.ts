'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/crm/auth';
import { CrmError } from '@/lib/crm/service';
import { createStudentRecord, decidePayment, decideReversal, generateCollegeId, generateReceipts, recordPayment, requestReversal, signOff, updateDocument } from '@/lib/crm/verifyService';
import { DOC_STATUSES, VERIFY_STEPS, type DocStatus, type VerifyStage } from '@/lib/crm/verification';
import type { ActionState } from './actions';

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};

async function run(leadId: string, fn: () => Promise<string | void>): Promise<ActionState> {
  try {
    const message = await fn();
    revalidatePath(`/crm/leads/${leadId}`);
    revalidatePath('/crm/verification');
    return { ok: true, message: message || 'Saved.' };
  } catch (e) {
    if (e instanceof CrmError) return { error: e.message };
    console.error('[crm] verification action failed', e);
    return { error: 'Something went wrong. Please try again.' };
  }
}

export async function signOffAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const leadId = String(fd.get('leadId'));
  const stage = String(fd.get('stage'));
  if (stage !== 'application' && stage !== 'documents' && stage !== 'fee') return { error: 'Unknown step.' };
  return run(leadId, async () => {
    await signOff(user, leadId, stage, str(fd, 'note')?.slice(0, 300) ?? null);
    return 'Signed off.';
  });
}

export async function documentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const leadId = String(fd.get('leadId'));
  const status = String(fd.get('status')) as DocStatus;
  if (!DOC_STATUSES.includes(status)) return { error: 'Unknown status.' };
  return run(leadId, async () => {
    await updateDocument(user, leadId, String(fd.get('docKey')), status, str(fd, 'note')?.slice(0, 200) ?? null);
    return 'Document updated.';
  });
}

export async function paymentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const leadId = String(fd.get('leadId'));
  const amount = Number(String(fd.get('amount') ?? '').replace(/[,\s₹]/g, ''));
  return run(leadId, () => recordPayment(user, leadId, { amount, mode: String(fd.get('mode') ?? ''), reference: str(fd, 'reference')?.slice(0, 80) ?? null, paidOn: String(fd.get('paidOn') ?? '') }));
}

export async function paymentDecisionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const leadId = String(fd.get('leadId'));
  const approve = fd.get('decision') === 'approve';
  return run(leadId, async () => {
    await decidePayment(user, String(fd.get('paymentId')), approve);
    return approve ? 'Payment approved.' : 'Payment rejected.';
  });
}

export async function receiptAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const leadId = String(fd.get('leadId'));
  return run(leadId, async () => {
    const nos = await generateReceipts(user, leadId);
    return nos.length ? `Issued ${nos.join(', ')}.` : 'Receipt step signed off.';
  });
}

export async function studentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const leadId = String(fd.get('leadId'));
  return run(leadId, async () => {
    await createStudentRecord(user, leadId, {
      fullName: String(fd.get('fullName') ?? ''),
      dob: String(fd.get('dob') ?? ''),
      gender: String(fd.get('gender') ?? '') as never,
      program: String(fd.get('program') ?? ''),
      stay: String(fd.get('stay') ?? '') as never,
      guardianName: String(fd.get('guardianName') ?? ''),
      guardianPhone: String(fd.get('guardianPhone') ?? ''),
    });
    return 'Student record created.';
  });
}

export async function reversalRequestAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const leadId = String(fd.get('leadId'));
  const stage = String(fd.get('stage'));
  if (!VERIFY_STEPS.some((s) => s.stage === stage)) return { error: 'Unknown step.' };
  return run(leadId, async () => {
    await requestReversal(user, leadId, stage as VerifyStage, String(fd.get('reason') ?? ''));
    return 'Reversal requested. Another manager must approve it.';
  });
}

export async function reversalDecisionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const leadId = String(fd.get('leadId'));
  const approve = fd.get('decision') === 'approve';
  return run(leadId, async () => {
    const { cleared } = await decideReversal(user, String(fd.get('reversalId')), approve, str(fd, 'note')?.slice(0, 300) ?? null);
    return approve ? `Reversed: ${cleared.join(', ').replace(/_/g, ' ')}.` : 'Reversal rejected.';
  });
}

export async function collegeIdAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const leadId = String(fd.get('leadId'));
  return run(leadId, async () => `College ID ${await generateCollegeId(user, leadId)} issued. The student is admitted.`);
}

import type { SupabaseClient } from '@supabase/supabase-js';
import { BLOCKS } from '../cms/blocks';
import { RepoConflict, type VerifyRepo } from './types';
import type { PaymentRow, ReversalRow } from './verification';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const CONFLICTS: Record<string, string> = {
  already_signed_off: 'This step has already been signed off.',
  fee_not_confirmed: 'Fee payment must be confirmed first.',
  nothing_to_receipt: 'There is no approved payment to receipt.',
  student_exists: 'A student record already exists for this lead.',
  gate_not_met: 'Not all steps are signed off.',
  no_student: 'There is no student record.',
  already_issued: 'A College ID has already been issued.',
  no_program_code: 'The student record has no valid program.',
  reversal_not_found: 'Reversal request not found.',
  reversal_decided: 'This request has already been decided.',
  reversal_self_approval: 'You cannot approve your own reversal request.',
  reversal_after_college_id: 'A College ID has been issued; sign-offs can no longer be reversed.',
  reversal_not_signed: 'That step is not signed off.',
  verification_reversals_one_pending: 'A reversal for this step is already waiting for approval.',
};

const toReversal = (r: Row): ReversalRow => ({
  id: r.id,
  leadId: r.lead_id,
  stage: r.stage,
  reason: r.reason,
  requestedBy: r.requested_by,
  requestedAt: r.requested_at,
  status: r.status,
  decidedBy: r.decided_by,
  decidedAt: r.decided_at,
  decisionNote: r.decision_note,
});

function ok<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) {
    const code = Object.keys(CONFLICTS).find((c) => res.error!.message.includes(c));
    if (code) throw new RepoConflict(CONFLICTS[code]);
    throw new Error(res.error.message);
  }
  return res.data;
}

const toPayment = (r: Row): PaymentRow => ({
  id: r.id,
  leadId: r.lead_id,
  amount: r.amount,
  mode: r.mode,
  reference: r.reference,
  paidOn: r.paid_on,
  status: r.status,
  recordedBy: r.recorded_by,
  recordedAt: r.recorded_at,
  approvedBy: r.approved_by,
  approvedAt: r.approved_at,
  receiptNo: r.receipt_no,
  receiptAt: r.receipt_at,
});

export function createSupabaseVerifyRepo(sb: SupabaseClient): VerifyRepo {
  /** The CMS numbering block (records table), read at the moment a number is issued. */
  const numbering = async () => {
    const { data } = await sb.from('records').select('data').eq('collection', 'cms').eq('id', 'numbering').maybeSingle();
    const parsed = data ? BLOCKS.numbering.schema.safeParse((data.data as { value: unknown }).value) : null;
    return parsed?.success ? parsed.data : BLOCKS.numbering.schema.parse(BLOCKS.numbering.default);
  };
  const audit = async (leadId: string, actorId: string, action: string, field: string, newValue: string, reason: string | null = null, oldValue: string | null = null) => {
    ok(await sb.from('lead_audit').insert({ lead_id: leadId, actor_id: actorId, action, field, old_value: oldValue, new_value: newValue, reason }));
  };

  return {
    async getVerification(leadId) {
      const [ev, docs, pays, student, revs] = await Promise.all([
        sb.from('admission_stage_events').select('stage, signed_off_by, completed_at, note').eq('lead_id', leadId),
        sb.from('lead_documents').select('*').eq('lead_id', leadId),
        sb.from('payments').select('*').eq('lead_id', leadId).order('recorded_at'),
        sb.from('students').select('*').eq('lead_id', leadId).maybeSingle(),
        sb.from('verification_reversals').select('*').eq('lead_id', leadId).order('requested_at'),
      ]);
      const s = ok(student) as Row | null;
      return {
        signOffs: (ok(ev) ?? [])
          .filter((r: Row) => r.stage !== 'enquiry' && r.stage !== 'visit' && r.stage !== 'counselling')
          .map((r: Row) => ({ stage: r.stage, signedOffBy: r.signed_off_by, at: r.completed_at, note: r.note })),
        documents: (ok(docs) ?? []).map((r: Row) => ({ key: r.doc_key, status: r.status, note: r.note, updatedBy: r.updated_by, updatedAt: r.updated_at })),
        payments: (ok(pays) ?? []).map(toPayment),
        student: s
          ? { id: s.id, leadId, fullName: s.full_name, dob: s.dob, gender: s.gender, program: s.program, stay: s.stay, guardianName: s.guardian_name, guardianPhone: s.guardian_phone, loginPhone: s.login_phone, collegeId: s.college_id, createdBy: s.created_by, createdAt: s.created_at }
          : null,
        reversals: (ok(revs) ?? []).map(toReversal),
      };
    },

    async requestReversal(leadId, stage, reason, actorId) {
      const signed = ok(await sb.from('admission_stage_events').select('stage').eq('lead_id', leadId).eq('stage', stage).maybeSingle());
      if (!signed) throw new RepoConflict('That step is not signed off.');
      const row = ok(await sb.from('verification_reversals').insert({ lead_id: leadId, stage, reason, requested_by: actorId }).select('id').single()) as Row;
      await audit(leadId, actorId, 'reversal_requested', 'stage', stage, reason);
      return row.id;
    },

    async getReversal(id) {
      const r = ok(await sb.from('verification_reversals').select('*').eq('id', id).maybeSingle()) as Row | null;
      return r ? toReversal(r) : null;
    },

    async decideReversal(id, approve, actorId, note) {
      return (ok(await sb.rpc('decide_reversal', { p_id: id, p_approve: approve, p_actor: actorId, p_note: note })) ?? []) as never;
    },

    async signOffStage(leadId, stage, actorId, note) {
      ok(await sb.rpc('sign_off_stage', { p_lead: leadId, p_stage: stage, p_actor: actorId, p_note: note }));
    },

    async setDocument(leadId, key, status, note, actorId) {
      const prev = ok(await sb.from('lead_documents').select('status').eq('lead_id', leadId).eq('doc_key', key).maybeSingle()) as Row | null;
      ok(await sb.from('lead_documents').upsert({ lead_id: leadId, doc_key: key, status, note, updated_by: actorId, updated_at: new Date().toISOString() }));
      await audit(leadId, actorId, 'document', key, status, note, prev?.status ?? 'pending');
    },

    async addPayment(p) {
      const row = ok(
        await sb
          .from('payments')
          .insert({ lead_id: p.leadId, amount: p.amount, mode: p.mode, reference: p.reference, paid_on: p.paidOn, status: p.status, recorded_by: p.recordedBy, approved_by: p.approvedBy, approved_at: p.approvedAt })
          .select('id')
          .single(),
      ) as Row;
      await audit(p.leadId, p.recordedBy, 'payment_recorded', 'payment', `${p.amount} ${p.mode} (${p.status})`, p.reference);
      return row.id;
    },

    async getPayment(id) {
      const r = ok(await sb.from('payments').select('*').eq('id', id).maybeSingle()) as Row | null;
      return r ? toPayment(r) : null;
    },

    async decidePayment(id, approve, actorId) {
      const status = approve ? 'approved' : 'rejected';
      const rows = (ok(await sb.from('payments').update({ status, approved_by: actorId, approved_at: new Date().toISOString() }).eq('id', id).eq('status', 'pending_approval').select('lead_id')) ?? []) as Row[];
      if (rows.length === 0) throw new RepoConflict('This payment has already been decided.');
      await audit(rows[0].lead_id, actorId, approve ? 'payment_approved' : 'payment_rejected', 'payment', status, null, 'pending_approval');
    },

    async issueReceipts(leadId, actorId) {
      const r = (await numbering()).receipt;
      return (ok(await sb.rpc('issue_receipts', { p_lead: leadId, p_actor: actorId, p_counter: `receipt:${r.academicYear}`, p_prefix: `${r.prefix}/${r.academicYear}`, p_digits: r.seqDigits })) ?? []) as string[];
    },

    async createStudent(leadId, s, actorId) {
      ok(
        await sb.rpc('create_student', {
          p_lead: leadId,
          p_actor: actorId,
          p: { full_name: s.fullName, dob: s.dob, gender: s.gender, program: s.program, stay: s.stay, guardian_name: s.guardianName, guardian_phone: s.guardianPhone, login_phone: s.loginPhone ?? null },
        }),
      );
    },

    async issueCollegeId(leadId, actorId) {
      const c = (await numbering()).collegeId;
      return ok(await sb.rpc('issue_college_id', { p_lead: leadId, p_actor: actorId, p_template: c.template, p_year: c.year, p_codes: c.programCodes, p_digits: c.seqDigits })) as string;
    },
  };
}

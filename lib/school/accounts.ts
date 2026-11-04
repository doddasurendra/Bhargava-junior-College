import 'server-only';
import { getContent } from '../cms';
import { getCrmRepo } from '../crm/repo';
import { can } from '../crm/permissions';
import type { Staff } from '../crm/types';
import { toCsv } from '../crm/csv';
import { formatDate, todayIST } from '../dates';
import { formatINR } from '../fees';
import { feeRequests, feeSchedules } from '../records/collections';
import { getAppStore } from '../app/service';
import { sendTemplate } from '../whatsapp/service';
import { allStudents, SchoolError, store, studentsById } from './common';
import { approvalLevel, duesFor } from './logic';

const need = (ok: boolean, msg = 'You do not have permission to do this.') => {
  if (!ok) throw new SchoolError(msg);
};

async function approvedTotal(leadId: string) {
  const v = await getCrmRepo().getVerification(leadId);
  return v.payments.filter((p) => p.status === 'approved').reduce((s, p) => s + p.amount, 0);
}

export async function saveSchedule(user: Staff, studentId: string, items: { due: string; amount: number; label: string }[]) {
  need(can(user, 'fees.dues'));
  const s = (await studentsById()).get(studentId);
  if (!s) throw new SchoolError('Student not found.');
  const prev = (await feeSchedules.list(store(), { k1: studentId }))[0];
  return feeSchedules.put(store(), { studentId, leadId: s.leadId, items, createdBy: user.id }, prev?.id);
}

/** Dues list across students (Accounts home). */
export async function duesList(user: Staff, today = todayIST()) {
  need(can(user, 'fees.dues'));
  const byId = await studentsById();
  const rows = [];
  for (const sch of await feeSchedules.list(store())) {
    const s = byId.get(sch.data.studentId);
    if (!s) continue;
    const d = duesFor(sch.data.items, await approvedTotal(sch.data.leadId), today);
    rows.push({ student: s, scheduleId: sch.id, ...d, next: d.rows.find((r) => r.outstanding > 0) ?? null });
  }
  return rows.sort((a, b) => b.overdue - a.overdue || b.outstanding - a.outstanding);
}

export async function duesForStudent(studentId: string, today = todayIST()) {
  const sch = (await feeSchedules.list(store(), { k1: studentId }))[0];
  if (!sch) return null;
  return duesFor(sch.data.items, await approvedTotal(sch.data.leadId), today);
}

/** Reminders for instalments due in the next 3 days or overdue (once per instalment per guardian per day). */
export async function sendFeeReminders(user: Staff | null, today = todayIST()) {
  if (user) need(can(user, 'fees.dues'));
  const byId = await studentsById();
  let sent = 0;
  for (const sch of await feeSchedules.list(store())) {
    const s = byId.get(sch.data.studentId);
    if (!s) continue;
    const d = duesFor(sch.data.items, await approvedTotal(sch.data.leadId), today);
    const next = d.rows.find((r) => r.outstanding > 0);
    if (!next) continue;
    const soon = new Date(`${next.due}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime() <= 3 * 86_400_000;
    if (!soon) continue;
    for (const g of await getAppStore().guardiansOf(s.id)) {
      const r = await sendTemplate({ template: 'fee_reminder', to: g.phone, params: [formatINR(next.outstanding), s.fullName, formatDate(next.due)], leadId: s.leadId, dedupeKey: `fee:${sch.id}:${next.due}:${today}:${g.phone}` }).catch(() => null);
      if (r?.status === 'sent') sent++;
    }
  }
  return sent;
}

// ---------------------------------------------------------------- concessions & refunds (§9A.2 rows 2, 4, 9; §9A.3)

export async function requestFeeChange(user: Staff, input: { kind: 'concession' | 'refund'; leadId: string; amount: number; reason: string }) {
  need(can(user, input.kind === 'refund' ? 'refund.request' : 'concession.request'));
  const lead = await getCrmRepo().getLead(input.leadId);
  if (!lead) throw new SchoolError('Lead not found.');
  const { fees, bsat } = await getContent();
  const tuition = lead.program?.startsWith('long-term') ? fees.longTerm.tuition : fees.twoYear.tuition;
  const pct = input.kind === 'concession' ? Math.round((input.amount / tuition) * 1000) / 10 : null;
  if (input.kind === 'refund' && input.amount > (await approvedTotal(input.leadId))) throw new SchoolError('A refund can’t exceed the approved payments.');
  const level = approvalLevel(input.kind, pct, Math.max(...bsat.slabs.map((s) => s.pct)));
  return feeRequests.put(store(), { ...input, percentOfTuition: pct, status: 'pending', level, requestedBy: user.id, decidedBy: null, decidedAt: null, note: null });
}

export async function decideFeeChange(user: Staff, id: string, approve: boolean, note: string | null) {
  const r = await feeRequests.get(store(), id);
  if (!r || r.data.status !== 'pending') throw new SchoolError('This request has already been decided.');
  const perm = r.data.kind === 'refund' ? 'refund.approve' : r.data.level === 'slab' ? 'concession.approve.slab' : 'concession.approve.above';
  need(can(user, perm), r.data.level === 'above' ? 'Above the scholarship slab, only Management can approve.' : 'You can’t approve this.');
  if (r.data.requestedBy === user.id) throw new SchoolError('Someone else must approve your own request.');
  const out = await feeRequests.put(store(), { ...r.data, status: approve ? 'approved' : 'rejected', decidedBy: user.id, decidedAt: new Date().toISOString(), note }, r.id);
  await getCrmRepo().updateLead(r.data.leadId, {}, [{ action: `${r.data.kind}_${approve ? 'approved' : 'rejected'}`, actorId: user.id, field: 'fees', newValue: formatINR(r.data.amount), reason: note ?? r.data.reason }]);
  return out;
}

export async function feeRequestsFor(user: Staff) {
  const all = (await feeRequests.list(store())).map((r) => ({ id: r.id, createdAt: r.createdAt, ...r.data }));
  const canDecide = (r: (typeof all)[number]) => can(user, r.kind === 'refund' ? 'refund.approve' : r.level === 'slab' ? 'concession.approve.slab' : 'concession.approve.above');
  return all.map((r) => ({ ...r, canDecide: r.status === 'pending' && canDecide(r) && r.requestedBy !== user.id }));
}

// ---------------------------------------------------------------- reports & Tally export

/** Payments approved on a day (daily collection report). */
export async function dailyCollection(user: Staff, date: string) {
  need(can(user, 'fees.export'));
  const repo = getCrmRepo();
  const students = await allStudents();
  const leads = new Set(students.map((s) => s.leadId));
  const out = [];
  for (const leadId of leads) {
    for (const p of (await repo.getVerification(leadId)).payments) if (p.status === 'approved' && p.approvedAt?.slice(0, 10) === date) out.push({ ...p, student: students.find((s) => s.leadId === leadId)!.fullName });
  }
  // payments of applicants not yet admitted
  for (const l of await repo.listLeads({ status: 'confirmed' })) {
    if (leads.has(l.id)) continue;
    for (const p of (await repo.getVerification(l.id)).payments) if (p.status === 'approved' && p.approvedAt?.slice(0, 10) === date) out.push({ ...p, student: l.studentName ?? l.contactName ?? 'Applicant' });
  }
  return out.sort((a, b) => (a.receiptNo ?? '').localeCompare(b.receiptNo ?? ''));
}

/** Tally-friendly CSV (Date, Voucher no, Ledger, Amount, Mode, Reference, Narration). Formula-injection safe. */
export async function tallyCsv(user: Staff, from: string, to: string) {
  need(can(user, 'fees.export'));
  const rows: string[][] = [['Date', 'Voucher No', 'Party Ledger', 'Amount', 'Mode', 'Reference', 'Narration']];
  const repo = getCrmRepo();
  const leads = [...(await repo.listLeads({ status: 'confirmed' })), ...(await repo.listLeads({ status: 'admitted' }))];
  for (const l of leads) {
    for (const p of (await repo.getVerification(l.id)).payments) {
      const d = p.approvedAt?.slice(0, 10);
      if (p.status !== 'approved' || !d || d < from || d > to) continue;
      rows.push([d, p.receiptNo ?? '', l.studentName ?? l.contactName ?? 'Student', String(p.amount), p.mode, p.reference ?? '', `Fee receipt ${p.receiptNo ?? ''}`.trim()]);
    }
  }
  return toCsv(rows);
}

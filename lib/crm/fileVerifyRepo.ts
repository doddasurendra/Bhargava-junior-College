import { randomUUID } from 'node:crypto';
import { STAGES } from '../admission';
import { cmsBlock, pushAudit, tx, type DB, type FileLead } from '../store/file';
import { RepoConflict, type VerifyRepo } from './types';
import { collegeIdCounterKey, formatCollegeId, formatReceiptNo, GATE_STAGES, receiptCounterKey, reversalCascade, type VerifyStage } from './verification';

const stageIdx = (s: string) => STAGES.findIndex((x) => x.key === s);

function lead(db: DB, id: string): FileLead {
  const l = db.leads.find((x) => x.id === id);
  if (!l) throw new RepoConflict('Lead not found.');
  return l;
}

function next(db: DB, key: string): number {
  db.counters[key] = (db.counters[key] ?? 0) + 1;
  return db.counters[key];
}

function signOff(db: DB, leadId: string, stage: VerifyStage, actorId: string, note: string | null) {
  if (db.signOffs.some((s) => s.leadId === leadId && s.stage === stage)) throw new RepoConflict('This step has already been signed off.');
  const now = new Date().toISOString();
  db.signOffs.push({ leadId, stage, signedOffBy: actorId, at: now, note });
  const l = lead(db, leadId);
  if (stageIdx(stage) > stageIdx(l.stage)) l.stage = stage;
  l.updatedAt = now;
  pushAudit(db, leadId, { actorId, action: 'signed_off', field: 'stage', oldValue: null, newValue: stage, reason: note });
}

/** Development store — each method runs inside one serialised read-modify-write, so it is atomic. */
export function createFileVerifyRepo(): VerifyRepo {
  return {
    getVerification: (leadId) =>
      tx(
        (db) => ({
          signOffs: db.signOffs.filter((s) => s.leadId === leadId).map(({ leadId: _l, ...s }) => s),
          documents: db.documents.filter((d) => d.leadId === leadId).map(({ leadId: _l, ...d }) => d),
          payments: db.payments.filter((p) => p.leadId === leadId),
          student: db.students.find((s) => s.leadId === leadId) ?? null,
          reversals: db.reversals.filter((r) => r.leadId === leadId),
        }),
        false,
      ),

    signOffStage: (leadId, stage, actorId, note) => tx((db) => signOff(db, leadId, stage, actorId, note)),

    setDocument: (leadId, key, status, note, actorId) =>
      tx((db) => {
        const now = new Date().toISOString();
        const existing = db.documents.find((d) => d.leadId === leadId && d.key === key);
        const old = existing?.status ?? 'pending';
        if (existing) Object.assign(existing, { status, note, updatedBy: actorId, updatedAt: now });
        else db.documents.push({ leadId, key, status, note, updatedBy: actorId, updatedAt: now });
        pushAudit(db, leadId, { actorId, action: 'document', field: key, oldValue: old, newValue: status, reason: note });
      }),

    addPayment: (p) =>
      tx((db) => {
        const id = randomUUID();
        db.payments.push({ ...p, id, recordedAt: new Date().toISOString(), receiptNo: null, receiptAt: null });
        pushAudit(db, p.leadId, { actorId: p.recordedBy, action: 'payment_recorded', field: 'payment', oldValue: null, newValue: `${p.amount} ${p.mode} (${p.status})`, reason: p.reference });
        return id;
      }),

    getPayment: (id) => tx((db) => db.payments.find((p) => p.id === id) ?? null, false),

    decidePayment: (id, approve, actorId) =>
      tx((db) => {
        const p = db.payments.find((x) => x.id === id);
        if (!p) throw new RepoConflict('Payment not found.');
        if (p.status !== 'pending_approval') throw new RepoConflict('This payment has already been decided.');
        p.status = approve ? 'approved' : 'rejected';
        p.approvedBy = actorId;
        p.approvedAt = new Date().toISOString();
        pushAudit(db, p.leadId, { actorId, action: approve ? 'payment_approved' : 'payment_rejected', field: 'payment', oldValue: 'pending_approval', newValue: p.status, reason: null });
      }),

    issueReceipts: (leadId, actorId) =>
      tx((db) => {
        if (!db.signOffs.some((s) => s.leadId === leadId && s.stage === 'fee')) throw new RepoConflict('Fee payment must be confirmed first.');
        const now = new Date().toISOString();
        const issued: string[] = [];
        for (const p of db.payments.filter((x) => x.leadId === leadId && x.status === 'approved' && !x.receiptNo)) {
          const rc = cmsBlock(db, 'numbering').receipt;
          p.receiptNo = formatReceiptNo(next(db, receiptCounterKey(rc)), rc);
          p.receiptAt = now;
          issued.push(p.receiptNo);
        }
        if (issued.length === 0 && !db.payments.some((x) => x.leadId === leadId && x.receiptNo)) throw new RepoConflict('There is no approved payment to receipt.');
        signOff(db, leadId, 'receipt', actorId, issued.length ? `Receipts ${issued.join(', ')}` : null);
        return issued;
      }),

    createStudent: (leadId, s, actorId) =>
      tx((db) => {
        if (db.students.some((x) => x.leadId === leadId)) throw new RepoConflict('A student record already exists for this lead.');
        db.students.push({ ...s, id: randomUUID(), leadId, collegeId: null, createdBy: actorId, createdAt: new Date().toISOString() });
        signOff(db, leadId, 'student_record', actorId, null);
      }),

    issueCollegeId: (leadId, actorId) =>
      tx((db) => {
        const missing = GATE_STAGES.filter((st) => !db.signOffs.some((x) => x.leadId === leadId && x.stage === st));
        if (missing.length) throw new RepoConflict(`Not all steps are signed off: ${missing.join(', ')}.`);
        const student = db.students.find((x) => x.leadId === leadId);
        if (!student) throw new RepoConflict('There is no student record.');
        if (student.collegeId) throw new RepoConflict('A College ID has already been issued.');
        const cc = cmsBlock(db, 'numbering').collegeId;
        const id = formatCollegeId(student.program, next(db, collegeIdCounterKey(student.program, cc)), cc);
        student.collegeId = id;
        // The College ID unlocks the Student & Parent app (§7.4): the primary guardian gets access now.
        if (!db.guardians.some((g) => g.studentId === student.id && g.phone === student.guardianPhone)) {
          db.guardians.push({ studentId: student.id, phone: student.guardianPhone, name: student.guardianName, relation: 'guardian', addedBy: actorId, addedAt: new Date().toISOString() });
        }
        const l = lead(db, leadId);
        l.status = 'admitted';
        l.nextFollowUpAt = null;
        signOff(db, leadId, 'college_id', actorId, id);
        pushAudit(db, leadId, { actorId, action: 'admitted', field: 'college_id', oldValue: null, newValue: id, reason: null });
        return id;
      }),

    requestReversal: (leadId, stage, reason, actorId) =>
      tx((db) => {
        if (!db.signOffs.some((s) => s.leadId === leadId && s.stage === stage)) throw new RepoConflict('That step is not signed off.');
        if (db.reversals.some((r) => r.leadId === leadId && r.stage === stage && r.status === 'pending')) throw new RepoConflict('A reversal for this step is already waiting for approval.');
        const id = randomUUID();
        db.reversals.push({ id, leadId, stage, reason, requestedBy: actorId, requestedAt: new Date().toISOString(), status: 'pending', decidedBy: null, decidedAt: null, decisionNote: null });
        pushAudit(db, leadId, { actorId, action: 'reversal_requested', field: 'stage', oldValue: null, newValue: stage, reason });
        return id;
      }),

    getReversal: (id) => tx((db) => db.reversals.find((r) => r.id === id) ?? null, false),

    decideReversal: (id, approve, actorId, note) =>
      tx((db) => {
        const r = db.reversals.find((x) => x.id === id);
        if (!r) throw new RepoConflict('Reversal request not found.');
        if (r.status !== 'pending') throw new RepoConflict('This request has already been decided.');
        if (r.requestedBy === actorId) throw new RepoConflict('You cannot approve your own reversal request.');
        let cleared: VerifyStage[] = [];
        if (approve) {
          const signed = db.signOffs.filter((s) => s.leadId === r.leadId).map((s) => s.stage);
          try {
            cleared = reversalCascade(r.stage, signed);
          } catch (e) {
            throw new RepoConflict((e as Error).message);
          }
          db.signOffs = db.signOffs.filter((s) => !(s.leadId === r.leadId && cleared.includes(s.stage)));
          if (cleared.includes('student_record')) {
            const st = db.students.find((s) => s.leadId === r.leadId);
            if (st) pushAudit(db, r.leadId, { actorId, action: 'student_record_removed', field: 'student', oldValue: JSON.stringify({ ...st, id: undefined }), newValue: null, reason: r.reason });
            db.students = db.students.filter((s) => s.leadId !== r.leadId);
          }
          const l = lead(db, r.leadId);
          const remaining = db.signOffs.filter((s) => s.leadId === r.leadId).map((s) => stageIdx(s.stage));
          l.stage = STAGES[Math.max(stageIdx('counselling'), ...remaining)].key;
          l.updatedAt = new Date().toISOString();
          for (const s of cleared) pushAudit(db, r.leadId, { actorId, action: 'sign_off_reversed', field: 'stage', oldValue: s, newValue: null, reason: r.reason });
        }
        Object.assign(r, { status: approve ? 'approved' : 'rejected', decidedBy: actorId, decidedAt: new Date().toISOString(), decisionNote: note });
        pushAudit(db, r.leadId, { actorId, action: approve ? 'reversal_approved' : 'reversal_rejected', field: 'stage', oldValue: null, newValue: r.stage, reason: note });
        return cleared;
      }),
  };
}

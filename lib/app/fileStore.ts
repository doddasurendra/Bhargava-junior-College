import { randomUUID } from 'node:crypto';
import { pushAudit, tx } from '../store/file';
import type { AppStore } from './types';

export function createFileAppStore(): AppStore {
  return {
    getStudent: (id) => tx((db) => db.students.find((s) => s.id === id) ?? null, false),
    studentByCollegeId: (cid) => tx((db) => db.students.find((s) => s.collegeId === cid) ?? null, false),
    studentsByLoginPhone: (phone) => tx((db) => db.students.filter((s) => s.collegeId && s.loginPhone === phone), false),
    guardiansByPhone: (phone) => tx((db) => db.guardians.filter((g) => g.phone === phone), false),
    guardiansOf: (studentId) => tx((db) => db.guardians.filter((g) => g.studentId === studentId), false),

    addGuardian: (g) =>
      tx((db) => {
        if (db.guardians.some((x) => x.studentId === g.studentId && x.phone === g.phone)) return 'exists' as const;
        db.guardians.push({ ...g, addedAt: new Date().toISOString() });
        const s = db.students.find((x) => x.id === g.studentId);
        if (s) pushAudit(db, s.leadId, { actorId: g.addedBy, action: 'guardian_added', field: 'app_access', oldValue: null, newValue: `${g.name} (${g.relation})`, reason: null });
        return 'added' as const;
      }),

    removeGuardian: (studentId, phone) =>
      tx((db) => {
        const g = db.guardians.find((x) => x.studentId === studentId && x.phone === phone);
        db.guardians = db.guardians.filter((x) => x !== g);
        const s = db.students.find((x) => x.id === studentId);
        if (g && s) pushAudit(db, s.leadId, { actorId: null, action: 'guardian_removed', field: 'app_access', oldValue: `${g.name} (${g.relation})`, newValue: null, reason: null });
      }),

    applicationsByPhone: (phone) =>
      tx((db) => {
        const admitted = new Set(db.students.filter((s) => s.collegeId).map((s) => s.leadId));
        return db.leads
          .filter((l) => (l.phone === phone || l.studentPhone === phone) && !admitted.has(l.id) && l.status !== 'invalid')
          .map((l) => ({ leadId: l.id, name: l.studentName ?? l.contactName ?? 'Your application' }));
      }, false),

    addHostelEvent: (e) =>
      tx((db) => {
        if (db.hostelEvents.some((x) => x.device === e.device && x.deviceEventId === e.deviceEventId)) return null;
        const row = { ...e, id: randomUUID(), alerted: 0 };
        db.hostelEvents.push(row);
        return row;
      }),

    markAlerted: (id, n) =>
      tx((db) => {
        const e = db.hostelEvents.find((x) => x.id === id);
        if (e) e.alerted = n;
      }),

    hostelEvents: (studentId, limit = 30) =>
      tx((db) => db.hostelEvents.filter((e) => e.studentId === studentId).sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit), false),
  };
}

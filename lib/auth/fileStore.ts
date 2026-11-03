import { randomUUID } from 'node:crypto';
import { tx, type DB } from '../store/file';
import { emptyAuth, type AuthStore, type StaffAuth } from './types';

const KEEP_EVENTS = 5000;

function row(db: DB, staffId: string): StaffAuth {
  let r = db.staffAuth.find((a) => a.staffId === staffId);
  if (!r) {
    r = emptyAuth(staffId);
    db.staffAuth.push(r);
  }
  return r;
}

export function createFileAuthStore(): AuthStore {
  return {
    get: (staffId) => tx((db) => ({ ...(db.staffAuth.find((a) => a.staffId === staffId) ?? emptyAuth(staffId)) }), false),
    listAll: () => tx((db) => db.staffAuth.map((a) => ({ ...a })), false),

    update: (staffId, patch) =>
      tx((db) => {
        const r = row(db, staffId);
        Object.assign(r, patch);
        return { ...r };
      }),

    recordFailure: (staffId, now, max, lockMs) =>
      tx((db) => {
        const r = row(db, staffId);
        if (r.lockedUntil && new Date(r.lockedUntil) <= now) {
          r.failedCount = 0;
          r.lockedUntil = null;
        }
        r.failedCount += 1;
        if (r.failedCount >= max && !r.lockedUntil) r.lockedUntil = new Date(now.getTime() + lockMs).toISOString();
        return { ...r };
      }),

    useStep: (staffId, step) =>
      tx((db) => {
        const r = row(db, staffId);
        if (step <= r.totpLastStep) return false;
        r.totpLastStep = step;
        return true;
      }),

    consumeRecovery: (staffId, hash) =>
      tx((db) => {
        const r = row(db, staffId);
        if (!r.recoveryHashes.includes(hash)) return false;
        r.recoveryHashes = r.recoveryHashes.filter((h) => h !== hash);
        return true;
      }),

    staffIdForEmail: (email) =>
      tx((db) => db.staff.find((s) => s.email && s.email.toLowerCase() === email.toLowerCase())?.id ?? null, false),

    logEvent: (e) =>
      tx((db) => {
        db.loginAudit.push({ id: randomUUID(), at: new Date().toISOString(), ...e });
        if (db.loginAudit.length > KEEP_EVENTS) db.loginAudit = db.loginAudit.slice(-KEEP_EVENTS);
      }),

    listEvents: ({ limit, failedOnly, staffId }) =>
      tx(
        (db) =>
          db.loginAudit
            .filter((e) => (!failedOnly || !e.success) && (!staffId || e.staffId === staffId))
            .slice(-limit)
            .reverse(),
        false,
      ),
  };
}

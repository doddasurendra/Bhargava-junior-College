import { randomBytes } from 'node:crypto';
import type { RecordStore } from '../records/types';

/**
 * Server-side session records (§9A.4): an active-sessions and devices list with remote logout, an inactivity
 * timeout for staff, and a device limit for student accounts. The signed cookie carries the session id;
 * every request checks the record, so revoking it signs that device out at once. Framework-free.
 */
export const SESSIONS = 'sessions';
export type SessionKind = 'staff' | 'app';

export interface SessionRec {
  kind: SessionKind;
  /** staff id, or the app user's phone */
  subject: string;
  createdAt: string;
  lastSeen: string;
  ip: string | null;
  userAgent: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
}

/** Staff are signed out after 30 minutes without activity (§9A.1). */
export const STAFF_IDLE_MS = 30 * 60 * 1000;
/** lastSeen is written at most this often, to keep page views from becoming database writes. */
const TOUCH_MS = 2 * 60 * 1000;
export const STUDENT_DEVICE_LIMIT = 2;

const owner = (kind: SessionKind, subject: string) => `${kind}:${subject}`;

export async function startSession(store: RecordStore, s: { kind: SessionKind; subject: string; ip: string | null; userAgent: string | null }, now = new Date()): Promise<string> {
  const id = randomBytes(18).toString('base64url');
  const at = now.toISOString();
  await store.put<SessionRec>(SESSIONS, { id, k1: owner(s.kind, s.subject), k2: 'active', data: { ...s, userAgent: s.userAgent?.slice(0, 300) ?? null, createdAt: at, lastSeen: at, revokedAt: null, revokedReason: null } });
  return id;
}

/** The live session for this id and subject, or null if unknown, revoked or idle too long. */
export async function checkSession(store: RecordStore, id: string | undefined, kind: SessionKind, subject: string, now = new Date(), idleMs: number | null = null): Promise<SessionRec | null> {
  if (!id) return null;
  const r = await store.get<SessionRec>(SESSIONS, id);
  if (!r || r.data.kind !== kind || r.data.subject !== subject || r.data.revokedAt) return null;
  const idle = now.getTime() - new Date(r.data.lastSeen).getTime();
  if (idleMs !== null && idle > idleMs) {
    await revokeSession(store, id, 'inactivity timeout', now);
    return null;
  }
  if (idle > TOUCH_MS) await store.put<SessionRec>(SESSIONS, { id, k1: r.k1, k2: 'active', data: { ...r.data, lastSeen: now.toISOString() } });
  return r.data;
}

export async function revokeSession(store: RecordStore, id: string, reason: string, now = new Date()) {
  const r = await store.get<SessionRec>(SESSIONS, id);
  if (!r || r.data.revokedAt) return;
  await store.put<SessionRec>(SESSIONS, { id, k1: r.k1, k2: 'revoked', data: { ...r.data, revokedAt: now.toISOString(), revokedReason: reason } });
}

export async function listSessions(store: RecordStore, kind: SessionKind, subject: string, activeOnly = true) {
  const rows = await store.list<SessionRec>(SESSIONS, { k1: owner(kind, subject), ...(activeOnly ? { k2: 'active' } : {}) });
  return rows.map((r) => ({ id: r.id, ...r.data })).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}

export async function revokeAll(store: RecordStore, kind: SessionKind, subject: string, reason: string, exceptId?: string) {
  let n = 0;
  for (const s of await listSessions(store, kind, subject)) {
    if (s.id === exceptId) continue;
    await revokeSession(store, s.id, reason);
    n++;
  }
  return n;
}

/** Keeps at most `max` active sessions, signing out the least recently used. */
export async function enforceDeviceLimit(store: RecordStore, kind: SessionKind, subject: string, max: number) {
  const active = await listSessions(store, kind, subject);
  for (const s of active.slice(max)) await revokeSession(store, s.id, `device limit (${max})`);
}

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { bsat, devStaff, visitSlots } from '@/content/sample';
import type { StageKey } from '../admission';
import type { AuditEntry, CallLog, ImportBatch, Staff, VisitStatus } from '../crm/types';
import type { DocRow, PaymentRow, ReversalRow, StageSignOff, StudentRow } from '../crm/verification';
import { StoreError, type AdmissionRecord, type LeadInput, type OtpRecord, type Store } from './types';

/**
 * Development-only store: a JSON file at .data/dev-db.json, mirroring the Supabase tables.
 * Writes are serialised through a promise queue (single process only).
 */
export interface FileLead {
  id: string;
  phone: string;
  contactName: string;
  studentName: string | null;
  studentClass: string | null;
  program: string | null;
  firstSource: string;
  lastSource: string;
  stage: StageKey;
  status: string;
  consentAt: string;
  createdAt: string;
  updatedAt: string;
  // CRM fields
  parentName?: string | null;
  studentPhone?: string | null;
  school?: string | null;
  board?: string | null;
  area?: string | null;
  category?: string | null;
  ownerId?: string | null;
  assignedAt?: string | null;
  nextFollowUpAt?: string | null;
  lastContactAt?: string | null;
  lostReason?: string | null;
  lostCompetitor?: string | null;
}

export interface FileVisit {
  id: string;
  leadId: string;
  date: string;
  slot: string;
  familySize: number;
  program: string | null;
  status: VisitStatus;
  outcome?: string | null;
  outcomeAt?: string | null;
  outcomeBy?: string | null;
  createdAt: string;
}

export interface DB {
  leads: FileLead[];
  touchpoints: Record<string, unknown>[];
  visits: FileVisit[];
  bsat: { id: string; leadId: string; sessionId: string; stream: string; hallTicket: string; createdAt: string }[];
  otps: OtpRecord[];
  staff: Staff[];
  calls: CallLog[];
  audit: AuditEntry[];
  importBatches: ImportBatch[];
  signOffs: (StageSignOff & { leadId: string })[];
  documents: (DocRow & { leadId: string })[];
  payments: PaymentRow[];
  students: StudentRow[];
  reversals: ReversalRow[];
  counters: Record<string, number>;
  seq: { bsat: number };
}

const FILE = path.join(process.cwd(), '.data', 'dev-db.json');
const empty = (): DB => ({ leads: [], touchpoints: [], visits: [], bsat: [], otps: [], staff: [], calls: [], audit: [], importBatches: [], signOffs: [], documents: [], payments: [], students: [], reversals: [], counters: {}, seq: { bsat: 0 } });

async function load(): Promise<DB> {
  let db: DB;
  try {
    // Tolerate a BOM in case the file was hand-edited (e.g. saved from PowerShell or Notepad).
    db = { ...empty(), ...JSON.parse((await fs.readFile(FILE, 'utf8')).replace(/^﻿/, '')) };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    db = empty();
  }
  if (db.staff.length === 0) db.staff = devStaff.items.map((s) => ({ ...s, email: null, phone: null, active: true }));
  return db;
}

async function save(db: DB) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2));
  await fs.rename(tmp, FILE);
}

let queue: Promise<unknown> = Promise.resolve();
export function tx<T>(fn: (db: DB) => T | Promise<T>, write = true): Promise<T> {
  const run = queue.then(async () => {
    const db = await load();
    const result = await fn(db);
    if (write) await save(db);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export function pushAudit(db: DB, leadId: string, entry: Omit<AuditEntry, 'id' | 'at' | 'leadId'>) {
  db.audit.push({ id: randomUUID(), leadId, at: new Date().toISOString(), ...entry });
}

function upsertLead(db: DB, input: LeadInput & { source: string }): { lead: FileLead; isNew: boolean } {
  const now = new Date().toISOString();
  let lead = db.leads.find((l) => l.phone === input.phone);
  const isNew = !lead;
  if (!lead) {
    lead = {
      id: randomUUID(),
      phone: input.phone,
      contactName: input.name,
      studentName: input.studentName ?? null,
      studentClass: input.studentClass ?? null,
      program: input.program ?? null,
      firstSource: input.source,
      lastSource: input.source,
      stage: 'enquiry',
      status: 'open',
      consentAt: now,
      createdAt: now,
      updatedAt: now,
    };
    db.leads.push(lead);
  } else {
    // Merge: keep existing identity fields, take the latest program interest, keep full history.
    lead.studentName ??= input.studentName ?? null;
    lead.studentClass ??= input.studentClass ?? null;
    lead.program = input.program ?? lead.program;
    lead.lastSource = input.source;
    lead.updatedAt = now;
  }
  db.touchpoints.push({ id: randomUUID(), leadId: lead.id, source: input.source, program: input.program ?? null, note: input.note ?? null, ...input.attribution, createdAt: now });
  pushAudit(db, lead.id, { actorId: null, action: isNew ? 'created' : 'touchpoint', field: null, oldValue: null, newValue: input.source, reason: null });
  return { lead, isNew };
}

export function createFileStore(): Store {
  return {
    captureLead: (input) =>
      tx((db) => {
        const { lead, isNew } = upsertLead(db, input);
        return { leadId: lead.id, isNew };
      }),

    slotBookings: (date) =>
      tx((db) => {
        const counts: Record<string, number> = {};
        for (const v of db.visits) if (v.date === date && (v.status === 'scheduled' || v.status === 'arrived')) counts[v.slot] = (counts[v.slot] ?? 0) + 1;
        return counts;
      }, false),

    createVisit: (input) =>
      tx((db) => {
        const cfg = visitSlots.slots.find((s) => s.slot === input.slot);
        if (!cfg) throw new StoreError('invalid_slot');
        const booked = db.visits.filter((v) => v.date === input.date && v.slot === input.slot && (v.status === 'scheduled' || v.status === 'arrived')).length;
        if (booked >= cfg.capacity) throw new StoreError('slot_full');
        const { lead } = upsertLead(db, { ...input, source: 'visit' });
        const id = randomUUID();
        db.visits.push({ id, leadId: lead.id, date: input.date, slot: input.slot, familySize: input.familySize, program: input.program ?? null, status: 'scheduled', createdAt: new Date().toISOString() });
        if (lead.status === 'open') lead.status = 'visit_scheduled';
        pushAudit(db, lead.id, { actorId: null, action: 'visit_booked', field: null, oldValue: null, newValue: `${input.date} ${input.slot}`, reason: null });
        return { visitId: id };
      }),

    registerBsat: (input) =>
      tx((db) => {
        if (!bsat.sessions.some((s) => s.id === input.sessionId)) throw new StoreError('invalid_session');
        const { lead } = upsertLead(db, { ...input, source: 'bsat' });
        const existing = db.bsat.find((r) => r.leadId === lead.id);
        if (existing) return { hallTicket: existing.hallTicket, alreadyRegistered: true };
        db.seq.bsat += 1;
        const hallTicket = `BSAT27-${String(db.seq.bsat).padStart(5, '0')}`;
        db.bsat.push({ id: randomUUID(), leadId: lead.id, sessionId: input.sessionId, stream: input.stream, hallTicket, createdAt: new Date().toISOString() });
        pushAudit(db, lead.id, { actorId: null, action: 'bsat_registered', field: null, oldValue: null, newValue: hallTicket, reason: null });
        return { hallTicket, alreadyRegistered: false };
      }),

    findAdmission: (phone) =>
      tx((db): AdmissionRecord | null => {
        const lead = db.leads.find((l) => l.phone === phone);
        if (!lead) return null;
        const visit = db.visits.filter((v) => v.leadId === lead.id && v.status === 'scheduled').sort((a, b) => a.date.localeCompare(b.date))[0];
        const owner = lead.ownerId ? db.staff.find((s) => s.id === lead.ownerId) : null;
        return {
          studentName: lead.studentName,
          contactName: lead.contactName,
          program: lead.program,
          completedStage: lead.stage,
          events: [{ stage: 'enquiry', at: lead.createdAt, owner: null }],
          owner: owner ? owner.fullName.split(' ')[0] : null,
          nextUpdate: lead.nextFollowUpAt ?? null,
          upcomingVisit: visit ? { date: visit.date, slot: visit.slot } : null,
        };
      }, false),

    putOtp: (rec) =>
      tx((db) => {
        db.otps = db.otps.filter((o) => o.phone !== rec.phone && new Date(o.expiresAt).getTime() > Date.now());
        db.otps.push(rec);
      }),

    getOtp: (phone) => tx((db) => db.otps.find((o) => o.phone === phone) ?? null, false),

    patchOtp: (phone, patch) =>
      tx((db) => {
        const rec = db.otps.find((o) => o.phone === phone);
        if (rec) Object.assign(rec, patch);
      }),
  };
}

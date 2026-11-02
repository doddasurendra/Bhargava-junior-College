import { randomUUID } from 'node:crypto';
import { pushAudit, tx, type FileLead, type FileVisit } from '../store/file';
import type { CrmLead, CrmRepo, LeadCategory, LeadStatus, Touchpoint, VisitRow } from './types';

const toLead = (l: FileLead): CrmLead => ({
  id: l.id,
  phone: l.phone,
  contactName: l.contactName ?? null,
  parentName: l.parentName ?? null,
  studentName: l.studentName ?? null,
  studentPhone: l.studentPhone ?? null,
  school: l.school ?? null,
  classLevel: l.studentClass ?? null,
  board: l.board ?? null,
  area: l.area ?? null,
  program: l.program ?? null,
  category: (l.category as LeadCategory) ?? null,
  status: l.status as LeadStatus,
  stage: l.stage,
  ownerId: l.ownerId ?? null,
  firstSource: l.firstSource,
  lastSource: l.lastSource,
  nextFollowUpAt: l.nextFollowUpAt ?? null,
  lastContactAt: l.lastContactAt ?? null,
  lostReason: l.lostReason ?? null,
  lostCompetitor: l.lostCompetitor ?? null,
  createdAt: l.createdAt,
  updatedAt: l.updatedAt,
});

const toVisit = (v: FileVisit): VisitRow => ({
  id: v.id,
  leadId: v.leadId,
  date: v.date,
  slot: v.slot,
  familySize: v.familySize,
  program: v.program,
  status: v.status,
  outcome: v.outcome ?? null,
  outcomeAt: v.outcomeAt ?? null,
  outcomeBy: v.outcomeBy ?? null,
  createdAt: v.createdAt,
});

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');

export function createFileCrmRepo(): CrmRepo {
  return {
    listStaff: () => tx((db) => db.staff.filter((s) => s.active), false),
    getStaff: (id) => tx((db) => db.staff.find((s) => s.id === id) ?? null, false),

    listLeads: (f) =>
      tx((db) => {
        const q = f.q ? norm(f.q) : null;
        return db.leads
          .filter((l) => {
            if (f.ids && !f.ids.includes(l.id)) return false;
            if (f.ownerId && l.ownerId !== f.ownerId) return false;
            if (f.unassigned && l.ownerId) return false;
            if (f.category === 'none' ? l.category : f.category && l.category !== f.category) return false;
            if (f.status && l.status !== f.status) return false;
            if (f.program && l.program !== f.program) return false;
            if (f.source && l.firstSource !== f.source && l.lastSource !== f.source) return false;
            if (q && ![l.contactName, l.studentName, l.phone, l.school].some((v) => v && norm(v).includes(q))) return false;
            return true;
          })
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .slice(0, f.limit ?? 500)
          .map(toLead);
      }, false),

    getLead: (id) =>
      tx((db) => {
        const l = db.leads.find((x) => x.id === id);
        return l ? toLead(l) : null;
      }, false),

    getLeadHistory: (id) =>
      tx(
        (db) => ({
          touchpoints: db.touchpoints
            .filter((t) => t.leadId === id)
            .map(
              (t): Touchpoint => ({
                id: String(t.id),
                leadId: id,
                source: String(t.source),
                program: (t.program as string) ?? null,
                note: (t.note as string) ?? null,
                utmSource: (t.utm_source as string) ?? null,
                utmCampaign: (t.utm_campaign as string) ?? null,
                page: (t.page as string) ?? null,
                device: (t.device as string) ?? null,
                createdAt: String(t.createdAt),
              }),
            ),
          calls: db.calls.filter((c) => c.leadId === id),
          audit: db.audit.filter((a) => a.leadId === id),
          visits: db.visits.filter((v) => v.leadId === id).map(toVisit),
        }),
        false,
      ),

    updateLead: (id, patch, audit) =>
      tx((db) => {
        const l = db.leads.find((x) => x.id === id);
        if (!l) throw new Error('lead_not_found');
        Object.assign(l, patch, { updatedAt: new Date().toISOString() });
        for (const a of audit) pushAudit(db, id, { actorId: null, field: null, oldValue: null, newValue: null, reason: null, ...a });
      }),

    addCall: (call) =>
      tx((db) => {
        db.calls.push({ ...call, id: randomUUID(), createdAt: new Date().toISOString() });
      }),

    listVisits: (f) =>
      tx(
        (db) =>
          db.visits
            .filter((v) => (!f.from || v.date >= f.from) && (!f.to || v.date <= f.to) && (!f.statuses || f.statuses.includes(v.status)))
            .sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot))
            .map(toVisit),
        false,
      ),

    getVisit: (id) =>
      tx((db) => {
        const v = db.visits.find((x) => x.id === id);
        return v ? toVisit(v) : null;
      }, false),

    updateVisit: (id, patch, audit) =>
      tx((db) => {
        const v = db.visits.find((x) => x.id === id);
        if (!v) throw new Error('visit_not_found');
        Object.assign(v, patch);
        for (const a of audit) pushAudit(db, v.leadId, { actorId: null, field: null, oldValue: null, newValue: null, reason: null, ...a });
      }),
  };
}

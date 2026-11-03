import { randomUUID } from 'node:crypto';
import { pushAudit, tx, type FileLead, type FileVisit } from '../store/file';
import { createFileVerifyRepo } from './fileVerifyRepo';
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
  assignedAt: l.assignedAt ?? null,
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
    ...createFileVerifyRepo(),
    findExistingPhones: (phones) =>
      tx((db) => {
        const wanted = new Set(phones);
        const found = new Set<string>();
        for (const l of db.leads) {
          if (wanted.has(l.phone)) found.add(l.phone);
          if (l.studentPhone && wanted.has(l.studentPhone)) found.add(l.studentPhone);
        }
        return found;
      }, false),

    importLeads: (records, meta) =>
      tx((db) => {
        const now = new Date().toISOString();
        const batchId = randomUUID();
        let created = 0;
        let merged = 0;
        for (const r of records) {
          const match = db.leads.find(
            (l) => l.phone === r.phone || l.studentPhone === r.phone || (r.studentPhone && (l.phone === r.studentPhone || l.studentPhone === r.studentPhone)),
          );
          let lead: FileLead;
          if (!match) {
            lead = {
              id: randomUUID(),
              phone: r.phone,
              contactName: r.parentName ?? r.studentName ?? '',
              parentName: r.parentName,
              studentName: r.studentName,
              studentPhone: r.studentPhone,
              studentClass: r.classLevel,
              school: r.school,
              board: r.board,
              area: r.area,
              program: r.program,
              firstSource: meta.source,
              lastSource: meta.source,
              stage: 'enquiry',
              status: 'open',
              consentAt: '', // imported data: no web consent captured
              createdAt: now,
              updatedAt: now,
            };
            db.leads.push(lead);
            created++;
            pushAudit(db, lead.id, { actorId: meta.actorId, action: 'created', field: null, oldValue: null, newValue: meta.source, reason: `import ${meta.fileName}` });
          } else {
            lead = match;
            // Fill blanks only — never overwrite what staff or the family already gave us.
            lead.parentName ??= r.parentName;
            lead.studentName ??= r.studentName;
            lead.studentPhone ??= r.studentPhone && r.studentPhone !== lead.phone ? r.studentPhone : null;
            lead.studentClass ??= r.classLevel;
            lead.school ??= r.school;
            lead.board ??= r.board;
            lead.area ??= r.area;
            lead.program ??= r.program;
            if (!lead.contactName) lead.contactName = r.parentName ?? r.studentName ?? '';
            lead.lastSource = meta.source;
            lead.updatedAt = now;
            merged++;
            pushAudit(db, lead.id, { actorId: meta.actorId, action: 'merged_import', field: null, oldValue: null, newValue: meta.source, reason: `import ${meta.fileName}, line ${r.line}` });
          }
          db.touchpoints.push({ id: randomUUID(), leadId: lead.id, source: meta.source, program: r.program, note: [r.note, `import ${meta.fileName} line ${r.line}`].filter(Boolean).join(' · '), createdAt: now });
        }
        db.importBatches.push({ ...meta, id: batchId, created, merged, createdAt: now });
        return { batchId, created, merged };
      }),

    exportForMetrics: (since) =>
      tx(
        (db) => ({
          leads: db.leads.map(toLead),
          calls: db.calls.filter((c) => c.createdAt >= since),
          audit: db.audit.filter((a) => a.at >= since),
          visits: db.visits.filter((v) => v.createdAt >= since || v.status === 'scheduled' || v.status === 'arrived' || (v.outcomeAt ?? '') >= since).map(toVisit),
          signOffs: db.signOffs.filter((s) => s.at >= since).map((s) => ({ leadId: s.leadId, stage: s.stage, at: s.at })),
        }),
        false,
      ),

    listImportBatches: (limit = 20) => tx((db) => [...db.importBatches].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit), false),

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

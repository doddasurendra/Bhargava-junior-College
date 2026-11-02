import { createClient } from '@supabase/supabase-js';
import type { AuditInput, CrmLead, CrmRepo, LeadPatch, Role, Staff, VisitPatch, VisitRow } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const toLead = (r: Row): CrmLead => ({
  id: r.id,
  phone: r.phone,
  contactName: r.contact_name,
  parentName: r.parent_name,
  studentName: r.student_name,
  studentPhone: r.student_phone,
  school: r.school,
  classLevel: r.class_level,
  board: r.board,
  area: r.area,
  program: r.program,
  category: r.category,
  status: r.status,
  stage: r.stage,
  ownerId: r.owner_id,
  assignedAt: r.assigned_at,
  firstSource: r.first_source,
  lastSource: r.last_source,
  nextFollowUpAt: r.next_follow_up_at,
  lastContactAt: r.last_contact_at,
  lostReason: r.lost_reason,
  lostCompetitor: r.lost_competitor,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toVisit = (r: Row): VisitRow => ({
  id: r.id,
  leadId: r.lead_id,
  date: r.visit_date,
  slot: r.slot,
  familySize: r.family_size,
  program: r.program,
  status: r.status,
  outcome: r.outcome,
  outcomeAt: r.outcome_at,
  outcomeBy: r.outcome_by,
  createdAt: r.created_at,
});

const leadPatchRow = (p: LeadPatch): Row => {
  const map: Record<keyof LeadPatch, string> = {
    category: 'category',
    status: 'status',
    stage: 'stage',
    ownerId: 'owner_id',
    assignedAt: 'assigned_at',
    nextFollowUpAt: 'next_follow_up_at',
    lastContactAt: 'last_contact_at',
    lostReason: 'lost_reason',
    lostCompetitor: 'lost_competitor',
  };
  const row: Row = {};
  for (const [k, v] of Object.entries(p)) row[map[k as keyof LeadPatch]] = v;
  return row;
};

const auditRows = (leadId: string, audit: AuditInput[]) =>
  audit.map((a) => ({ lead_id: leadId, actor_id: a.actorId ?? null, action: a.action, field: a.field ?? null, old_value: a.oldValue ?? null, new_value: a.newValue ?? null, reason: a.reason ?? null }));

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

function rows<T>(res: { data: T[] | null; error: { message: string } | null }): T[] {
  if (res.error) throw new Error(res.error.message);
  return res.data ?? [];
}

/** Server-only, service role. Authorisation is enforced in ./service.ts before any call. */
export function createSupabaseCrmRepo(url: string, serviceKey: string): CrmRepo {
  const sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const toStaff = (r: Row): Staff => ({
    id: r.id,
    fullName: r.full_name,
    email: r.email,
    phone: r.phone,
    active: r.active,
    roles: (r.user_roles ?? []).map((x: Row) => x.role as Role),
  });

  const chunks = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

  return {
    async findExistingPhones(phones) {
      const found = new Set<string>();
      for (const part of chunks(Array.from(new Set(phones)), 200)) {
        const [a, b] = await Promise.all([
          sb.from('leads').select('phone').is('merged_into', null).in('phone', part),
          sb.from('leads').select('student_phone').is('merged_into', null).in('student_phone', part),
        ]);
        for (const r of rows(a)) found.add(r.phone);
        for (const r of rows(b)) found.add(r.student_phone);
      }
      return found;
    },

    async importLeads(records, meta) {
      const batch = check(
        await sb
          .from('import_batches')
          .insert({ file_name: meta.fileName, source: meta.source, actor_id: meta.actorId, total_rows: meta.totalRows, invalid: meta.invalid, duplicates_in_file: meta.duplicatesInFile })
          .select('id')
          .single(),
      );
      if (!batch) throw new Error('import batch not created');
      let created = 0;
      let merged = 0;
      for (const part of chunks(records, 500)) {
        const payload = part.map((r) => ({
          line: r.line,
          phone: r.phone,
          student_phone: r.studentPhone,
          student_name: r.studentName,
          parent_name: r.parentName,
          school: r.school,
          class_level: r.classLevel,
          board: r.board,
          area: r.area,
          program: r.program,
          note: r.note,
        }));
        const res: { created: number; merged: number }[] = rows(await sb.rpc('import_leads', { p_batch: batch.id, p_actor: meta.actorId, p_source: meta.source, p_file: meta.fileName, p_rows: payload }));
        created += res[0]?.created ?? 0;
        merged += res[0]?.merged ?? 0;
      }
      return { batchId: batch.id, created, merged };
    },

    async listImportBatches(limit = 20) {
      return rows(await sb.from('import_batches').select('*').order('created_at', { ascending: false }).limit(limit)).map((r: Row) => ({
        id: r.id,
        fileName: r.file_name,
        source: r.source,
        actorId: r.actor_id,
        totalRows: r.total_rows,
        invalid: r.invalid,
        duplicatesInFile: r.duplicates_in_file,
        created: r.created,
        merged: r.merged,
        createdAt: r.created_at,
      }));
    },

    async listStaff() {
      return rows(await sb.from('profiles').select('id, full_name, email, phone, active, user_roles(role)').eq('active', true).order('full_name')).map(toStaff);
    },
    async getStaff(id) {
      const r = check(await sb.from('profiles').select('id, full_name, email, phone, active, user_roles(role)').eq('id', id).maybeSingle());
      return r ? toStaff(r) : null;
    },

    async listLeads(f) {
      let q = sb.from('leads').select('*').is('merged_into', null);
      if (f.ids) q = q.in('id', f.ids);
      if (f.ownerId) q = q.eq('owner_id', f.ownerId);
      if (f.unassigned) q = q.is('owner_id', null);
      if (f.category === 'none') q = q.is('category', null);
      else if (f.category) q = q.eq('category', f.category);
      if (f.status) q = q.eq('status', f.status);
      if (f.program) q = q.eq('program', f.program);
      if (f.source) q = q.or(`first_source.eq.${f.source},last_source.eq.${f.source}`);
      if (f.q) {
        // Strip PostgREST filter syntax characters before interpolating.
        const s = f.q.replace(/[^\p{L}\p{N} +]/gu, '').trim();
        if (s) q = q.or(`contact_name.ilike.%${s}%,student_name.ilike.%${s}%,phone.ilike.%${s.replace(/\s/g, '')}%,school.ilike.%${s}%`);
      }
      return rows(await q.order('updated_at', { ascending: false }).limit(f.limit ?? 500)).map(toLead);
    },

    async getLead(id) {
      const r = check(await sb.from('leads').select('*').eq('id', id).maybeSingle());
      return r ? toLead(r) : null;
    },

    async getLeadHistory(id) {
      const [tp, calls, audit, visits] = await Promise.all([
        sb.from('lead_touchpoints').select('*').eq('lead_id', id),
        sb.from('call_logs').select('*').eq('lead_id', id),
        sb.from('lead_audit').select('*').eq('lead_id', id),
        sb.from('visits').select('*').eq('lead_id', id),
      ]);
      return {
        touchpoints: rows(tp).map((r: Row) => ({ id: r.id, leadId: id, source: r.source, program: r.program, note: r.note, utmSource: r.utm_source, utmCampaign: r.utm_campaign, page: r.page, device: r.device, createdAt: r.created_at })),
        calls: rows(calls).map((r: Row) => ({ id: r.id, leadId: id, actorId: r.actor_id, outcome: r.outcome, interest: r.interest, notes: r.notes, nextFollowUpAt: r.next_follow_up_at, createdAt: r.created_at })),
        audit: rows(audit).map((r: Row) => ({ id: String(r.id), leadId: id, actorId: r.actor_id, action: r.action, field: r.field, oldValue: r.old_value, newValue: r.new_value, reason: r.reason, at: r.at })),
        visits: rows(visits).map(toVisit),
      };
    },

    async updateLead(id, patch, audit) {
      check(await sb.from('leads').update(leadPatchRow(patch)).eq('id', id));
      if (audit.length) check(await sb.from('lead_audit').insert(auditRows(id, audit)));
    },

    async addCall(c) {
      check(await sb.from('call_logs').insert({ lead_id: c.leadId, actor_id: c.actorId, outcome: c.outcome, interest: c.interest, notes: c.notes, next_follow_up_at: c.nextFollowUpAt }));
    },

    async listVisits(f) {
      let q = sb.from('visits').select('*');
      if (f.from) q = q.gte('visit_date', f.from);
      if (f.to) q = q.lte('visit_date', f.to);
      if (f.statuses) q = q.in('status', f.statuses);
      return rows(await q.order('visit_date').order('slot').limit(500)).map(toVisit);
    },

    async getVisit(id) {
      const r = check(await sb.from('visits').select('*').eq('id', id).maybeSingle());
      return r ? toVisit(r) : null;
    },

    async updateVisit(id, patch: VisitPatch, audit) {
      const row: Row = {};
      if (patch.status) row.status = patch.status;
      if (patch.outcome !== undefined) row.outcome = patch.outcome;
      if (patch.outcomeAt !== undefined) row.outcome_at = patch.outcomeAt;
      if (patch.outcomeBy !== undefined) row.outcome_by = patch.outcomeBy;
      const v = check(await sb.from('visits').update(row).eq('id', id).select('lead_id').single());
      if (!v) throw new Error('visit_not_found');
      if (audit.length) check(await sb.from('lead_audit').insert(auditRows(v.lead_id, audit)));
    },
  };
}

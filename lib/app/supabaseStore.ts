import { createClient } from '@supabase/supabase-js';
import type { StudentRow } from '../crm/verification';
import type { AppStore, Guardian, HostelEvent } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

function ok<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const toStudent = (s: Row): StudentRow => ({
  id: s.id,
  leadId: s.lead_id,
  fullName: s.full_name,
  dob: s.dob,
  gender: s.gender,
  program: s.program,
  stay: s.stay,
  guardianName: s.guardian_name,
  guardianPhone: s.guardian_phone,
  loginPhone: s.login_phone,
  collegeId: s.college_id,
  createdBy: s.created_by,
  createdAt: s.created_at,
});
const toGuardian = (g: Row): Guardian => ({ studentId: g.student_id, phone: g.phone, name: g.name, relation: g.relation, addedBy: g.added_by, addedAt: g.added_at });
const toEvent = (e: Row): HostelEvent => ({ id: e.id, studentId: e.student_id, direction: e.direction, at: e.at, device: e.device, deviceEventId: e.device_event_id, alerted: e.alerted });

export function createSupabaseAppStore(url: string, key: string): AppStore {
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    async listStudents() {
      return ((ok(await sb.from('students').select('*').not('college_id', 'is', null).order('full_name').limit(5000)) ?? []) as Row[]).map(toStudent);
    },
    async getStudent(id) {
      const r = ok(await sb.from('students').select('*').eq('id', id).maybeSingle()) as Row | null;
      return r ? toStudent(r) : null;
    },
    async studentByCollegeId(cid) {
      const r = ok(await sb.from('students').select('*').eq('college_id', cid).maybeSingle()) as Row | null;
      return r ? toStudent(r) : null;
    },
    async studentsByLoginPhone(phone) {
      return ((ok(await sb.from('students').select('*').eq('login_phone', phone).not('college_id', 'is', null)) ?? []) as Row[]).map(toStudent);
    },
    async guardiansByPhone(phone) {
      return ((ok(await sb.from('student_guardians').select('*').eq('phone', phone)) ?? []) as Row[]).map(toGuardian);
    },
    async guardiansOf(studentId) {
      return ((ok(await sb.from('student_guardians').select('*').eq('student_id', studentId).order('added_at')) ?? []) as Row[]).map(toGuardian);
    },
    async addGuardian(g) {
      const res = await sb.from('student_guardians').insert({ student_id: g.studentId, phone: g.phone, name: g.name, relation: g.relation, added_by: g.addedBy });
      if (res.error?.code === '23505') return 'exists';
      ok(res);
      const s = ok(await sb.from('students').select('lead_id').eq('id', g.studentId).single()) as Row;
      ok(await sb.from('lead_audit').insert({ lead_id: s.lead_id, actor_id: g.addedBy, action: 'guardian_added', field: 'app_access', new_value: `${g.name} (${g.relation})` }));
      return 'added';
    },
    async removeGuardian(studentId, phone) {
      ok(await sb.from('student_guardians').delete().eq('student_id', studentId).eq('phone', phone));
    },
    async applicationsByPhone(phone) {
      const rows = (ok(await sb.from('leads').select('id, student_name, contact_name, college_id, status').is('merged_into', null).or(`phone.eq.${phone},student_phone.eq.${phone}`)) ?? []) as Row[];
      return rows.filter((l) => !l.college_id && l.status !== 'invalid').map((l) => ({ leadId: l.id, name: l.student_name ?? l.contact_name ?? 'Your application' }));
    },
    async addHostelEvent(e) {
      const res = await sb.from('hostel_events').insert({ student_id: e.studentId, direction: e.direction, at: e.at, device: e.device, device_event_id: e.deviceEventId }).select('*').single();
      if (res.error?.code === '23505') return null;
      return toEvent(ok(res) as Row);
    },
    async markAlerted(id, n) {
      ok(await sb.from('hostel_events').update({ alerted: n }).eq('id', id));
    },
    async hostelEvents(studentId, limit = 30) {
      return ((ok(await sb.from('hostel_events').select('*').eq('student_id', studentId).order('at', { ascending: false }).limit(limit)) ?? []) as Row[]).map(toEvent);
    },
  };
}

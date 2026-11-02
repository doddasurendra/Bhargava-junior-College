import { createClient } from '@supabase/supabase-js';
import { firstName, type StageKey } from '../admission';
import { todayIST } from '../dates';
import { StoreError, type LeadInput, type Store } from './types';

/** Server-only. Uses the service-role key; never import from client components. */
export function createSupabaseStore(url: string, serviceKey: string): Store {
  const sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const leadPayload = (i: Omit<LeadInput, 'source'> & { source?: string }) => ({
    name: i.name,
    student_name: i.studentName ?? null,
    phone: i.phone,
    student_class: i.studentClass ?? null,
    program: i.program ?? null,
    source: i.source ?? null,
    note: i.note ?? null,
    consent: i.consent,
    ...i.attribution,
  });

  const mapError = (message: string): never => {
    for (const code of ['slot_full', 'session_full', 'invalid_slot', 'invalid_session', 'closed_day'] as const) {
      if (message.includes(code)) throw new StoreError(code);
    }
    throw new Error(message);
  };

  const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

  return {
    async captureLead(input) {
      const { data, error } = await sb.rpc('capture_lead', { p: leadPayload(input) });
      if (error) throw new Error(error.message);
      const row = one(data as { lead_id: string; is_new: boolean }[]);
      if (!row) throw new Error('capture_lead returned no row');
      return { leadId: row.lead_id, isNew: row.is_new };
    },

    async slotBookings(date) {
      const { data, error } = await sb.from('visits').select('slot').eq('visit_date', date).in('status', ['scheduled', 'arrived']);
      if (error) throw new Error(error.message);
      const counts: Record<string, number> = {};
      for (const r of data ?? []) counts[r.slot] = (counts[r.slot] ?? 0) + 1;
      return counts;
    },

    async createVisit(input) {
      const { data, error } = await sb.rpc('book_visit', { p: { ...leadPayload(input), date: input.date, slot: input.slot, family_size: input.familySize } });
      if (error) mapError(error.message);
      return { visitId: data as string };
    },

    async registerBsat(input) {
      const { data, error } = await sb.rpc('register_bsat', { p: { ...leadPayload(input), session_id: input.sessionId, stream: input.stream } });
      if (error) mapError(error.message);
      const row = one(data as { hall_ticket: string; already_registered: boolean }[]);
      if (!row) throw new Error('register_bsat returned no row');
      return { hallTicket: row.hall_ticket, alreadyRegistered: row.already_registered };
    },

    async findAdmission(phone) {
      const { data: lead, error } = await sb
        .from('leads')
        .select('id, contact_name, student_name, program, stage, next_follow_up_at, owner:profiles!leads_owner_id_fkey(full_name)')
        .eq('phone', phone)
        .is('merged_into', null)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!lead) return null;

      const [{ data: events }, { data: visit }] = await Promise.all([
        sb.from('admission_stage_events').select('stage, completed_at, owner:profiles!admission_stage_events_owner_id_fkey(full_name)').eq('lead_id', lead.id),
        sb.from('visits').select('visit_date, slot').eq('lead_id', lead.id).eq('status', 'scheduled').gte('visit_date', todayIST()).order('visit_date').limit(1).maybeSingle(),
      ]);

      return {
        studentName: lead.student_name,
        contactName: lead.contact_name,
        program: lead.program,
        completedStage: lead.stage as StageKey,
        events: (events ?? []).map((e) => ({
          stage: e.stage as StageKey,
          at: e.completed_at,
          owner: firstName(one(e.owner as { full_name: string } | { full_name: string }[] | null)?.full_name),
        })),
        owner: firstName(one(lead.owner as { full_name: string } | { full_name: string }[] | null)?.full_name),
        nextUpdate: lead.next_follow_up_at,
        upcomingVisit: visit ? { date: visit.visit_date, slot: visit.slot } : null,
      };
    },

    async putOtp(rec) {
      const { error } = await sb.from('otp_challenges').upsert({ phone: rec.phone, code_hash: rec.codeHash, expires_at: rec.expiresAt, attempts: 0, consumed_at: null });
      if (error) throw new Error(error.message);
    },

    async getOtp(phone) {
      const { data, error } = await sb.from('otp_challenges').select('*').eq('phone', phone).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { phone: data.phone, codeHash: data.code_hash, expiresAt: data.expires_at, attempts: data.attempts, consumed: Boolean(data.consumed_at) } : null;
    },

    async patchOtp(phone, patch) {
      const row: Record<string, unknown> = {};
      if (patch.attempts !== undefined) row.attempts = patch.attempts;
      if (patch.consumed) row.consumed_at = new Date().toISOString();
      const { error } = await sb.from('otp_challenges').update(row).eq('phone', phone);
      if (error) throw new Error(error.message);
    },
  };
}

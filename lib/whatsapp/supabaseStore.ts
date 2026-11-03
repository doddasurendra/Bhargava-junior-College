import { createClient } from '@supabase/supabase-js';
import type { InboundRow, MessageStore, OutboundMessage } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

function ok<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const toOut = (r: Row): OutboundMessage => ({
  id: r.id,
  leadId: r.lead_id,
  to: r.to_phone,
  template: r.template,
  body: r.body,
  status: r.status,
  providerId: r.provider_message_id,
  error: r.error,
  dedupeKey: r.dedupe_key,
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toIn = (r: Row): InboundRow => ({ id: r.id, providerId: r.provider_message_id, from: r.from_phone, leadId: r.lead_id, type: r.type, text: r.text, receivedAt: r.received_at });

export function createSupabaseMessageStore(url: string, key: string): MessageStore {
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    async leadForPhone(phone) {
      const r = ok(await sb.from('leads').select('id, consent').is('merged_into', null).is('sibling_of', null).or(`phone.eq.${phone},student_phone.eq.${phone}`).limit(1).maybeSingle()) as Row | null;
      return r ? { id: r.id, consent: Boolean(r.consent) } : null;
    },

    async insertOutbound(m) {
      const res = await sb
        .from('wa_messages')
        .insert({ lead_id: m.leadId, to_phone: m.to, template: m.template, body: m.body, status: m.status, provider_message_id: m.providerId, error: m.error, dedupe_key: m.dedupeKey, created_by: m.createdBy })
        .select('*')
        .single();
      if (res.error?.code === '23505') return null; // dedupe_key already used
      return toOut(ok(res) as Row);
    },

    async updateOutbound(id, patch) {
      const row: Row = { updated_at: new Date().toISOString() };
      if (patch.status) row.status = patch.status;
      if (patch.providerId !== undefined) row.provider_message_id = patch.providerId;
      if (patch.error !== undefined) row.error = patch.error;
      ok(await sb.from('wa_messages').update(row).eq('id', id));
    },

    async applyStatus(providerId, status, error) {
      ok(await sb.rpc('wa_apply_status', { p_provider_id: providerId, p_status: status, p_error: error }));
    },

    async insertInbound(m) {
      const res = await sb.from('wa_inbound').insert({ provider_message_id: m.providerId, from_phone: m.from, lead_id: m.leadId, type: m.type, text: m.text, received_at: m.receivedAt });
      if (res.error?.code === '23505') return false;
      ok(res);
      return true;
    },

    async isOptedOut(phone) {
      return Boolean(ok(await sb.from('wa_opt_outs').select('phone').eq('phone', phone).maybeSingle()));
    },

    async setOptOut(phone, optedOut, source) {
      if (optedOut) ok(await sb.from('wa_opt_outs').upsert({ phone, source, at: new Date().toISOString() }));
      else ok(await sb.from('wa_opt_outs').delete().eq('phone', phone));
      const lead = await this.leadForPhone(phone);
      if (lead) ok(await sb.from('lead_audit').insert({ lead_id: lead.id, action: optedOut ? 'whatsapp_opt_out' : 'whatsapp_opt_in', field: 'whatsapp', new_value: source }));
    },

    async recordConsent(leadId, actorId, note) {
      ok(await sb.from('leads').update({ consent: true, consent_at: new Date().toISOString() }).eq('id', leadId));
      ok(await sb.from('lead_audit').insert({ lead_id: leadId, actor_id: actorId, action: 'consent_recorded', field: 'consent', old_value: 'false', new_value: 'true', reason: note }));
    },

    async listForLead(leadId, limit = 100) {
      const [o, i] = await Promise.all([
        sb.from('wa_messages').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(limit),
        sb.from('wa_inbound').select('*').eq('lead_id', leadId).order('received_at', { ascending: false }).limit(limit),
      ]);
      return { outbound: (ok(o) ?? []).map(toOut).reverse(), inbound: (ok(i) ?? []).map(toIn).reverse() };
    },
  };
}

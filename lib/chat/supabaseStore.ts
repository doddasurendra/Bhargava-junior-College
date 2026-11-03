import { createClient } from '@supabase/supabase-js';
import type { ConvMessage, Conversation, ConversationStore } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

function ok<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const toConv = (r: Row): Conversation => ({
  id: r.id,
  channel: r.channel,
  contactPhone: r.contact_phone,
  contactName: r.contact_name,
  leadId: r.lead_id,
  status: r.status,
  assigneeId: r.assignee_id,
  handoffReason: r.handoff_reason,
  handoffAt: r.handoff_at,
  lastMessageAt: r.last_message_at,
  lastInboundAt: r.last_inbound_at,
  unread: r.unread,
  visitorTokenHash: r.visitor_token_hash,
  createdAt: r.created_at,
  closedAt: r.closed_at,
  closeNote: r.close_note,
  consentAt: r.consent_at,
});

const toMsg = (r: Row): ConvMessage => ({ id: r.id, conversationId: r.conversation_id, author: r.author, staffId: r.staff_id, text: r.text, waMessageId: r.wa_message_id, createdAt: r.created_at });

const COLS: Record<string, string> = {
  status: 'status',
  assigneeId: 'assignee_id',
  leadId: 'lead_id',
  contactName: 'contact_name',
  handoffReason: 'handoff_reason',
  handoffAt: 'handoff_at',
  closedAt: 'closed_at',
  closeNote: 'close_note',
  unread: 'unread',
  contactPhone: 'contact_phone',
  consentAt: 'consent_at',
};

export function createSupabaseConversationStore(url: string, key: string): ConversationStore {
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    async create(c) {
      return toConv(
        ok(
          await sb
            .from('conversations')
            .insert({ channel: c.channel, contact_phone: c.contactPhone, contact_name: c.contactName, lead_id: c.leadId, status: c.status, assignee_id: c.assigneeId, handoff_reason: c.handoffReason, handoff_at: c.handoffAt, visitor_token_hash: c.visitorTokenHash })
            .select('*')
            .single(),
        ) as Row,
      );
    },
    async get(id) {
      const r = ok(await sb.from('conversations').select('*').eq('id', id).maybeSingle()) as Row | null;
      return r ? toConv(r) : null;
    },
    async findOpenByPhone(phone) {
      const r = ok(await sb.from('conversations').select('*').eq('channel', 'whatsapp').eq('contact_phone', phone).neq('status', 'closed').order('created_at', { ascending: false }).limit(1).maybeSingle()) as Row | null;
      return r ? toConv(r) : null;
    },
    async update(id, patch) {
      const row: Row = {};
      for (const [k, v] of Object.entries(patch)) row[COLS[k]] = v;
      ok(await sb.from('conversations').update(row).eq('id', id));
    },
    async addMessage(m) {
      return toMsg(ok(await sb.rpc('add_conversation_message', { p_conversation: m.conversationId, p_author: m.author, p_staff: m.staffId, p_text: m.text, p_wa_message: m.waMessageId, p_at: m.createdAt ?? null })) as Row);
    },
    async messages(conversationId, after) {
      let q = sb.from('conversation_messages').select('*').eq('conversation_id', conversationId);
      if (after) q = q.gt('created_at', after);
      return (ok(await q.order('created_at').limit(500)) ?? []).map(toMsg);
    },
    async list(f) {
      let q = sb.from('conversations').select('*');
      if (f.statuses) q = q.in('status', f.statuses);
      if (f.assigneeId) q = q.eq('assignee_id', f.assigneeId);
      if (f.leadIds) q = q.in('lead_id', f.leadIds);
      return (ok(await q.order('last_message_at', { ascending: false }).limit(f.limit ?? 200)) ?? []).map(toConv);
    },
  };
}

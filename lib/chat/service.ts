import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { college } from '@/content/college';
import { can } from '../crm/permissions';
import { getCrmRepo } from '../crm/repo';
import { getStore } from '../store';
import type { Attribution } from '../validation';
import { sendFreeText, type FreshInbound } from '../whatsapp/service';
import { createFileConversationStore } from './fileStore';
import { formatOpening, isOfficeOpen, nextOpening } from './hours';
import { routeConversation } from './rules';
import { createSupabaseConversationStore } from './supabaseStore';
import type { Conversation, ConversationStore } from './types';

let store: ConversationStore | null = null;
export function getConversationStore(): ConversationStore {
  if (store) return store;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  store = url && key ? createSupabaseConversationStore(url, key) : createFileConversationStore();
  return store;
}

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

async function routeFor(leadId: string | null) {
  if (!leadId) return { status: 'waiting' as const, assigneeId: null, lead: null };
  const repo = getCrmRepo();
  const lead = await repo.getLead(leadId);
  const owner = lead?.ownerId ? await repo.getStaff(lead.ownerId) : null;
  return { ...routeConversation({ ownerId: owner?.id ?? null, ownerCanReply: Boolean(owner?.active && can(owner, 'inbox.reply')) }), lead };
}

/**
 * Outside office hours: tell the family when we'll reply and schedule a callback on the lead (brief §5.2).
 * The callback only moves the follow-up earlier, never later.
 */
async function afterHandoff(conv: Conversation, now: Date): Promise<string | null> {
  if (isOfficeOpen(now)) {
    return conv.channel === 'web' ? 'Thanks! A counsellor will join this chat shortly.' : null;
  }
  const opening = nextOpening(now);
  if (conv.leadId) {
    const repo = getCrmRepo();
    const lead = await repo.getLead(conv.leadId);
    if (lead && (!lead.nextFollowUpAt || new Date(lead.nextFollowUpAt) > opening || new Date(lead.nextFollowUpAt) < now)) {
      await repo.updateLead(lead.id, { nextFollowUpAt: opening.toISOString() }, [
        { action: 'callback_scheduled', field: 'next_follow_up_at', oldValue: lead.nextFollowUpAt, newValue: opening.toISOString(), reason: `${conv.channel === 'web' ? 'Website chat' : 'WhatsApp'} handoff outside office hours` },
      ]);
    }
  }
  return `Thanks for your message. Our counsellors are available ${college.hoursShort}. We have scheduled a callback for ${formatOpening(opening)}.`;
}

async function postSystem(conv: Conversation, text: string) {
  const st = getConversationStore();
  if (conv.channel === 'whatsapp' && conv.contactPhone) {
    const r = await sendFreeText({ to: conv.contactPhone, text, leadId: conv.leadId, actorId: null });
    await st.addMessage({ conversationId: conv.id, author: 'system', staffId: null, text, waMessageId: r.outboxId });
  } else {
    await st.addMessage({ conversationId: conv.id, author: 'system', staffId: null, text, waMessageId: null });
  }
}

// ---------------------------------------------------------------- WhatsApp

/** Every new WhatsApp message (not STOP/START) lands in the inbox; a new conversation is a handoff. */
export async function onWhatsAppInbound(m: FreshInbound, now = new Date()) {
  const st = getConversationStore();
  let conv = await st.findOpenByPhone(m.from);
  let isNew = false;
  if (!conv) {
    const route = await routeFor(m.leadId);
    conv = await st.create({
      channel: 'whatsapp',
      contactPhone: m.from,
      contactName: route.lead?.parentName ?? route.lead?.contactName ?? null,
      leadId: m.leadId,
      status: route.status,
      assigneeId: route.assigneeId,
      handoffReason: 'WhatsApp message',
      handoffAt: now.toISOString(),
      visitorTokenHash: null,
    });
    isNew = true;
  }
  await st.addMessage({ conversationId: conv.id, author: 'contact', staffId: null, text: m.text ?? `[${m.type} message]`, waMessageId: null, createdAt: m.at });
  if (isNew) {
    const note = await afterHandoff(conv, now);
    if (note) await postSystem(conv, note);
  }
  return conv.id;
}

// ---------------------------------------------------------------- website chat

export interface WebHandoffInput {
  name: string;
  phone: string;
  question: string | null;
  transcript: { from: 'user' | 'bot'; text: string }[];
  attribution?: Attribution;
}

/** "Talk to a counsellor" from the website widget: capture the lead, open a conversation with the transcript. */
export async function startWebHandoff(input: WebHandoffInput, now = new Date()) {
  const { leadId } = await getStore().captureLead({ name: input.name, phone: input.phone, source: 'chat', consent: true, note: input.question ?? undefined, attribution: input.attribution });
  const route = await routeFor(leadId);
  const token = randomBytes(24).toString('base64url');
  const st = getConversationStore();
  const conv = await st.create({
    channel: 'web',
    contactPhone: input.phone,
    contactName: input.name,
    leadId,
    status: route.status,
    assigneeId: route.assigneeId,
    handoffReason: input.question ? 'Asked for a counsellor' : 'Talk to a counsellor',
    handoffAt: now.toISOString(),
    visitorTokenHash: hashToken(token),
  });
  // Transcript from the widget, before the handoff (the rule-based assistant ran in the browser).
  let t = now.getTime() - input.transcript.length * 1000;
  for (const line of input.transcript.slice(-30)) {
    await st.addMessage({ conversationId: conv.id, author: line.from === 'user' ? 'contact' : 'bot', staffId: null, text: line.text.slice(0, 1000), waMessageId: null, createdAt: new Date(t).toISOString() });
    t += 1000;
  }
  if (input.question) await st.addMessage({ conversationId: conv.id, author: 'contact', staffId: null, text: input.question.slice(0, 1000), waMessageId: null, createdAt: now.toISOString() });
  const note = await afterHandoff(conv, now);
  if (note) await postSystem(conv, note);
  return { conversationId: conv.id, token };
}

/** A new assistant session (website chat, before any handoff). */
export async function startBotConversation() {
  const token = randomBytes(24).toString('base64url');
  const conv = await getConversationStore().create({
    channel: 'web',
    contactPhone: null,
    contactName: null,
    leadId: null,
    status: 'bot',
    assigneeId: null,
    handoffReason: null,
    handoffAt: null,
    visitorTokenHash: hashToken(token),
  });
  return { conv, token };
}

/**
 * Hand an existing assistant conversation to staff. The transcript is already stored, so staff see
 * exactly what the assistant said. Captures/merges the lead when contact details are given.
 */
export async function handoffExisting(conv: Conversation, p: { name: string; phone: string; reason: string; attribution?: Attribution }, now = new Date()) {
  if (conv.status !== 'bot') return;
  const st = getConversationStore();
  const { leadId } = await getStore().captureLead({ name: p.name, phone: p.phone, source: 'chat', consent: true, note: p.reason, attribution: p.attribution });
  const route = await routeFor(leadId);
  await st.update(conv.id, { status: route.status, assigneeId: route.assigneeId, leadId, contactName: p.name, contactPhone: p.phone, handoffReason: p.reason.slice(0, 200), handoffAt: now.toISOString(), unread: 1, consentAt: conv.consentAt ?? now.toISOString() });
  const updated = (await st.get(conv.id))!;
  const note = await afterHandoff(updated, now);
  if (note) await postSystem(updated, note);
}

export async function visitorConversation(id: string, token: string): Promise<Conversation | null> {
  const conv = await getConversationStore().get(id);
  if (!conv || conv.channel !== 'web' || !conv.visitorTokenHash) return null;
  const a = Buffer.from(conv.visitorTokenHash);
  const b = Buffer.from(hashToken(token));
  return a.length === b.length && timingSafeEqual(a, b) ? conv : null;
}

export async function visitorSend(id: string, token: string, text: string) {
  const conv = await visitorConversation(id, token);
  if (!conv) return { ok: false as const, error: 'Chat not found.' };
  if (conv.status === 'closed') return { ok: false as const, error: 'This chat has been closed. Start a new one if you need more help.' };
  await getConversationStore().addMessage({ conversationId: id, author: 'contact', staffId: null, text: text.slice(0, 1000), waMessageId: null });
  return { ok: true as const };
}

export async function visitorPoll(id: string, token: string, after: string | null) {
  const conv = await visitorConversation(id, token);
  if (!conv) return null;
  // Staff-only notes (transfer reasons, close outcomes) never reach the visitor.
  const msgs = (await getConversationStore().messages(id, after ?? undefined)).filter((m) => m.author !== 'note');
  const repo = getCrmRepo();
  const names = new Map<string, string>();
  for (const sid of new Set([conv.assigneeId, ...msgs.map((m) => m.staffId)].filter((x): x is string => Boolean(x)))) {
    names.set(sid, (await repo.getStaff(sid))?.fullName.split(' ')[0] ?? 'Counsellor');
  }
  return {
    status: conv.status,
    agent: conv.assigneeId ? names.get(conv.assigneeId) ?? null : null,
    // First names only; never expose staff ids to the browser.
    messages: msgs.map((m) => ({ id: m.id, author: m.author, text: m.text, at: m.createdAt, name: m.staffId ? names.get(m.staffId) ?? null : null })),
  };
}

import 'server-only';
import { can, canSeeLead } from '../crm/permissions';
import { getCrmRepo } from '../crm/repo';
import { CrmError } from '../crm/service';
import type { Staff } from '../crm/types';
import { sendFreeText } from '../whatsapp/service';
import { canFreeText, MAX_REPLY, windowClosesAt } from './rules';
import { getConversationStore } from './service';
import type { Conversation } from './types';

export type InboxView = 'waiting' | 'mine' | 'open' | 'closed';

const isManager = (u: Staff) => can(u, 'inbox.all');

/** Waiting conversations are visible to everyone who can reply (so anyone can pick them up); assigned ones to the assignee and managers. */
function canSeeConversation(u: Staff, c: Conversation) {
  return isManager(u) || c.status === 'waiting' || c.assigneeId === u.id;
}

export async function inboxList(user: Staff, view: InboxView) {
  if (!can(user, 'inbox.reply')) throw new CrmError('You do not have access to the chat inbox.');
  const st = getConversationStore();
  const rows =
    view === 'waiting'
      ? await st.list({ statuses: ['waiting'] })
      : view === 'mine'
        ? await st.list({ statuses: ['assigned'], assigneeId: user.id })
        : view === 'open'
          ? await st.list({ statuses: ['waiting', 'assigned'] })
          : await st.list({ statuses: ['closed'], limit: 100 });
  const visible = rows.filter((c) => canSeeConversation(user, c));
  const staff = new Map((await getCrmRepo().listStaff()).map((s) => [s.id, s]));
  return visible.map((c) => ({ ...c, assigneeName: c.assigneeId ? staff.get(c.assigneeId)?.fullName ?? 'Staff' : null }));
}

export async function inboxCounts(user: Staff) {
  if (!can(user, 'inbox.reply')) return { waiting: 0, mine: 0, unreadMine: 0 };
  const st = getConversationStore();
  const [waiting, mine] = await Promise.all([st.list({ statuses: ['waiting'] }), st.list({ statuses: ['assigned'], assigneeId: user.id })]);
  return { waiting: waiting.length, mine: mine.length, unreadMine: mine.reduce((n, c) => n + c.unread, 0) };
}

async function load(user: Staff, id: string) {
  if (!can(user, 'inbox.reply')) throw new CrmError('You do not have access to the chat inbox.');
  const conv = await getConversationStore().get(id);
  if (!conv || !canSeeConversation(user, conv)) throw new CrmError('Conversation not found.');
  return conv;
}

export async function conversationView(user: Staff, id: string) {
  const conv = await load(user, id);
  const st = getConversationStore();
  const repo = getCrmRepo();
  const [messages, staffList, lead] = await Promise.all([st.messages(id), repo.listStaff(), conv.leadId ? repo.getLead(conv.leadId) : Promise.resolve(null)]);
  if (conv.assigneeId === user.id && conv.unread > 0) await st.update(id, { unread: 0 });
  const isMine = conv.assigneeId === user.id;
  return {
    conv,
    messages,
    lead,
    leadVisible: Boolean(lead && canSeeLead(user, lead)),
    staff: staffList,
    canReply: conv.status !== 'closed' && (isMine || conv.status === 'waiting' || isManager(user)),
    freeTextOk: canFreeText(conv),
    windowClosesAt: windowClosesAt(conv)?.toISOString() ?? null,
    transferTargets: staffList.filter((s) => s.id !== conv.assigneeId && can(s, 'inbox.reply')).map((s) => ({ id: s.id, name: s.fullName })),
  };
}

export async function claim(user: Staff, id: string) {
  const conv = await load(user, id);
  if (conv.status === 'closed') throw new CrmError('This conversation is closed.');
  if (conv.status === 'assigned' && conv.assigneeId !== user.id && !isManager(user)) throw new CrmError('Someone else is already handling this conversation.');
  if (conv.assigneeId === user.id) return;
  const st = getConversationStore();
  await st.update(id, { status: 'assigned', assigneeId: user.id, unread: 0 });
  if (conv.status === 'assigned') await st.addMessage({ conversationId: id, author: 'note', staffId: user.id, text: `${user.fullName} took over the conversation.`, waMessageId: null });
  // Web visitors see who joined (first name only). On WhatsApp the family simply sees the reply.
  if (conv.channel === 'web') await st.addMessage({ conversationId: id, author: 'system', staffId: null, text: `${first(user.fullName)} from the admissions team joined the chat.`, waMessageId: null });
}

const first = (name: string) => name.trim().split(/\s+/)[0];

export async function reply(user: Staff, id: string, text: string) {
  const body = text.trim();
  if (!body) throw new CrmError('Type a message.');
  if (body.length > MAX_REPLY) throw new CrmError(`Keep replies under ${MAX_REPLY} characters.`);
  let conv = await load(user, id);
  if (conv.status === 'closed') throw new CrmError('This conversation is closed.');
  if (conv.status === 'assigned' && conv.assigneeId !== user.id && !isManager(user)) throw new CrmError('Someone else is handling this conversation. Ask them to transfer it to you.');
  if (conv.status === 'waiting') {
    await claim(user, id);
    conv = (await getConversationStore().get(id))!;
  }
  const st = getConversationStore();
  if (conv.channel === 'whatsapp') {
    if (!canFreeText(conv)) throw new CrmError('More than 24 hours have passed since the family’s last WhatsApp message, so WhatsApp only allows an approved template. Send one from the lead page, or call.');
    const r = await sendFreeText({ to: conv.contactPhone!, text: body, leadId: conv.leadId, actorId: user.id });
    await st.addMessage({ conversationId: id, author: 'staff', staffId: user.id, text: body, waMessageId: r.outboxId });
    if (r.status !== 'sent') throw new CrmError(`Saved, but not delivered: ${r.reason ?? r.status}`);
  } else {
    await st.addMessage({ conversationId: id, author: 'staff', staffId: user.id, text: body, waMessageId: null });
  }
  if (conv.leadId) {
    // A reply is a contact with the family; keeps the CRM follow-up clock honest.
    await getCrmRepo().updateLead(conv.leadId, { lastContactAt: new Date().toISOString() }, []);
  }
}

export async function transfer(user: Staff, id: string, toId: string, note: string | null) {
  const conv = await load(user, id);
  if (conv.status === 'closed') throw new CrmError('This conversation is closed.');
  if (conv.assigneeId !== user.id && !isManager(user)) throw new CrmError('Only the person handling this conversation, or a manager, can transfer it.');
  const target = await getCrmRepo().getStaff(toId);
  if (!target || !target.active || !can(target, 'inbox.reply')) throw new CrmError('Choose a colleague who can reply in the inbox.');
  const st = getConversationStore();
  await st.update(id, { status: 'assigned', assigneeId: target.id, unread: conv.unread });
  await st.addMessage({ conversationId: id, author: 'note', staffId: user.id, text: `${user.fullName} transferred the conversation to ${target.fullName}${note ? `: ${note}` : '.'}`, waMessageId: null });
  if (conv.channel === 'web') await st.addMessage({ conversationId: id, author: 'system', staffId: null, text: `You are now chatting with ${first(target.fullName)} from the admissions team.`, waMessageId: null });
}

export async function closeConversation(user: Staff, id: string, note: string) {
  const conv = await load(user, id);
  if (conv.status === 'closed') return;
  if (conv.assigneeId !== user.id && !isManager(user)) throw new CrmError('Only the person handling this conversation, or a manager, can close it.');
  if (note.trim().length < 3) throw new CrmError('Add a short outcome note (e.g. “Fees explained, visit booked”).');
  const st = getConversationStore();
  await st.update(id, { status: 'closed', closedAt: new Date().toISOString(), closeNote: note.trim().slice(0, 300), unread: 0 });
  await st.addMessage({ conversationId: id, author: 'note', staffId: user.id, text: `Closed by ${user.fullName}: ${note.trim().slice(0, 300)}`, waMessageId: null });
  if (conv.leadId) await getCrmRepo().updateLead(conv.leadId, {}, [{ action: 'chat_closed', actorId: user.id, field: 'conversation', newValue: conv.channel, reason: note.trim().slice(0, 300) }]);
}

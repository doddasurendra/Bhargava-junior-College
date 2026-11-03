import { randomUUID } from 'node:crypto';
import { tx } from '../store/file';
import type { ConversationStore } from './types';

export function createFileConversationStore(): ConversationStore {
  return {
    create: (c) =>
      tx((db) => {
        const now = new Date().toISOString();
        const row = { ...c, id: randomUUID(), createdAt: now, lastMessageAt: now, lastInboundAt: null, unread: 0, closedAt: null, closeNote: null };
        db.conversations.push(row);
        return row;
      }),

    get: (id) => tx((db) => db.conversations.find((c) => c.id === id) ?? null, false),

    findOpenByPhone: (phone) =>
      tx(
        (db) =>
          db.conversations
            .filter((c) => c.channel === 'whatsapp' && c.contactPhone === phone && c.status !== 'closed')
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null,
        false,
      ),

    update: (id, patch) =>
      tx((db) => {
        const c = db.conversations.find((x) => x.id === id);
        if (!c) throw new Error('conversation_not_found');
        Object.assign(c, patch);
      }),

    addMessage: (m) =>
      tx((db) => {
        const c = db.conversations.find((x) => x.id === m.conversationId);
        if (!c) throw new Error('conversation_not_found');
        const at = m.createdAt ?? new Date().toISOString();
        const row = { ...m, id: randomUUID(), createdAt: at };
        db.convMessages.push(row);
        if (at > c.lastMessageAt) c.lastMessageAt = at;
        if (m.author === 'contact') {
          c.lastInboundAt = at;
          c.unread += 1;
        }
        return row;
      }),

    messages: (conversationId, after) =>
      tx((db) => db.convMessages.filter((m) => m.conversationId === conversationId && (!after || m.createdAt > after)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), false),

    list: (f) =>
      tx(
        (db) =>
          db.conversations
            .filter((c) => (!f.statuses || f.statuses.includes(c.status)) && (!f.assigneeId || c.assigneeId === f.assigneeId) && (!f.leadIds || (c.leadId !== null && f.leadIds.includes(c.leadId))))
            .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
            .slice(0, f.limit ?? 200),
        false,
      ),
  };
}

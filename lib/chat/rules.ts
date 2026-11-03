/** Inbox rules. Pure. */
import type { Conversation } from './types';

const WINDOW_MS = 24 * 3_600_000;

/**
 * WhatsApp only allows free-form (non-template) messages within 24 hours of the family's last message
 * (the customer-service window). Web chat has no such limit.
 */
export function canFreeText(c: Pick<Conversation, 'channel' | 'lastInboundAt'>, now: Date = new Date()): boolean {
  if (c.channel === 'web') return true;
  return Boolean(c.lastInboundAt && now.getTime() - new Date(c.lastInboundAt).getTime() < WINDOW_MS);
}

export function windowClosesAt(c: Pick<Conversation, 'lastInboundAt'>): Date | null {
  return c.lastInboundAt ? new Date(new Date(c.lastInboundAt).getTime() + WINDOW_MS) : null;
}

/** A handed-off conversation goes straight to the lead's owner when they can reply; otherwise to the shared queue. */
export function routeConversation(p: { ownerId: string | null; ownerCanReply: boolean }): { status: 'assigned' | 'waiting'; assigneeId: string | null } {
  return p.ownerId && p.ownerCanReply ? { status: 'assigned', assigneeId: p.ownerId } : { status: 'waiting', assigneeId: null };
}

export const MAX_REPLY = 1000;

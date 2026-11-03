export type OutboundStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'skipped';

export interface OutboundMessage {
  id: string;
  leadId: string | null;
  to: string;
  template: string;
  /** Rendered body as sent (OTP codes are redacted) */
  body: string;
  status: OutboundStatus;
  providerId: string | null;
  error: string | null;
  dedupeKey: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InboundRow {
  id: string;
  providerId: string;
  from: string;
  leadId: string | null;
  type: string;
  text: string | null;
  receivedAt: string;
}

export interface MessageStore {
  /** Active lead for a phone (its phone or student phone) and whether it has consent on record. */
  leadForPhone(phone: string): Promise<{ id: string; consent: boolean } | null>;
  /** Returns null when the dedupe key already exists (the message was already sent or queued). */
  insertOutbound(m: Omit<OutboundMessage, 'id' | 'createdAt' | 'updatedAt'>): Promise<OutboundMessage | null>;
  updateOutbound(id: string, patch: Partial<Pick<OutboundMessage, 'status' | 'providerId' | 'error'>>): Promise<void>;
  /** Delivery status from the webhook; only ever moves forward (sent → delivered → read; failed is final). */
  applyStatus(providerId: string, status: 'sent' | 'delivered' | 'read' | 'failed', error: string | null): Promise<void>;
  /** false if this provider message id was already stored (webhooks are retried). */
  insertInbound(m: Omit<InboundRow, 'id'>): Promise<boolean>;
  isOptedOut(phone: string): Promise<boolean>;
  setOptOut(phone: string, optedOut: boolean, source: string): Promise<void>;
  /** Staff attests the family agreed to WhatsApp messages (e.g. on a call). */
  recordConsent(leadId: string, actorId: string, note: string): Promise<void>;
  listForLead(leadId: string, limit?: number): Promise<{ outbound: OutboundMessage[]; inbound: InboundRow[] }>;
}

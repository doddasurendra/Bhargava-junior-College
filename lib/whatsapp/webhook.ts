/** WhatsApp Cloud API webhook: signature check and payload parsing. Pure. */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { normalizeIndianMobile } from '../phone';

/** Meta signs the raw body with the app secret: header `X-Hub-Signature-256: sha256=<hex>`. */
export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith('sha256=')) return false;
  const expected = Buffer.from(createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex'));
  const given = Buffer.from(header.slice(7));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export type DeliveryStatus = 'sent' | 'delivered' | 'read' | 'failed';

export interface StatusEvent {
  providerId: string;
  status: DeliveryStatus;
  at: string;
  error: string | null;
}

export interface InboundMessage {
  providerId: string;
  /** E.164, or the raw number if not an Indian mobile */
  from: string;
  type: string;
  text: string | null;
  at: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function parseWebhook(body: any): { statuses: StatusEvent[]; messages: InboundMessage[] } {
  const statuses: StatusEvent[] = [];
  const messages: InboundMessage[] = [];
  if (body?.object !== 'whatsapp_business_account') return { statuses, messages };
  const iso = (ts: unknown) => new Date(Number(ts) * 1000 || Date.now()).toISOString();
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue;
      const v = change.value ?? {};
      for (const s of v.statuses ?? []) {
        if (!['sent', 'delivered', 'read', 'failed'].includes(s.status)) continue;
        statuses.push({ providerId: String(s.id), status: s.status, at: iso(s.timestamp), error: s.errors?.[0] ? `${s.errors[0].code}: ${s.errors[0].title ?? s.errors[0].message ?? ''}`.trim() : null });
      }
      for (const m of v.messages ?? []) {
        const raw = String(m.from ?? '');
        const text = m.type === 'text' ? m.text?.body ?? null : m.type === 'button' ? m.button?.text ?? null : m.type === 'interactive' ? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? null : null;
        messages.push({ providerId: String(m.id), from: normalizeIndianMobile(raw) ?? `+${raw}`, type: String(m.type ?? 'unknown'), text, at: iso(m.timestamp) });
      }
    }
  }
  return { statuses, messages };
}

const OPT_OUT = /^\s*(stop|unsubscribe|stop all|opt ?out|cancel|end|quit|no more messages?)\s*[.!]*\s*$/i;
const OPT_IN = /^\s*(start|unstop|subscribe|opt ?in)\s*[.!]*\s*$/i;

export function keywordIntent(text: string | null): 'opt_out' | 'opt_in' | null {
  if (!text) return null;
  if (OPT_OUT.test(text)) return 'opt_out';
  if (OPT_IN.test(text)) return 'opt_in';
  return null;
}

/** Status order for "only move forward" updates (a late 'sent' must not overwrite 'read'). */
export const STATUS_RANK: Record<string, number> = { queued: 0, sent: 1, delivered: 2, read: 3, failed: 4, skipped: 4 };

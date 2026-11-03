import 'server-only';
import { brochures, visitSlots } from '@/content/sample';
import { college, fullAddress, mapsLinkUrl } from '@/content/college';
import { getProgram } from '@/content/programs';
import { getCrmRepo } from '../crm/repo';
import { addDays, formatDate, todayIST } from '../dates';
import { maskPhone } from '../phone';
import { CloudApiError, sendTemplateMessage, type CloudConfig } from './cloudApi';
import { createFileMessageStore } from './fileStore';
import { dueReminders } from './reminders';
import { createSupabaseMessageStore } from './supabaseStore';
import { getTemplate, renderBody, validateParams, type TemplateKey } from './templates';
import type { MessageStore, OutboundStatus } from './types';
import { keywordIntent, parseWebhook, verifySignature } from './webhook';

// ---------------------------------------------------------------- configuration

export type Mode = { kind: 'cloud'; cfg: CloudConfig } | { kind: 'dev' } | { kind: 'off' };

/**
 * MESSAGING_PROVIDER=whatsapp_cloud + WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_ACCESS_TOKEN → real sends.
 * Unset in development → messages are logged (masked) and recorded as sent with a dev id.
 * Unset in production → recorded as skipped ("not configured"); nothing is sent.
 */
export function mode(): Mode {
  const id = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (process.env.MESSAGING_PROVIDER === 'whatsapp_cloud' && id && token) return { kind: 'cloud', cfg: { phoneNumberId: id, accessToken: token } };
  return process.env.NODE_ENV === 'production' ? { kind: 'off' } : { kind: 'dev' };
}

let store: MessageStore | null = null;
export function getMessageStore(): MessageStore {
  if (store) return store;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  store = url && key ? createSupabaseMessageStore(url, key) : createFileMessageStore();
  return store;
}

// ---------------------------------------------------------------- sending

export interface SendRequest {
  template: TemplateKey;
  to: string;
  params: string[];
  leadId?: string | null;
  actorId?: string | null;
  /** Same key → sent at most once (cron and webhook retries, double submits). */
  dedupeKey?: string | null;
  /** Marketing and staff-initiated sends require consent on the lead. */
  requireConsent?: boolean;
  document?: { link: string; filename: string };
  /** Hide param values in the stored body (OTP codes). */
  redact?: boolean;
}

export interface SendResult {
  status: OutboundStatus;
  reason?: string;
}

/** Never throws for delivery problems; the result says what happened and the outbox records it. */
export async function sendTemplate(req: SendRequest): Promise<SendResult> {
  const def = getTemplate(req.template);
  if (!def) throw new Error(`Unknown template ${req.template}`);
  const invalid = validateParams(def, req.params);
  if (invalid) throw new Error(`[whatsapp] ${invalid}`);

  const st = getMessageStore();
  const lead = await st.leadForPhone(req.to);
  const leadId = req.leadId ?? lead?.id ?? null;
  const body = renderBody(def, req.redact ? req.params.map(() => '••••••') : req.params);
  const base = { leadId, to: req.to, template: def.name, body, providerId: null, error: null, dedupeKey: req.dedupeKey ?? null, createdBy: req.actorId ?? null };

  const skip = async (reason: string): Promise<SendResult> => {
    await st.insertOutbound({ ...base, status: 'skipped', error: reason });
    return { status: 'skipped', reason };
  };
  if (await st.isOptedOut(req.to)) return skip('The family replied STOP (opted out of WhatsApp).');
  if (req.requireConsent && !lead?.consent) return skip('No WhatsApp consent on record for this number.');

  const row = await st.insertOutbound({ ...base, status: 'queued' });
  if (!row) return { status: 'skipped', reason: 'Already sent.' };

  const m = mode();
  if (m.kind === 'off') {
    await st.updateOutbound(row.id, { status: 'skipped', error: 'WhatsApp is not configured.' });
    return { status: 'skipped', reason: 'WhatsApp is not configured.' };
  }
  if (m.kind === 'dev') {
    console.info(`[dev whatsapp] ${def.name} → ${maskPhone(req.to)}: ${req.redact ? body : body.slice(0, 160)}`);
    await st.updateOutbound(row.id, { status: 'sent', providerId: `dev-${row.id}` });
    return { status: 'sent' };
  }
  try {
    const providerId = await sendTemplateMessage(m.cfg, { to: req.to, template: def, params: req.params, document: req.document });
    await st.updateOutbound(row.id, { status: 'sent', providerId });
    return { status: 'sent' };
  } catch (e) {
    const msg = e instanceof CloudApiError ? `${e.code ?? ''} ${e.message}`.trim() : (e as Error).message;
    console.error(`[whatsapp] ${def.name} → ${maskPhone(req.to)} failed: ${msg}`);
    // TODO: retry queue for e.retryable (rate limits); today a failed message is visible in the CRM for a manual resend.
    await st.updateOutbound(row.id, { status: 'failed', error: msg.slice(0, 300) });
    return { status: 'failed', reason: msg };
  }
}

// ---------------------------------------------------------------- website flows

const firstName = (name: string | null | undefined) => (name?.trim().split(/\s+/)[0] || 'there');

export function enquiryAck(name: string, phone: string, source: string, program?: string | null) {
  const url = program ? brochures.urls[program] : null;
  const p = program ? getProgram(program) : undefined;
  if (source === 'brochure' && url && p) {
    return sendTemplate({ template: 'brochure', to: phone, params: [firstName(name), p.name, college.phones[0].display], document: { link: url, filename: `${p.short} brochure.pdf` }, dedupeKey: `brochure:${phone}:${program}` });
  }
  return sendTemplate({ template: 'enquiry_ack', to: phone, params: [firstName(name), college.phones[0].display], dedupeKey: `enquiry_ack:${phone}:${todayIST()}` });
}

export function visitConfirmation(visitId: string, name: string, phone: string, when: string, actorId: string | null = null) {
  return sendTemplate({ template: 'visit_confirmation', to: phone, params: [firstName(name), when, fullAddress, mapsLinkUrl], dedupeKey: `visit:${visitId}:confirm`, actorId });
}

export function bsatRegistered(name: string, phone: string, date: string, mode: string, hallTicket: string) {
  return sendTemplate({ template: 'bsat_registration', to: phone, params: [firstName(name), date, mode === 'online' ? 'online' : 'at the campus', hallTicket], dedupeKey: `bsat:${hallTicket}` });
}

export class MessagingNotConfigured extends Error {}

export async function sendOtpCode(phone: string, code: string) {
  const m = mode();
  if (m.kind === 'off') throw new MessagingNotConfigured('WhatsApp is not configured');
  if (m.kind === 'dev') console.info(`[dev otp] ${maskPhone(phone)} → ${code}`);
  const r = await sendTemplate({ template: 'otp', to: phone, params: [code], redact: true });
  if (r.status === 'failed') throw new Error(r.reason);
  if (r.status === 'skipped') throw new MessagingNotConfigured(r.reason ?? 'not sent');
}

// ---------------------------------------------------------------- webhook

export async function handleWebhook(rawBody: string, signature: string | null): Promise<{ ok: boolean; status: number }> {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (secret) {
    if (!verifySignature(rawBody, signature, secret)) return { ok: false, status: 401 };
  } else if (process.env.NODE_ENV === 'production') {
    console.error('[whatsapp] WHATSAPP_APP_SECRET is not set; rejecting webhook');
    return { ok: false, status: 500 };
  }
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { ok: false, status: 400 };
  }
  const { statuses, messages } = parseWebhook(json);
  const st = getMessageStore();
  for (const s of statuses) await st.applyStatus(s.providerId, s.status, s.error);
  for (const m of messages) {
    const lead = await st.leadForPhone(m.from);
    const fresh = await st.insertInbound({ providerId: m.providerId, from: m.from, leadId: lead?.id ?? null, type: m.type, text: m.text?.slice(0, 4000) ?? null, receivedAt: m.at });
    if (!fresh) continue;
    const intent = keywordIntent(m.text);
    if (intent === 'opt_out') await st.setOptOut(m.from, true, 'Replied STOP on WhatsApp');
    if (intent === 'opt_in') await st.setOptOut(m.from, false, 'Replied START on WhatsApp');
    // TODO(chat agent): hand other inbound messages to the AI admission assistant / CRM inbox.
  }
  return { ok: true, status: 200 };
}

// ---------------------------------------------------------------- reminders

export async function runVisitReminders(now = new Date()) {
  const repo = getCrmRepo();
  const today = todayIST(now);
  const visits = await repo.listVisits({ from: today, to: addDays(today, 1), statuses: ['scheduled'] });
  const due = dueReminders(visits, now);
  const counts = { due: due.length, sent: 0, skipped: 0, failed: 0 };
  for (const d of due) {
    const v = visits.find((x) => x.id === d.visitId)!;
    const lead = await repo.getLead(v.leadId);
    if (!lead) continue;
    const time = visitSlots.slots.find((s) => s.slot === v.slot)?.label ?? v.slot;
    const day = v.date === today ? 'today' : `tomorrow (${formatDate(v.date, { weekday: 'long', day: 'numeric', month: 'short' })})`;
    const r = await sendTemplate({ template: 'visit_reminder', to: lead.phone, params: [day, time, mapsLinkUrl], leadId: lead.id, dedupeKey: d.dedupeKey });
    if (r.status === 'sent') counts.sent++;
    else if (r.status === 'failed') counts.failed++;
    else counts.skipped++;
  }
  return counts;
}

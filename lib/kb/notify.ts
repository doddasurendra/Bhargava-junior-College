import 'server-only';
import { getCrmRepo } from '../crm/repo';
import { can, permissionsFor } from '../crm/permissions';
import type { Staff } from '../crm/types';
import { emailConfigured, sendEmail } from '../email';
import type { Lang } from '../i18n';
import { getRecordStore } from '../records';
import { mode as waMode, sendFreeText } from '../whatsapp/service';
import { kbArticles, kbFiles, NOTIFY_CHANNELS, NOTIFY_TRIGGERS, notifyLog, notifyOptOuts, notifyRules } from './collections';
import { audit, KbError } from './service';

/**
 * Notification & Automation Centre (§19). A rule = trigger → audience → channels → template (en/te/hi) →
 * schedule. Every attempt is written to the message log with an honest status:
 *  - sent: the provider accepted it          - logged: development only, nothing left the server
 *  - not_delivered: channel not configured    - held_quiet_hours: 9 PM – 7 AM IST, sent at 7 AM
 *  - opted_out: the person opted out          - failed: provider error
 * Push and SMS have no provider configured in this project yet, so they log `not_delivered`.
 */
const st = () => getRecordStore();
export type Channel = (typeof NOTIFY_CHANNELS)[number];
export type Trigger = (typeof NOTIFY_TRIGGERS)[number];

export const TRIGGER_LABEL: Record<Trigger, string> = {
  attendance_absent: 'Student marked absent',
  exam_scheduled: 'Exam / test scheduled',
  assignment_due: 'Assignment due',
  fee_due: 'Fee instalment due',
  exam_registration: 'Career: exam registration (JEE/NEET/EAPCET) opens or closes',
  admission_update: 'Admission status changed',
  announcement: 'College announcement',
  parent_message: 'Message for parents',
  faculty_notice: 'Notice for faculty',
  approval_pending: 'Knowledge Hub item waiting for approval',
  document_review: 'Document/article review date coming up',
};

export interface Recipient {
  name: string;
  phone?: string | null;
  email?: string | null;
  lang?: Lang;
}

/** 9 PM – 7 AM India time. */
export function inQuietHours(at = new Date()) {
  const h = new Date(at.getTime() + 5.5 * 3600_000).getUTCHours();
  return h >= 21 || h < 7;
}

export const channelStatus = (): Record<Channel, { ready: boolean; note: string }> => {
  const wa = waMode();
  return {
    whatsapp: { ready: wa.kind === 'cloud', note: wa.kind === 'cloud' ? 'WhatsApp Cloud API configured (free text works inside the 24-hour window; outside it Meta requires approved templates)' : 'Not configured: MESSAGING_PROVIDER / WHATSAPP_* missing' },
    email: { ready: emailConfigured(), note: emailConfigured() ? 'SMTP configured' : 'Not configured: SMTP_HOST / EMAIL_FROM missing' },
    sms: { ready: false, note: 'No SMS provider configured' },
    push: { ready: false, note: 'No push provider configured (app shows notices in-app)' },
  };
};

const fill = (tpl: string, vars: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
const mask = (s: string) => (s.includes('@') ? s.replace(/^(.).*(@.*)$/, '$1•••$2') : s.replace(/^(\+?\d{0,3})\d+(\d{4})$/, '$1••••$2'));

export async function dispatch(input: { ruleId: string | null; trigger: string; channels: Channel[]; template: { en: string; te?: string | null; hi?: string | null }; recipients: Recipient[]; vars?: Record<string, string>; urgent?: boolean }, at = new Date()) {
  const status = channelStatus();
  const out = { sent: 0, notDelivered: 0, held: 0, optedOut: 0, failed: 0, logged: 0 };
  const quiet = !input.urgent && inQuietHours(at);
  for (const r of input.recipients) {
    const lang = r.lang ?? 'en';
    const text = fill((lang === 'en' ? input.template.en : input.template[lang]) || input.template.en, { name: r.name, ...(input.vars ?? {}) }).slice(0, 2000);
    for (const ch of input.channels) {
      const to = ch === 'email' ? r.email : r.phone;
      if (!to) continue;
      const log = (s: (typeof notifyLog)['schema']['_output']['status'], error: string | null = null) => notifyLog.put(st(), { ruleId: input.ruleId, trigger: input.trigger, channel: ch, to: mask(to), lang, text, status: s, error, at: at.toISOString() });
      if ((await notifyOptOuts.list(st(), { k1: to, k2: ch })).length) {
        out.optedOut++;
        await log('opted_out');
        continue;
      }
      if (quiet) {
        out.held++;
        await log('held_quiet_hours', 'Quiet hours 9 PM – 7 AM: held until 7 AM');
        continue;
      }
      if (ch === 'email') {
        const res = await sendEmail({ to: [to], subject: `Bhargava Junior College: ${TRIGGER_LABEL[input.trigger as Trigger] ?? input.trigger}`, html: `<p>${text.replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>` });
        if (res.status === 'sent') out.sent++;
        else if (res.status === 'logged') out.logged++;
        else out.failed++;
        await log(res.status === 'sent' ? 'sent' : res.status === 'logged' ? 'not_delivered' : 'failed', res.reason ?? null);
      } else if (ch === 'whatsapp' && status.whatsapp.ready) {
        const res = await sendFreeText({ to, text, leadId: null, actorId: null });
        if (res.status === 'sent') out.sent++;
        else out.failed++;
        await log(res.status === 'sent' ? 'sent' : 'failed', res.reason ?? null);
      } else {
        out.notDelivered++;
        await log('not_delivered', status[ch].note);
      }
    }
  }
  return out;
}

export async function saveRule(user: Staff, input: { name: string; trigger: Trigger; audience: string; channels: Channel[]; templateEn: string; templateTe?: string | null; templateHi?: string | null; schedule: string; active: boolean }, id?: string) {
  if (!can(user, 'notify.manage') || user.viewedBy) throw new KbError('Your role can’t manage notification rules.');
  // College rule: fee messages go to parents/guardians only, never to students.
  if (input.trigger === 'fee_due' && input.audience !== 'parents') throw new KbError('Fee reminders can only go to parents and guardians.');
  const rec = await notifyRules.put(st(), { name: input.name, trigger: input.trigger, audience: input.audience, channels: input.channels, template: { en: input.templateEn, te: input.templateTe || null, hi: input.templateHi || null }, schedule: input.schedule, active: input.active, createdBy: user.id }, id);
  await audit(user, id ? 'edit' : 'create', 'rule', rec.id, input.name);
  return rec;
}

export const listRules = async () => (await notifyRules.list(st())).sort((a, b) => a.data.name.localeCompare(b.data.name));
export const messageLog = async (limit = 200) => (await notifyLog.list(st())).map((r) => ({ id: r.id, ...r.data })).sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);

export async function optOut(to: string, channel: Channel) {
  await notifyOptOuts.put(st(), { to, channel, at: new Date().toISOString() });
}

/** "Send test": the rule goes to the person editing it, through every channel it uses. */
export async function testRule(user: Staff, id: string) {
  if (!can(user, 'notify.manage')) throw new KbError('Your role can’t test rules.');
  const r = await notifyRules.get(st(), id);
  if (!r) throw new KbError('Rule not found.');
  const res = await dispatch({ ruleId: id, trigger: r.data.trigger, channels: r.data.channels, template: r.data.template, recipients: [{ name: user.fullName, phone: user.phone, email: user.email }], vars: { title: 'Test message', date: new Date().toISOString().slice(0, 10) } });
  await audit(user, 'test', 'rule', id, r.data.name, JSON.stringify(res));
  return res;
}

/**
 * Daily job: review-date reminders to owners (14 days ahead) and pending-approval reminders to approvers
 * (waiting 2+ days). Uses the active rules for these triggers; with none, a built-in email+WhatsApp default.
 */
export async function runKbReminders(now = new Date()) {
  const today = new Date(now.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const soon = new Date(now.getTime() + 14 * 86400_000).toISOString().slice(0, 10);
  const staff = await getCrmRepo().listStaff();
  const byId = new Map(staff.map((s) => [s.id, s]));
  const items = [...(await kbArticles.list(st())).map((r) => ({ id: r.id, kind: 'article', d: r.data, updatedAt: r.updatedAt })), ...(await kbFiles.list(st())).map((r) => ({ id: r.id, kind: 'document', d: r.data, updatedAt: r.updatedAt }))];
  const rules = (await listRules()).filter((r) => r.data.active);
  const ruleFor = (t: Trigger) => rules.find((r) => r.data.trigger === t)?.data ?? null;
  const review = items.filter((x) => x.d.status === 'published' && x.d.reviewBy && x.d.reviewBy <= soon);
  const pending = items.filter((x) => (x.d.status === 'review' || x.d.status === 'approved') && x.updatedAt < new Date(now.getTime() - 2 * 86400_000).toISOString());
  const result = { review: 0, pending: 0 };
  const byOwner = new Map<string, string[]>();
  for (const x of review) if (x.d.ownerId) byOwner.set(x.d.ownerId, [...(byOwner.get(x.d.ownerId) ?? []), `${x.d.title.en} (review by ${x.d.reviewBy}${x.d.reviewBy! < today ? ', overdue' : ''})`]);
  for (const [ownerId, titles] of byOwner) {
    const o = byId.get(ownerId);
    if (!o) continue;
    const rule = ruleFor('document_review');
    await dispatch({ ruleId: null, trigger: 'document_review', channels: rule?.channels ?? ['email', 'whatsapp'], template: rule?.template ?? { en: 'Hello {name}, these Knowledge Hub items need your review: {items}' }, recipients: [{ name: o.fullName, phone: o.phone, email: o.email }], vars: { items: titles.join('; ') } }, now);
    result.review += titles.length;
  }
  if (pending.length) {
    const approvers = staff.filter((s) => permissionsFor(s.roles).includes('kb.approve'));
    const rule = ruleFor('approval_pending');
    await dispatch({ ruleId: null, trigger: 'approval_pending', channels: rule?.channels ?? ['email'], template: rule?.template ?? { en: 'Hello {name}, {count} Knowledge Hub item(s) are waiting for approval for 2+ days.' }, recipients: approvers.map((a) => ({ name: a.fullName, phone: a.phone, email: a.email })), vars: { count: String(pending.length) } }, now);
    result.pending = pending.length;
  }
  return result;
}

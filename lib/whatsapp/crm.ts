import 'server-only';
import { getContent } from '../cms';
import { slotLabel } from '../visits';
import { college, fullAddress, mapsLinkUrl } from '@/content/college';
import { getProgram } from '@/content/programs';
import { can, canSeeLead } from '../crm/permissions';
import { getCrmRepo } from '../crm/repo';
import { CrmError } from '../crm/service';
import type { CrmLead, Staff } from '../crm/types';
import { formatDate, todayIST } from '../dates';
import { siteUrl } from '../seo';
import { getMessageStore, mode, sendTemplate, type SendRequest } from './service';
import { getTemplate, renderBody, TEMPLATES, type TemplateKey } from './templates';

export const MAX_BULK = 200;

const firstName = (l: CrmLead) => (l.parentName ?? l.contactName ?? l.studentName ?? '').trim().split(/\s+/)[0] || 'there';

/**
 * Template values are built on the server from the lead record, never typed by staff, so a
 * business-initiated message always says what its approved template says.
 */
async function buildSend(lead: CrmLead, key: TemplateKey): Promise<{ req: Omit<SendRequest, 'actorId'> } | { unavailable: string }> {
  const name = firstName(lead);
  switch (key) {
    case 'college_intro':
      return { req: { template: key, to: lead.phone, params: [name, `${siteUrl}/fees`], leadId: lead.id, requireConsent: true } };
    case 'location':
      return { req: { template: key, to: lead.phone, params: [fullAddress, mapsLinkUrl, college.hoursShort], leadId: lead.id, requireConsent: true } };
    case 'brochure': {
      const p = lead.program ? getProgram(lead.program) : undefined;
      if (!p) return { unavailable: 'Set the lead’s program first.' };
      const url = (await getContent()).brochures.urls[p.slug];
      if (!url) return { unavailable: `No ${p.short} brochure PDF is configured yet.` };
      return { req: { template: key, to: lead.phone, params: [name, p.name, college.phones[0].display], document: { link: url, filename: `${p.short} brochure.pdf` }, leadId: lead.id, requireConsent: true } };
    }
    case 'visit_confirmation': {
      const visits = (await getCrmRepo().getLeadHistory(lead.id)).visits.filter((v) => v.status === 'scheduled' && v.date >= todayIST()).sort((a, b) => a.date.localeCompare(b.date));
      const v = visits[0];
      if (!v) return { unavailable: 'No upcoming visit is booked.' };
      const when = `${formatDate(v.date)}, ${slotLabel(v.slot, (await getContent()).visitSlots)}`;
      // Re-sending a confirmation is allowed (the family may have lost it), so no dedupe key here.
      return { req: { template: key, to: lead.phone, params: [name, when, fullAddress, mapsLinkUrl], leadId: lead.id, requireConsent: true } };
    }
    default:
      return { unavailable: 'This message is sent automatically by the system.' };
  }
}

async function visibleLead(user: Staff, id: string) {
  const lead = await getCrmRepo().getLead(id);
  if (!lead || !canSeeLead(user, lead)) throw new CrmError('Lead not found.');
  return lead;
}

export async function whatsappForLead(user: Staff, leadId: string) {
  const lead = await visibleLead(user, leadId);
  const st = getMessageStore();
  const [contact, optedOut, history] = await Promise.all([st.leadForPhone(lead.phone), st.isOptedOut(lead.phone), st.listForLead(lead.id)]);
  const options = await Promise.all(
    TEMPLATES.filter((t) => t.manual).map(async (t) => {
      const b = await buildSend(lead, t.key);
      return { key: t.key, label: t.description, name: t.name, preview: 'req' in b ? renderBody(getTemplate(t.key)!, b.req.params) : null, unavailable: 'unavailable' in b ? b.unavailable : null };
    }),
  );
  const thread = [
    ...history.outbound.map((m) => ({ dir: 'out' as const, at: m.createdAt, text: m.body, status: m.status, error: m.error, template: m.template, by: m.createdBy })),
    ...history.inbound.map((m) => ({ dir: 'in' as const, at: m.receivedAt, text: m.text ?? `[${m.type}]`, status: null, error: null, template: null, by: null })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return { consent: Boolean(contact?.consent), optedOut, options, thread, mode: mode().kind, canSend: can(user, 'whatsapp.send') };
}

export async function sendFromCrm(user: Staff, leadId: string, key: string) {
  if (!can(user, 'whatsapp.send')) throw new CrmError('You cannot send WhatsApp messages.');
  const def = getTemplate(key);
  if (!def?.manual) throw new CrmError('This message cannot be sent by hand.');
  const lead = await visibleLead(user, leadId);
  const b = await buildSend(lead, def.key as TemplateKey);
  if ('unavailable' in b) throw new CrmError(b.unavailable);
  const r = await sendTemplate({ ...b.req, actorId: user.id });
  if (r.status === 'sent') return 'Sent on WhatsApp.';
  throw new CrmError(r.reason ?? 'Not sent.');
}

export async function recordOptIn(user: Staff, leadId: string, note: string) {
  if (!can(user, 'whatsapp.send')) throw new CrmError('You cannot record WhatsApp consent.');
  const lead = await visibleLead(user, leadId);
  if (note.trim().length < 5) throw new CrmError('Say how and when the family agreed (e.g. “Parent agreed on call, 2 Nov”).');
  if (await getMessageStore().isOptedOut(lead.phone)) throw new CrmError('This number replied STOP. Only the family can opt back in, by replying START.');
  await getMessageStore().recordConsent(lead.id, user.id, note.trim().slice(0, 200));
}

/** Bulk send to opted-in leads only; others are skipped and counted (brief §7.6 "send a WhatsApp campaign"). */
export async function bulkSend(user: Staff, ids: string[], key: string) {
  if (!can(user, 'whatsapp.bulk')) throw new CrmError('Only managers can send bulk WhatsApp messages.');
  const def = getTemplate(key);
  if (!def?.bulk) throw new CrmError('Choose a message that can be sent in bulk.');
  if (ids.length === 0) throw new CrmError('Select at least one lead.');
  if (ids.length > MAX_BULK) throw new CrmError(`At most ${MAX_BULK} leads per bulk send.`);
  const leads = (await getCrmRepo().listLeads({ ids })).filter((l) => canSeeLead(user, l) && l.status !== 'invalid');
  const counts = { sent: 0, skipped: 0, failed: 0 };
  const day = todayIST();
  for (const lead of leads) {
    const b = await buildSend(lead, def.key as TemplateKey);
    if ('unavailable' in b) {
      counts.skipped++;
      continue;
    }
    // One campaign message per lead per template per day, even if the button is pressed twice.
    const r = await sendTemplate({ ...b.req, actorId: user.id, dedupeKey: `bulk:${def.key}:${lead.id}:${day}` });
    counts[r.status === 'sent' ? 'sent' : r.status === 'failed' ? 'failed' : 'skipped']++;
  }
  return counts;
}

export async function setupStatus() {
  const m = mode();
  return {
    mode: m.kind,
    env: {
      MESSAGING_PROVIDER: process.env.MESSAGING_PROVIDER === 'whatsapp_cloud',
      WHATSAPP_PHONE_NUMBER_ID: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID),
      WHATSAPP_ACCESS_TOKEN: Boolean(process.env.WHATSAPP_ACCESS_TOKEN),
      WHATSAPP_APP_SECRET: Boolean(process.env.WHATSAPP_APP_SECRET),
      WHATSAPP_VERIFY_TOKEN: Boolean(process.env.WHATSAPP_VERIFY_TOKEN),
      CRON_SECRET: Boolean(process.env.CRON_SECRET),
    },
    webhookUrl: `${siteUrl}/api/whatsapp/webhook`,
    cronUrl: `${siteUrl}/api/cron/whatsapp-reminders`,
    brochures: Object.entries((await getContent()).brochures.urls).map(([slug, url]) => ({ program: getProgram(slug)?.name ?? slug, configured: Boolean(url) })),
  };
}

import { cronHandler } from '@/lib/cron';
import { getCrmRepo } from '@/lib/crm/repo';
import { getRecordStore } from '@/lib/records';
import { recordCronRun } from '@/lib/kb/health';
import { buildIndex } from '@/lib/kb/index';
import { dailyBriefing } from '@/lib/kb/intel';
import { knowledgeAudit } from '@/lib/kb/insights';
import { licences } from '@/lib/kb/collections';
import { dispatch, runKbReminders } from '@/lib/kb/notify';
import { kbSettings } from '@/lib/kb/collections';
import { permissionsFor } from '@/lib/crm/permissions';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Knowledge Hub daily job (Vercel Hobby: once a day, 13:30 UTC = 7 PM IST): re-index, outdated-content check,
 * review and approval reminders, licence/NOC renewal reminders (60 days ahead) and the Management Daily
 * Briefing (from dashboard numbers and KB changes only).
 */
const handle = cronHandler('knowledge hub', async () => {
  const t0 = Date.now();
  try {
    const idx = await buildIndex(true);
    const findings = await knowledgeAudit();
    await kbSettings.put(getRecordStore(), { at: new Date().toISOString(), counts: findings.reduce<Record<string, number>>((m, f) => ({ ...m, [f.kind]: (m[f.kind] ?? 0) + 1 }), {}) }, 'last-audit');
    const reminders = await runKbReminders();
    const soon = new Date(Date.now() + 60 * 86400_000).toISOString().slice(0, 10);
    const expiring = (await licences.list(getRecordStore())).filter((l) => l.data.validTo <= soon);
    const staff = await getCrmRepo().listStaff();
    if (expiring.length) {
      const to = staff.filter((s) => ['principal', 'admin_office', 'management'].includes(s.roles[0]));
      await dispatch({ ruleId: null, trigger: 'document_review', channels: ['email', 'whatsapp'], template: { en: 'Hello {name}, licences/NOCs expiring within 60 days: {items}' }, recipients: to.map((s) => ({ name: s.fullName, phone: s.phone, email: s.email })), vars: { items: expiring.map((l) => `${l.data.name} (${l.data.campus}) ${l.data.validTo}`).join('; ') } });
    }
    // the briefing is generated with the first Management account's permissions (dashboard numbers only)
    const mgmt = staff.find((s) => s.roles.includes('management')) ?? staff.find((s) => s.roles.includes('super_admin'));
    const briefing = mgmt ? await dailyBriefing({ ...mgmt, roles: [mgmt.roles.includes('management') ? 'management' : 'super_admin'], perms: permissionsFor([mgmt.roles.includes('management') ? 'management' : 'super_admin']) }) : null;
    const detail = `${idx.chunks.length} chunks, ${findings.length} findings, ${reminders.review} review + ${reminders.pending} approval reminders, ${expiring.length} licences expiring, briefing ${briefing ? 'generated' : 'skipped (no management account)'}`;
    await recordCronRun('/api/cron/kb', true, `${detail} in ${Date.now() - t0} ms`);
    return { chunks: idx.chunks.length, findings: findings.length, ...reminders, expiring: expiring.length, briefing: !!briefing };
  } catch (e) {
    await recordCronRun('/api/cron/kb', false, (e as Error).message);
    throw e;
  }
});
export const GET = handle;
export const POST = handle;

import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { getContent } from '../cms';
import { sendEmail } from '../email';
import { reportEmailHtml, reportPdf } from './reportPdf';
import { getRecordStore } from '../records';
import { marketingSpend } from '../records/collections';
import { addDays, formatDate, todayIST } from '../dates';
import { siteUrl } from '../seo';
import { tx } from '../store/file';
import { sendTemplate } from '../whatsapp/service';
import { computeMetrics, dailySeries, filterData, periods, type Metrics, type MetricsData, type MetricsExtras, type MetricsFilter, type PeriodKey } from './metrics';
import { can } from './permissions';
import { getCrmRepo } from './repo';
import { CrmError } from './service';
import type { Role, Staff } from './types';

const istMidnight = (date: string) => new Date(`${date}T00:00:00+05:30`).toISOString();

async function load(now: Date) {
  const repo = getCrmRepo();
  const { season } = await getContent();
  const seriesFrom = addDays(todayIST(now), -29);
  const since = istMidnight(seriesFrom < season.start ? seriesFrom : season.start);
  const [data, staff, spend] = await Promise.all([repo.exportForMetrics(since), repo.listStaff(), marketingSpend.list(getRecordStore())]);
  const extras: MetricsExtras = { spend: spend.map((r) => r.data), targets: season.seatTargets };
  return { data: { ...data, staff } as MetricsData, seriesFrom, season, extras };
}

export async function dashboard(user: Staff, key: PeriodKey, filter: MetricsFilter = {}, now = new Date()) {
  if (!can(user, 'dashboard.view')) throw new CrmError('Only management can see the dashboard.');
  const { data: all, seriesFrom, season, extras } = await load(now);
  const data = filterData(all, filter);
  const ps = periods(season.start, now);
  // filter options come from the unfiltered data so a filter can always be changed back
  const schools = [...new Set(all.leads.map((l) => l.school).filter((s): s is string => Boolean(s)))].sort().slice(0, 300);
  const sources = [...new Set(all.leads.map((l) => l.firstSource))].sort();
  return { metrics: computeMetrics(data, ps[key], now, extras), series: dailySeries(data, seriesFrom, todayIST(now)), periods: ps, season, options: { schools, sources, owners: all.staff.filter((s) => s.roles.some((r) => r === 'telecaller' || r === 'admission_counsellor' || r === 'admission_manager')).map((s) => ({ id: s.id, name: s.fullName })) } };
}

/** §8 cost per lead: marketing spend entries (content/marketing manager). */
export async function addSpend(user: Staff, input: { source: string; month: string; amount: number; note: string | null }) {
  if (!can(user, 'marketing.spend')) throw new CrmError('Only marketing or management can enter ad spend.');
  return marketingSpend.put(getRecordStore(), { ...input, enteredBy: user.id });
}

export async function listSpend(user: Staff) {
  if (!can(user, 'marketing.spend') && !can(user, 'dashboard.view')) throw new CrmError('Not permitted.');
  return (await marketingSpend.list(getRecordStore())).sort((a, b) => b.data.month.localeCompare(a.data.month));
}

export async function removeSpend(user: Staff, id: string) {
  if (!can(user, 'marketing.spend')) throw new CrmError('Not permitted.');
  await marketingSpend.remove(getRecordStore(), id);
}

// ---------------------------------------------------------------- 7 PM report snapshots

export interface DailyReport {
  date: string;
  generatedAt: string;
  today: Metrics;
  mtd: Metrics;
  season: Metrics;
  recipients: number;
}

const REPORT_ROLES: Role[] = ['super_admin', 'management', 'principal'];

async function saveReport(r: DailyReport) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await sb.from('daily_reports').upsert({ report_date: r.date, generated_at: r.generatedAt, payload: r, recipients: r.recipients });
    if (error) throw new Error(error.message);
    return;
  }
  await tx((db) => {
    db.dailyReports = db.dailyReports.filter((x) => x.date !== r.date);
    db.dailyReports.push(r);
  });
}

export async function getReport(user: Staff, date: string): Promise<DailyReport | null> {
  if (!can(user, 'dashboard.view')) throw new CrmError('Only management can see reports.');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await sb.from('daily_reports').select('payload').eq('report_date', date).maybeSingle();
    if (error) throw new Error(error.message);
    return (data?.payload as DailyReport) ?? null;
  }
  return tx((db) => db.dailyReports.find((r) => r.date === date) ?? null, false);
}

export async function listReports(user: Staff): Promise<{ date: string; generatedAt: string; recipients: number }[]> {
  if (!can(user, 'dashboard.view')) throw new CrmError('Only management can see reports.');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await sb.from('daily_reports').select('report_date, generated_at, recipients').order('report_date', { ascending: false }).limit(60);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({ date: r.report_date, generatedAt: r.generated_at, recipients: r.recipients }));
  }
  return tx((db) => [...db.dailyReports].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60).map((r) => ({ date: r.date, generatedAt: r.generatedAt, recipients: r.recipients })), false);
}

/**
 * Builds today's report, stores the snapshot (so it can be read later exactly as it was at 7 PM), and sends
 * a WhatsApp summary with a link to every management user who has a mobile number. Safe to re-run: the
 * snapshot is replaced and each person gets the message at most once a day.
 */
export async function generateDailyReport(now = new Date(), opts: { send?: boolean } = {}) {
  const { data, season, extras } = await load(now);
  const ps = periods(season.start, now);
  const date = todayIST(now);
  const today = computeMetrics(data, ps.today, now, extras);
  const report: DailyReport = { date, generatedAt: now.toISOString(), today, mtd: computeMetrics(data, ps.mtd, now, extras), season: computeMetrics(data, ps.season, now, extras), recipients: 0 };

  let sent = 0;
  let emailed = 0;
  if (opts.send !== false) {
    const v = (k: string) => String(today.daily.find((f) => f.key === k)?.value ?? 0);
    const params = [formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' }), v('collected'), v('visits_actual'), v('confirmed'), String(today.backlog.escalated48), String(today.backlog.visitsNeedingOutcome), `${siteUrl}/crm/reports/${date}`];
    const recipients = data.staff.filter((x) => x.active && x.roles.some((r) => REPORT_ROLES.includes(r)));
    for (const s of recipients.filter((x) => x.phone)) {
      const r = await sendTemplate({ template: 'daily_report', to: s.phone!, params, actorId: null, dedupeKey: `daily_report:${date}:${s.id}` });
      // A re-run finds today's message already sent (dedupe) — it still counts as delivered to that person.
      if (r.status === 'sent' || r.reason === 'Already sent.') sent++;
    }
    // §8: also by email, with the PDF on letterhead attached
    const to = recipients.map((s) => s.email).filter((e): e is string => Boolean(e));
    if (to.length) {
      const pdf = await reportPdf(report);
      const r = await sendEmail({ to, subject: `Bhargava admissions: 7 PM report for ${formatDate(date)}`, html: reportEmailHtml(report, `${siteUrl}/crm/reports/${date}`), attachments: [{ filename: `BJC-daily-report-${date}.pdf`, content: pdf, contentType: 'application/pdf' }], dedupeKey: `daily_report_email:${date}` });
      if (r.status === 'sent' || r.status === 'logged') emailed = to.length;
    }
  }
  report.recipients = sent + emailed;
  await saveReport(report);
  return { date, recipients: sent, emailed, flagged: today.flagged.length };
}

import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { admissionsSeason } from '@/content/sample';
import { addDays, formatDate, todayIST } from '../dates';
import { siteUrl } from '../seo';
import { tx } from '../store/file';
import { sendTemplate } from '../whatsapp/service';
import { computeMetrics, dailySeries, periods, type Metrics, type PeriodKey } from './metrics';
import { can } from './permissions';
import { getCrmRepo } from './repo';
import { CrmError } from './service';
import type { Role, Staff } from './types';

const istMidnight = (date: string) => new Date(`${date}T00:00:00+05:30`).toISOString();

async function load(now: Date) {
  const repo = getCrmRepo();
  const seriesFrom = addDays(todayIST(now), -29);
  const since = istMidnight(seriesFrom < admissionsSeason.start ? seriesFrom : admissionsSeason.start);
  const [data, staff] = await Promise.all([repo.exportForMetrics(since), repo.listStaff()]);
  return { data: { ...data, staff }, seriesFrom };
}

export async function dashboard(user: Staff, key: PeriodKey, now = new Date()) {
  if (!can(user, 'dashboard.view')) throw new CrmError('Only management can see the dashboard.');
  const { data, seriesFrom } = await load(now);
  const ps = periods(admissionsSeason.start, now);
  return { metrics: computeMetrics(data, ps[key], now), series: dailySeries(data, seriesFrom, todayIST(now)), periods: ps, season: admissionsSeason };
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
  const { data } = await load(now);
  const ps = periods(admissionsSeason.start, now);
  const date = todayIST(now);
  const today = computeMetrics(data, ps.today, now);
  const report: DailyReport = { date, generatedAt: now.toISOString(), today, mtd: computeMetrics(data, ps.mtd, now), season: computeMetrics(data, ps.season, now), recipients: 0 };

  let sent = 0;
  if (opts.send !== false) {
    const v = (k: string) => String(today.funnel.find((f) => f.key === k)?.value ?? 0);
    const params = [formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' }), v('leads'), v('visits_held'), v('confirmed'), String(today.backlog.escalated48), String(today.backlog.visitsNeedingOutcome), `${siteUrl}/crm/reports/${date}`];
    for (const s of data.staff.filter((x) => x.active && x.phone && x.roles.some((r) => REPORT_ROLES.includes(r)))) {
      const r = await sendTemplate({ template: 'daily_report', to: s.phone!, params, actorId: null, dedupeKey: `daily_report:${date}:${s.id}` });
      // A re-run finds today's message already sent (dedupe) — it still counts as delivered to that person.
      if (r.status === 'sent' || r.reason === 'Already sent.') sent++;
    }
  }
  report.recipients = sent;
  await saveReport(report);
  return { date, recipients: sent, flagged: today.flagged.length };
}

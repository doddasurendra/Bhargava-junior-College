import { NextResponse } from 'next/server';
import { getStaffSession } from '@/lib/crm/auth';
import { toCsv } from '@/lib/crm/csv';
import { can } from '@/lib/crm/permissions';
import { analytics, knowledgeAudit } from '@/lib/kb/insights';
import { generateReport, tablePdf } from '@/lib/kb/intel';
import { auditLog, KbError } from '@/lib/kb/service';
import { exportKb } from '@/lib/kb/transfer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const file = (bytes: Uint8Array, mime: string, name: string) => new NextResponse(Buffer.from(bytes), { headers: { 'content-type': mime, 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'private, no-store' } });
const csv = (rows: (string | number)[][], name: string) => file(new TextEncoder().encode(`﻿${toCsv(rows.map((r) => r.map(String)))}`), 'text/csv; charset=utf-8', name);

/**
 * Staff downloads: ?what=kb (ZIP/JSON of the KB), report (one-click reports), analytics, audit-log,
 * knowledge-audit — each checked against the user's permissions.
 */
export async function GET(req: Request) {
  const user = await getStaffSession();
  if (!user) return new NextResponse('Sign in', { status: 401 });
  const u = new URL(req.url);
  const what = u.searchParams.get('what');
  const format = u.searchParams.get('format') ?? 'csv';
  try {
    if (what === 'kb') {
      const r = await exportKb(user, { centre: u.searchParams.get('centre') || undefined, format: format === 'json' ? 'json' : 'zip' });
      return file(r.bytes, r.mime, r.name);
    }
    if (what === 'report') {
      const r = await generateReport(user, u.searchParams.get('id') ?? '', format === 'pdf' ? 'pdf' : 'excel');
      return file(r.bytes, r.mime, r.name);
    }
    if (!can(user, 'kb.analytics')) return new NextResponse('Not allowed', { status: 403 });
    if (what === 'analytics') {
      const a = await analytics(Number(u.searchParams.get('days')) || 30);
      const rows: (string | number)[][] = [['Section', 'Metric', 'Value'], ['Search', 'Searches', a.search.total], ['Search', 'Zero-result searches', a.search.zero], ['AI', 'Questions', a.ai.questions], ['AI', 'Answer rate %', a.ai.answerRate ?? ''], ['AI', '👍', a.ai.up], ['AI', '👎', a.ai.down], ['AI', 'Answers with sources %', a.ai.withSources ?? ''], ['Health', 'Outdated', a.health.outdated], ['Health', 'Drafts > 7 days', a.health.draftsOver7], ['Health', 'No views 90 days', a.health.noViews90], ['Performance', 'Search ms (avg)', a.performance.searchMs ?? ''], ['Performance', 'AI ms (avg)', a.performance.aiMs ?? ''], ['Performance', 'Ingestion ms (avg)', a.performance.ingestMs ?? ''], ['Performance', 'Error rate %', a.performance.errorRate], ...a.search.top.map(([q, n]) => ['Top query', q, n]), ...a.search.zeroQueries.map(([q, n]) => ['Zero-result query', q, n]), ...a.ai.unanswered.map((g) => ['Unanswered', g.q, g.count]), ...a.contributors.map((c) => ['Contributor', `${c.actor} (${c.what})`, c.n])];
      if (format === 'pdf') return file(await tablePdf(`Knowledge analytics (${a.days} days)`, rows.map((r) => r.map(String))), 'application/pdf', 'bjc-knowledge-analytics.pdf');
      return csv(rows, 'bjc-knowledge-analytics.csv');
    }
    if (what === 'audit-log') {
      const rows = await auditLog(user, { limit: 5000 });
      return csv([['At', 'Actor', 'Role', 'Action', 'Target', 'Id', 'Title', 'Detail'], ...rows.map((r) => [r.at, r.actor, r.role, r.action, r.targetKind, r.targetId ?? '', r.title ?? '', r.detail ?? ''])], 'bjc-knowledge-audit-log.csv');
    }
    if (what === 'knowledge-audit') {
      const f = await knowledgeAudit();
      return csv([['Finding', 'Type', 'Id', 'Title', 'Detail'], ...f.map((x) => [x.kind, x.targetKind, x.id, x.title, x.detail])], 'bjc-knowledge-audit.csv');
    }
    return new NextResponse('Unknown export', { status: 400 });
  } catch (e) {
    if (e instanceof KbError) return new NextResponse(e.message, { status: 403 });
    console.error('[kb export]', e);
    return new NextResponse('Export failed', { status: 500 });
  }
}

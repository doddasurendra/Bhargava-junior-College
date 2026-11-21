import 'server-only';
import { getCrmRepo } from '../crm/repo';
import { todayIST } from '../dates';
import { getRecordStore } from '../records';
import { kbArticles, kbAudit, kbConversations, kbFiles, kbGaps, kbQueue, kbSearches } from './collections';
import { buildIndex } from './index';
import { kbStorageUsage, storageQuotaBytes } from './storage';
import { similarity } from './text';

/**
 * Dashboard (§1.1), knowledge audit (§18 "Complete Knowledge Audit", duplicates, outdated detection) and
 * analytics (§22). All numbers are computed from the KB's own records; nothing is estimated.
 */
const st = () => getRecordStore();
const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000).toISOString();

export async function dashboard() {
  const [articles, files, audits, searches, gaps, idx, storage] = await Promise.all([kbArticles.list(st()), kbFiles.list(st()), kbAudit.list(st(), { k2From: daysAgo(7) }), kbSearches.list(st(), { k2From: daysAgo(30) }), kbGaps.list(st()), buildIndex(), kbStorageUsage()]);
  const week = daysAgo(7);
  const today = todayIST();
  const top = new Map<string, number>();
  for (const s of searches) top.set(s.data.q.toLowerCase(), (top.get(s.data.q.toLowerCase()) ?? 0) + 1);
  return {
    articles: articles.length,
    published: articles.filter((a) => a.data.status === 'published').length,
    files: files.length,
    chunks: idx.chunks.length,
    newThisWeek: articles.filter((a) => a.createdAt >= week).length + files.filter((f) => f.createdAt >= week).length,
    changedThisWeek: new Set(audits.filter((a) => ['edit', 'replace', 'restore'].includes(a.data.action)).map((a) => a.data.targetId)).size,
    pending: articles.filter((a) => a.data.status === 'review' || a.data.status === 'approved').length + files.filter((f) => f.data.status === 'review' || f.data.status === 'approved').length,
    topSearches: [...top.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([q, n]) => ({ q, n })),
    unanswered: gaps.filter((g) => g.data.status === 'open').sort((a, b) => b.data.count - a.data.count).slice(0, 8).map((g) => ({ id: g.id, ...g.data })),
    outdated: [...articles, ...files].filter((r) => r.data.status === 'published' && r.data.reviewBy && r.data.reviewBy < today).length,
    storage: { ...storage, quota: storageQuotaBytes() },
  };
}

export interface AuditFinding {
  kind: 'outdated' | 'past_review' | 'duplicate' | 'unapproved' | 'orphan' | 'no_views' | 'old_year' | 'ocr_needed';
  targetKind: 'article' | 'file';
  id: string;
  title: string;
  detail: string;
}

/** Knowledge audit: outdated (fee years, old circulars, review dates), duplicates (hash + similarity), stuck drafts, orphans. */
export async function knowledgeAudit(): Promise<AuditFinding[]> {
  const [articles, files, views] = await Promise.all([kbArticles.list(st()), kbFiles.list(st()), kbAudit.list(st(), { k2From: daysAgo(90) })]);
  const staff = new Map((await getCrmRepo().listStaff()).map((s) => [s.id, s]));
  const today = todayIST();
  const year = Number(today.slice(0, 4));
  const viewed = new Set(views.filter((v) => v.data.action === 'view' || v.data.action === 'download').map((v) => v.data.targetId));
  const out: AuditFinding[] = [];
  const items = [...articles.map((r) => ({ kind: 'article' as const, r, text: `${r.data.title.en}\n${r.data.body.en}` })), ...files.map((r) => ({ kind: 'file' as const, r, text: r.data.title.en }))];
  for (const { kind, r, text } of items) {
    const d = r.data;
    const title = d.title.en;
    if (d.status === 'archived') continue;
    if (d.reviewBy && d.reviewBy < today) out.push({ kind: 'past_review', targetKind: kind, id: r.id, title, detail: `Review date ${d.reviewBy} has passed` });
    // academic years mentioned that are over: "2024-25", "2025-26" while today is 2026-27+
    const years = [...text.matchAll(/\b(20\d{2})\s*[-–/]\s*(\d{2})\b/g)].map((m) => Number(m[1]));
    const ay = today.slice(5) >= '06' ? year : year - 1; // academic year starts in June
    if (years.length && Math.max(...years) < ay - 0) out.push({ kind: 'old_year', targetKind: kind, id: r.id, title, detail: `Mentions academic year ${Math.max(...years)}-${String((Math.max(...years) + 1) % 100).padStart(2, '0')}; current is ${ay}-${String((ay + 1) % 100).padStart(2, '0')}` });
    if ((d.status === 'draft' || d.status === 'review') && r.updatedAt < daysAgo(7)) out.push({ kind: 'unapproved', targetKind: kind, id: r.id, title, detail: `${d.status === 'review' ? 'In review' : 'Draft'} for ${Math.floor((Date.now() - Date.parse(r.updatedAt)) / 86400_000)} days` });
    // listStaff returns active staff only, so an owner missing from it has left or been deactivated
    if (!d.ownerId || !staff.has(d.ownerId)) out.push({ kind: 'orphan', targetKind: kind, id: r.id, title, detail: d.ownerId ? 'Owner is no longer active' : 'No owner' });
    if (d.status === 'published' && r.createdAt < daysAgo(90) && !viewed.has(r.id)) out.push({ kind: 'no_views', targetKind: kind, id: r.id, title, detail: 'No views or downloads in 90 days' });
    if (kind === 'file' && 'extract' in d && d.extract.status === 'ocr_needed') out.push({ kind: 'ocr_needed', targetKind: kind, id: r.id, title, detail: d.extract.error ?? 'Scanned: OCR needed' });
  }
  // duplicates: identical files (hash) and near-identical article text (similarity ≥ 0.6)
  const bySha = new Map<string, string[]>();
  for (const f of files) bySha.set(f.data.sha256, [...(bySha.get(f.data.sha256) ?? []), f.id]);
  for (const ids of bySha.values()) if (ids.length > 1) for (const id of ids.slice(1)) out.push({ kind: 'duplicate', targetKind: 'file', id, title: files.find((f) => f.id === id)!.data.title.en, detail: 'Same file content as another document' });
  const live = articles.filter((a) => a.data.status !== 'archived');
  for (let i = 0; i < live.length; i++)
    for (let j = i + 1; j < live.length; j++) {
      const s = similarity(live[i].data.body.en, live[j].data.body.en);
      if (s >= 0.6) out.push({ kind: 'duplicate', targetKind: 'article', id: live[j].id, title: live[j].data.title.en, detail: `${Math.round(s * 100)}% similar to “${live[i].data.title.en}”` });
    }
  return out;
}

export async function analytics(days = 30) {
  const from = daysAgo(days);
  const [audits, searches, convs, gaps, queue, articles, files] = await Promise.all([kbAudit.list(st(), { k2From: from }), kbSearches.list(st(), { k2From: from }), kbConversations.list(st()), kbGaps.list(st()), kbQueue.list(st()), kbArticles.list(st()), kbFiles.list(st())]);
  const byDay = (rows: { at: string }[]) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.at.slice(0, 10), (m.get(r.at.slice(0, 10)) ?? 0) + 1);
    return [...m.entries()].sort();
  };
  const count = <T,>(rows: T[], key: (r: T) => string) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const views = audits.filter((a) => a.data.action === 'view' || a.data.action === 'download').map((a) => a.data);
  const s = searches.map((x) => x.data);
  const msgs = convs.flatMap((c) => c.data.messages.map((m) => ({ ...m, assistant: c.data.assistant }))).filter((m) => m.at >= from);
  const aiQ = audits.filter((a) => a.data.action === 'ai_query').map((a) => a.data);
  const answered = msgs.filter((m) => m.found).length;
  const up = msgs.filter((m) => m.feedback === 'up').length;
  const down = msgs.filter((m) => m.feedback === 'down').length;
  const today = todayIST();
  const q = queue.map((x) => x.data);
  const ingest = q.filter((x) => x.status === 'done' && x.ms !== null && x.at >= from);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((t, x) => t + x, 0) / xs.length) : null);
  const openGaps = gaps.filter((g) => g.data.status === 'open');
  const recentGaps = openGaps.filter((g) => g.data.lastAt >= daysAgo(1)).reduce((t, g) => t + g.data.count, 0);
  const contributors = count(audits.filter((a) => ['create', 'upload', 'approve', 'approve_publish', 'publish'].includes(a.data.action)).map((a) => a.data), (r) => `${r.actor}|${['create', 'upload'].includes(r.action) ? 'created' : 'approved'}`);
  return {
    days,
    usage: { viewsByDay: byDay(views), searchesByDay: byDay(s), aiByDay: byDay(aiQ), byRole: count([...views, ...aiQ], (r) => r.role), byCentre: count(audits.filter((a) => a.data.targetKind === 'centre').map((a) => a.data), (r) => r.targetId ?? '?'), byLang: count(s, (r) => r.lang) },
    search: { total: s.length, zero: s.filter((x) => x.results === 0).length, zeroQueries: count(s.filter((x) => x.results === 0), (r) => r.q.toLowerCase()).slice(0, 15), top: count(s, (r) => r.q.toLowerCase()).slice(0, 15), ctr: s.length ? Math.round((s.filter((x) => x.clicked).length / s.length) * 100) : null },
    ai: { questions: msgs.length, answerRate: msgs.length ? Math.round((answered / msgs.length) * 100) : null, up, down, withSources: msgs.length ? Math.round((msgs.filter((m) => m.sources.length).length / msgs.length) * 100) : null, handoffs: msgs.filter((m) => m.handoff).length, byMode: count(msgs, (m) => m.mode), unanswered: openGaps.sort((a, b) => b.data.count - a.data.count).slice(0, 20).map((g) => ({ id: g.id, ...g.data })) },
    health: {
      outdated: [...articles, ...files].filter((r) => r.data.status === 'published' && r.data.reviewBy && r.data.reviewBy < today).length,
      draftsOver7: [...articles, ...files].filter((r) => (r.data.status === 'draft' || r.data.status === 'review') && r.updatedAt < daysAgo(7)).length,
      noViews90: [...articles, ...files].filter((r) => r.data.status === 'published' && r.createdAt < daysAgo(90) && !views.some((v) => v.targetId === r.id)).length,
    },
    contributors: contributors.slice(0, 20).map(([k, n]) => ({ actor: k.split('|')[0], what: k.split('|')[1], n })),
    performance: { searchMs: avg(s.map((x) => x.ms)), aiMs: avg(msgs.map((m) => m.ms)), ingestMs: avg(ingest.map((x) => x.ms!)), failed: q.filter((x) => x.status === 'failed').length, errorRate: q.length ? Math.round((q.filter((x) => x.status === 'failed').length / q.length) * 100) : 0 },
    alerts: [
      ...(recentGaps >= 10 ? [`${recentGaps} unanswered questions in the last 24 hours`] : []),
      ...(q.some((x) => x.status === 'failed' && x.at >= daysAgo(1)) ? ['Ingestion failures in the last 24 hours'] : []),
    ],
  };
}

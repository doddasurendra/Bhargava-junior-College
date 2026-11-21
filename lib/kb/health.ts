import 'server-only';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { requiresMfa } from '../auth/service';
import { getAuthStore } from '../auth/store';
import { devLoginEnabled } from '../crm/auth';
import { getCrmRepo, usingSupabase } from '../crm/repo';
import { ROLE_LABELS } from '../crm/types';
import { showCodesOnScreen } from '../localTesting';
import { getRecordStore } from '../records';
import { mode as waMode } from '../whatsapp/service';
import { kbQueue, kbSettings } from './collections';
import { embeddingStats } from './embed';
import { buildIndex } from './index';
import { llmAvailable } from './ai';
import { channelStatus } from './notify';
import { KB_BUCKET, kbStorageUsage, storageQuotaBytes } from './storage';

/**
 * Supabase Integration Centre (§21): reads the real state; nothing here is a guess. Database facts (tables,
 * RLS, row estimates, migrations, extensions, pg_cron) come from the SQL function public.kb_health()
 * (migration 20261121000000, security definer, executable by service_role only). Without Supabase
 * configured the screen reports the local JSON store instead and says so.
 */
const sb = () => (usingSupabase() ? createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }) : null);

export const KB_COLLECTIONS = ['kb_articles', 'kb_versions', 'kb_comments', 'kb_categories', 'kb_files', 'kb_file_text', 'kb_audit', 'kb_searches', 'kb_conversations', 'kb_gaps', 'kb_queue', 'kb_grievances', 'kb_settings', 'notify_rules', 'notify_log', 'notify_optouts', 'dept_requests', 'kb_licences'];

/** Jobs this project runs on a schedule (Vercel Cron → route handlers; Vercel Hobby runs each once a day). */
export function scheduledJobs() {
  let crons: { path: string; schedule: string }[] = [];
  try {
    crons = JSON.parse(readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf8')).crons ?? [];
  } catch {
    /* no vercel.json */
  }
  return crons;
}

export function localMigrations() {
  try {
    return readdirSync(path.join(process.cwd(), 'supabase', 'migrations')).filter((f) => f.endsWith('.sql')).sort();
  } catch {
    return [];
  }
}

export async function lastCronRuns() {
  const out: Record<string, { at: string; ok: boolean; detail: string }> = {};
  for (const j of scheduledJobs()) {
    const r = await kbSettings.get(getRecordStore(), `cron:${j.path}`);
    if (r) out[j.path] = r.data as { at: string; ok: boolean; detail: string };
  }
  return out;
}

export async function recordCronRun(pathname: string, ok: boolean, detail: string) {
  await kbSettings.put(getRecordStore(), { at: new Date().toISOString(), ok, detail: detail.slice(0, 500) }, `cron:${pathname}`);
}

interface DbHealth {
  tables: { name: string; rls: boolean; rows: number }[];
  migrations: string[];
  extensions: string[];
  cron: { jobname: string; schedule: string; active: boolean }[] | null;
  kb_embeddings: number | null;
}

export async function healthReport() {
  const client = sb();
  const env = process.env.VERCEL_ENV ?? (process.env.NODE_ENV === 'production' ? 'production' : 'development');
  const ref = process.env.SUPABASE_URL?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ?? null;
  const demoProjects = (process.env.DEMO_SUPABASE_PROJECTS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const store = getRecordStore();

  // database
  let db: DbHealth | null = null;
  let dbError: string | null = null;
  if (client) {
    const { data, error } = await client.rpc('kb_health');
    if (error) dbError = `kb_health() failed: ${error.message}. Apply migration 20261121000000_knowledge_hub.sql (supabase db push).`;
    else db = data as DbHealth;
  }
  const collectionCounts: { name: string; rows: number }[] = [];
  for (const c of KB_COLLECTIONS) collectionCounts.push({ name: c, rows: (await store.list(c)).length });

  // storage
  let buckets: { name: string; public: boolean }[] = [];
  let storageError: string | null = null;
  if (client) {
    const { data, error } = await client.storage.listBuckets();
    if (error) storageError = error.message;
    else buckets = (data ?? []).map((b) => ({ name: b.name, public: b.public }));
  }
  const usage = await kbStorageUsage();

  // pgvector / index
  const idx = await buildIndex();
  const emb = embeddingStats(idx.chunks);

  // queues
  const q = (await kbQueue.list(store)).map((r) => ({ id: r.id, ...r.data }));

  // auth
  const staff = await getCrmRepo().listStaff();
  const auths = new Map((await getAuthStore().listAll()).map((a) => [a.staffId, a]));
  const perRole = new Map<string, number>();
  for (const s of staff) for (const r of s.roles) perRole.set(r, (perRole.get(r) ?? 0) + 1);
  const adminMfa = staff.filter((s) => requiresMfa(s)).map((s) => ({ name: s.fullName, role: ROLE_LABELS[s.roles[0]] ?? s.roles[0], mfa: !!auths.get(s.id)?.totpEnabledAt }));

  // environment safety
  const isProd = env === 'production';
  const demoRows = (await Promise.all(['kb_articles', 'kb_files', 'batches', 'tests', 'attendance'].map(async (c) => (await store.list(c)).filter((r) => r.id.startsWith('demo-')).length))).reduce((t, n) => t + n, 0);
  const sampleArticles = (await store.list<{ sample?: boolean }>('kb_articles')).filter((r) => r.data.sample).length;
  const warnings: string[] = [];
  if (isProd && demoRows) warnings.push(`${demoRows} demo rows (id demo-…) found in PRODUCTION data. Remove them: npm run seed:demo is for staging/preview only.`);
  if (isProd && devLoginEnabled()) warnings.push('Developer sign-in picker is ON in production.');
  if (isProd && showCodesOnScreen()) warnings.push('Test OTP (codes shown on screen) is ON in production.');
  if (ref && demoProjects.includes(ref) && isProd) warnings.push(`This production deployment points at a project listed as DEMO (${ref}).`);
  if (!client) warnings.push(isProd ? 'Supabase service key missing: production has no database (logins and the CRM have no data).' : 'Supabase not connected: running on the local JSON store (.data/dev-db.json).');
  if (db) for (const t of db.tables) if (!t.rls) warnings.push(`RLS is OFF on public.${t.name}.`);
  if (usage.bytes > storageQuotaBytes() * 0.8) warnings.push('Storage over 80% of quota.');
  if (q.some((x) => x.status === 'failed')) warnings.push(`${q.filter((x) => x.status === 'failed').length} failed ingestion job(s) in the queue.`);
  if (adminMfa.some((a) => !a.mfa)) warnings.push(`${adminMfa.filter((a) => !a.mfa).length} admin account(s) without 2FA.`);
  const sync = (await kbSettings.get(store, 'sync'))?.data as { at?: string; reason?: string } | undefined;

  const wa = waMode();
  return {
    project: { ref, url: process.env.SUPABASE_URL ?? null, env, connected: !!client, kind: !client ? 'local JSON store' : ref && demoProjects.includes(ref) ? 'staging / demo' : isProd ? 'production' : 'development' },
    database: { db, dbError, collections: collectionCounts, localMigrations: localMigrations() },
    storage: { bucket: KB_BUCKET, buckets, error: storageError, usage, quota: storageQuotaBytes() },
    vector: { ...emb, chunks: idx.chunks.length, indexBuiltAt: idx.builtAt, indexMs: idx.ms, pgvector: db ? db.extensions.includes('vector') : null, stored: db?.kb_embeddings ?? null },
    functions: [
      { name: 'kb-ingest', runtime: 'Next.js server (lib/kb/files.ts ingest)', note: 'Runs inside the upload request; recorded in the queue' },
      { name: 'kb-ocr', runtime: 'Claude vision (lib/kb/ocr.ts)', note: llmAvailable() ? 'Configured' : 'Not configured: ANTHROPIC_API_KEY missing' },
      { name: 'kb-embed', runtime: 'Voyage embeddings (lib/kb/embed.ts)', note: emb.configured ? 'Configured' : 'Not configured: VOYAGE_API_KEY missing (keyword search only)' },
      { name: 'ai-answer', runtime: 'Next.js route /api/kb/ask', note: llmAvailable() ? 'Claude answers with citations' : 'Grounded extracts (no LLM key)' },
      { name: 'notify', runtime: 'lib/kb/notify.ts', note: 'See channel status' },
    ],
    jobs: { crons: scheduledJobs(), pgCron: db?.cron ?? null, lastRuns: await lastCronRuns() },
    realtime: { lastSync: sync?.at ?? null, reason: sync?.reason ?? null, note: 'Publishing bumps the sync stamp: the index rebuilds on the next search, website/app caches refresh within 15 s.' },
    auth: { perRole: [...perRole.entries()].map(([r, n]) => ({ role: ROLE_LABELS[r] ?? r, n })).sort((a, b) => b.n - a.n), adminMfa, testOtp: showCodesOnScreen(), devLogin: devLoginEnabled() },
    queue: { pending: q.filter((x) => x.status === 'pending').length, processing: q.filter((x) => x.status === 'processing').length, failed: q.filter((x) => x.status === 'failed'), done: q.filter((x) => x.status === 'done').length },
    integrations: [
      { name: 'WhatsApp Cloud API', ok: wa.kind === 'cloud', note: channelStatus().whatsapp.note },
      { name: 'Email (SMTP)', ok: channelStatus().email.ready, note: channelStatus().email.note },
      { name: 'SMS', ok: false, note: channelStatus().sms.note },
      { name: 'Payments (Razorpay)', ok: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET), note: process.env.RAZORPAY_KEY_ID ? 'Keys set' : 'Not configured' },
      { name: 'Claude (AI answers, OCR)', ok: llmAvailable(), note: llmAvailable() ? 'ANTHROPIC_API_KEY set' : 'Not configured' },
    ],
    demo: { demoRows, sampleArticles },
    warnings,
  };
}

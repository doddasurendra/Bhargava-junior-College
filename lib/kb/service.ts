import 'server-only';
import { invalidateContent } from '../cms';
import { can, isDeveloper } from '../crm/permissions';
import type { Staff } from '../crm/types';
import { todayIST } from '../dates';
import { getRecordStore } from '../records';
import type { Rec } from '../records/types';
import { canRead, LEVELS, SENSITIVITY, viewerKey, viewerRole, type Level, type Sensitivity, type Viewer } from './access';
import { centreById } from './centres';
import { articleSchema, kbArticles, kbAudit, kbCategories, kbComments, kbSettings, kbVersions, type Article, type KbStatus } from './collections';
import { diffLines } from './text';

/**
 * Knowledge Hub core (§1): articles with the Draft → In review → Approved → Published → Archived workflow,
 * a version on every save (diff + restore), review comments, categories, settings and the audit log.
 * Every read goes through canRead (access level + sensitivity); every write through the kb.* permissions.
 */
export class KbError extends Error {}
const st = () => getRecordStore();
const now = () => new Date().toISOString();

// ---------------------------------------------------------------- viewers, settings, audit

export interface KbSettingsShape {
  subjectHeads: Record<string, string | null>;
  assistants: Record<string, { prompt: string; suggestions: string[] }>;
  retentionYears: number;
  reviewMonths: number;
}
const DEFAULT_SETTINGS: KbSettingsShape = { subjectHeads: { maths: null, physics: null, chemistry: null, biology: null }, assistants: {}, retentionYears: 7, reviewMonths: 12 };

export async function getSettings(): Promise<KbSettingsShape> {
  const r = await kbSettings.get(st(), 'main');
  return { ...DEFAULT_SETTINGS, ...((r?.data as Partial<KbSettingsShape>) ?? {}) };
}

export async function saveSettings(user: Staff, patch: Partial<KbSettingsShape>) {
  if (!can(user, 'kb.admin') && !can(user, 'kb.approve')) throw new KbError('Only KB approvers and admins can change Knowledge Hub settings.');
  if (user.viewedBy) throw new KbError('Read-only while viewing as another user.');
  const next = { ...(await getSettings()), ...patch };
  await kbSettings.put(st(), next, 'main');
  await audit(user, 'settings', 'settings', 'main', 'Knowledge Hub settings', Object.keys(patch).join(', '));
  return next;
}

export async function staffViewer(user: Staff): Promise<Viewer> {
  const s = await getSettings();
  const heads = Object.entries(s.subjectHeads).filter(([, id]) => id === user.id).map(([d]) => d);
  return { kind: 'staff', user, subjectHeadOf: heads };
}

type Actor = Staff | Viewer;
const actorOf = (a: Actor) => ('kind' in a ? { key: viewerKey(a), role: viewerRole(a) } : { key: `staff:${a.id}`, role: a.roles[0] ?? 'staff' });

export type AuditTarget = 'article' | 'file' | 'centre' | 'search' | 'ai' | 'export' | 'import' | 'settings' | 'rule' | 'grievance' | 'system';
export async function audit(a: Actor, action: string, targetKind: AuditTarget, targetId: string | null, title: string | null, detail: string | null = null) {
  const { key, role } = actorOf(a);
  try {
    await kbAudit.put(st(), { actor: key, role, action, targetKind, targetId, title: title?.slice(0, 240) ?? null, detail: detail?.slice(0, 500) ?? null, at: now() });
  } catch (e) {
    console.error('[kb] audit write failed', (e as Error).message);
  }
}

/** The sync stamp: changes on every publish/archive/replace. Indexes, the website and app caches rebuild from it. */
export async function bumpSync(reason: string) {
  await kbSettings.put(st(), { stamp: `${Date.now().toString(36)}`, at: now(), reason }, 'sync');
  invalidateContent();
  try {
    const { revalidatePath } = await import('next/cache');
    for (const p of ['/knowledge-base', '/app/knowledge', '/crm/knowledge']) revalidatePath(p);
  } catch {
    /* outside a request (scripts, tests) */
  }
}
export async function syncStamp() {
  const r = await kbSettings.get(st(), 'sync');
  return (r?.data as { stamp?: string; at?: string } | undefined) ?? {};
}

// ---------------------------------------------------------------- permissions

const isAdmin = (u: Staff) => isDeveloper(u) || u.roles[0] === 'super_admin';
export const canEditKb = (u: Staff) => can(u, 'kb.edit') && !u.viewedBy;
export const canApproveKb = (u: Staff) => can(u, 'kb.approve') && !u.viewedBy;

/** Editors may give an item any level they can read themselves (so no one can hide content above their own access). */
export function assertLevel(v: Viewer, access: Level, sensitivity: Sensitivity) {
  if (!canRead(v, { access, sensitivity, ownerId: v.kind === 'staff' ? v.user.id : null })) throw new KbError('You can’t set an access level or sensitivity above your own.');
}

// ---------------------------------------------------------------- articles

export type ArticleRec = Rec<Article>;

export interface ArticleInput {
  titleEn: string;
  titleTe?: string | null;
  titleHi?: string | null;
  bodyEn: string;
  bodyTe?: string | null;
  bodyHi?: string | null;
  centre: string;
  topic?: string | null;
  type?: Article['type'];
  access: Level;
  sensitivity: Sensitivity;
  channels: Article['channels'];
  tags?: string[];
  categoryId?: string | null;
  reviewBy?: string | null;
  ownerId?: string | null;
  department?: string | null;
  campus?: string | null;
  sample?: boolean;
  aiGenerated?: boolean;
  basedOn?: string[];
}

const snapshotOf = (a: Article) => ({ title: a.title, body: a.body, centre: a.centre, topic: a.topic, type: a.type, access: a.access, sensitivity: a.sensitivity, channels: a.channels, tags: a.tags, reviewBy: a.reviewBy, status: a.status });

async function addVersion(id: string, a: Article, by: string, note: string | null) {
  await kbVersions.put(st(), { articleId: id, version: a.version, snapshot: snapshotOf(a), by, at: now(), note }, `${id}:v${a.version}`);
}

function reviewDefault(months: number) {
  const d = new Date(`${todayIST()}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export async function saveArticle(user: Staff, input: ArticleInput, id?: string, note: string | null = null): Promise<ArticleRec> {
  if (!canEditKb(user)) throw new KbError('Your role can’t write knowledge articles.');
  if (!centreById(input.centre)) throw new KbError('Unknown centre.');
  if (!LEVELS.includes(input.access) || !SENSITIVITY.includes(input.sensitivity)) throw new KbError('Choose an access level and a sensitivity.');
  const v = await staffViewer(user);
  assertLevel(v, input.access, input.sensitivity);
  if (input.access === 'public' && input.sensitivity !== 'public') throw new KbError('A public article must have the Public sensitivity label.');
  const prev = id ? await kbArticles.get(st(), id) : null;
  if (id && !prev) throw new KbError('Article not found.');
  if (prev && !canRead(v, prev.data)) throw new KbError('Article not found.');
  if (prev?.data.status === 'archived') throw new KbError('Unarchive the article before editing it.');
  const settings = await getSettings();
  const base: Partial<Article> = prev?.data ?? {};
  // editing a published or approved article sends the new version back to draft; readers keep the live version
  const status: KbStatus = prev ? (prev.data.status === 'published' || prev.data.status === 'approved' ? 'draft' : prev.data.status === 'review' ? 'review' : 'draft') : 'draft';
  const data = articleSchema.parse({
    ...base,
    title: { en: input.titleEn, te: input.titleTe || null, hi: input.titleHi || null },
    body: { en: input.bodyEn, te: input.bodyTe || null, hi: input.bodyHi || null },
    centre: input.centre,
    topic: input.topic || null,
    type: input.type ?? base.type ?? 'article',
    access: input.access,
    sensitivity: input.sensitivity,
    channels: input.channels.length ? input.channels : ['staff'],
    tags: (input.tags ?? base.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 20),
    categoryId: input.categoryId ?? base.categoryId ?? null,
    reviewBy: input.reviewBy || base.reviewBy || reviewDefault(settings.reviewMonths),
    ownerId: input.ownerId ?? base.ownerId ?? user.id,
    department: input.department ?? base.department ?? null,
    campus: input.campus ?? base.campus ?? null,
    sample: input.sample ?? base.sample ?? false,
    aiGenerated: input.aiGenerated ?? base.aiGenerated ?? false,
    basedOn: input.basedOn ?? base.basedOn ?? [],
    status,
    version: (prev?.data.version ?? 0) + 1,
    liveVersion: prev?.data.liveVersion ?? null,
    createdBy: base.createdBy ?? user.id,
    updatedBy: user.id,
    publishedAt: base.publishedAt ?? null,
    submittedBy: status === 'review' ? base.submittedBy ?? user.id : null,
    approvedBy: null,
    rejectReason: null,
    fileIds: base.fileIds ?? [],
  });
  const rec = await kbArticles.put(st(), data, id);
  await addVersion(rec.id, data, user.id, note ?? (prev ? 'edited' : 'created'));
  await audit(user, prev ? 'edit' : 'create', 'article', rec.id, data.title.en, `v${data.version}${prev?.data.status === 'published' ? ' (live version stays until re-approved)' : ''}`);
  return rec;
}

export type Transition = 'submit' | 'approve' | 'reject' | 'publish' | 'approve_publish' | 'archive' | 'unarchive';

async function reviewerAllowed(user: Staff, categoryId: string | null) {
  if (isAdmin(user)) return true;
  if (!categoryId) return true;
  const cat = await kbCategories.get(st(), categoryId);
  const roles = cat?.data.reviewerRoles ?? [];
  return !roles.length || roles.includes(user.roles[0]);
}

export async function transitionArticle(user: Staff, id: string, t: Transition, reason: string | null = null) {
  const rec = await kbArticles.get(st(), id);
  const v = await staffViewer(user);
  if (!rec || !canRead(v, rec.data)) throw new KbError('Article not found.');
  const a = { ...rec.data };
  const s = a.status;
  const need = (ok: boolean, msg: string) => {
    if (!ok) throw new KbError(msg);
  };
  switch (t) {
    case 'submit':
      need(canEditKb(user), 'Your role can’t submit articles.');
      need(s === 'draft', 'Only drafts can be sent for review.');
      a.status = 'review';
      a.submittedBy = user.id;
      break;
    case 'reject':
      need(canApproveKb(user) && (await reviewerAllowed(user, a.categoryId)), 'You are not a reviewer for this category.');
      need(s === 'review' || s === 'approved', 'Only articles in review can be rejected.');
      need(!!reason?.trim(), 'Give a reason for rejecting.');
      a.status = 'draft';
      a.rejectReason = reason!.trim().slice(0, 500);
      a.approvedBy = null;
      break;
    case 'approve':
    case 'approve_publish':
    case 'publish': {
      need(canApproveKb(user) && (await reviewerAllowed(user, a.categoryId)), 'You are not a reviewer for this category.');
      if (t === 'publish') need(s === 'approved', 'Approve the article before publishing it.');
      else need(s === 'review' || (t === 'approve_publish' && s === 'approved'), 'Only articles in review can be approved.');
      // four-eyes: the person who submitted can't approve it (Super Admin / Developer may)
      if (t !== 'publish') need(isAdmin(user) || a.submittedBy !== user.id, 'Someone else must approve what you submitted.');
      if (t !== 'publish') {
        a.approvedBy = user.id;
        a.status = 'approved';
      }
      if (t === 'publish' || t === 'approve_publish') {
        need(!a.aiGenerated || !!a.approvedBy, 'AI-generated content must be approved by staff before publishing.');
        a.status = 'published';
        a.liveVersion = a.version;
        a.publishedAt = now();
      }
      a.rejectReason = null;
      break;
    }
    case 'archive':
      need(canApproveKb(user) || (canEditKb(user) && a.ownerId === user.id), 'Only an approver or the owner can archive.');
      need(s !== 'archived', 'Already archived.');
      a.status = 'archived';
      break;
    case 'unarchive':
      need(canApproveKb(user), 'Only an approver can unarchive.');
      need(s === 'archived', 'Not archived.');
      a.status = 'draft';
      a.liveVersion = null;
      break;
  }
  a.updatedBy = user.id;
  await kbArticles.put(st(), a, id);
  if (t === 'reject' || t === 'approve' || t === 'approve_publish') await kbComments.put(st(), { targetId: id, by: user.id, byName: user.fullName, text: t === 'reject' ? `Rejected: ${reason}` : reason?.trim() || 'Approved', at: now(), kind: t === 'reject' ? 'reject' : 'approve' });
  await audit(user, t, 'article', id, a.title.en, reason);
  if (['publish', 'approve_publish', 'archive', 'unarchive'].includes(t)) await bumpSync(`${t} article ${id}`);
  return a;
}

export async function commentOn(user: Staff, targetId: string, text: string) {
  if (!can(user, 'kb.view') || user.viewedBy) throw new KbError('Your role can’t comment.');
  await kbComments.put(st(), { targetId, by: user.id, byName: user.fullName, text: text.trim().slice(0, 2000), at: now(), kind: 'comment' });
  await audit(user, 'comment', 'article', targetId, null, text.slice(0, 200));
}
export const commentsFor = async (id: string) => (await kbComments.list(st(), { k1: id })).map((c) => c.data).sort((a, b) => a.at.localeCompare(b.at));

export async function versionsOf(id: string) {
  return (await kbVersions.list(st(), { k1: id })).map((r) => r.data).sort((a, b) => b.version - a.version);
}

type Snap = ReturnType<typeof snapshotOf>;
const asText = (s: Snap) => `# ${s.title.en}\n${s.title.te ? `# ${s.title.te}\n` : ''}${s.title.hi ? `# ${s.title.hi}\n` : ''}[${s.access} / ${s.sensitivity} / ${s.centre}${s.topic ? ` / ${s.topic}` : ''}]\n\n${s.body.en}${s.body.te ? `\n\n--- తెలుగు ---\n${s.body.te}` : ''}${s.body.hi ? `\n\n--- हिंदी ---\n${s.body.hi}` : ''}`;

export async function diffVersions(id: string, a: number, b: number) {
  const all = await versionsOf(id);
  const va = all.find((x) => x.version === a);
  const vb = all.find((x) => x.version === b);
  if (!va || !vb) throw new KbError('Version not found.');
  return diffLines(asText(va.snapshot as Snap), asText(vb.snapshot as Snap));
}

export async function restoreVersion(user: Staff, id: string, version: number) {
  const v = (await versionsOf(id)).find((x) => x.version === version);
  if (!v) throw new KbError('Version not found.');
  const s = v.snapshot as Snap;
  const rec = await saveArticle(user, { titleEn: s.title.en, titleTe: s.title.te, titleHi: s.title.hi, bodyEn: s.body.en, bodyTe: s.body.te, bodyHi: s.body.hi, centre: s.centre, topic: s.topic, type: s.type, access: s.access, sensitivity: s.sensitivity, channels: s.channels, tags: s.tags, reviewBy: s.reviewBy }, id, `restored from v${version}`);
  await audit(user, 'restore', 'article', id, s.title.en, `from v${version} → v${rec.data.version}`);
  return rec;
}

/**
 * What a reader sees: the current text when published; otherwise the last published (live) version; null
 * when it has never been published. Editors (kb.edit) also see drafts in the CRM repository.
 */
export async function liveView(rec: ArticleRec): Promise<Article | null> {
  const a = rec.data;
  if (a.status === 'published') return a;
  if (a.status === 'archived' || !a.liveVersion) return null;
  const v = await kbVersions.get(st(), `${rec.id}:v${a.liveVersion}`);
  if (!v) return null;
  return { ...a, ...(v.data.snapshot as Snap), status: 'published', version: a.liveVersion };
}

export interface ArticleFilter {
  centre?: string;
  status?: KbStatus | 'all';
  access?: Level;
  type?: string;
  topic?: string;
  q?: string;
  owner?: string;
  department?: string;
}

/** Articles this viewer may see. Staff editors get every status; everyone else only the live version. */
export async function listArticles(v: Viewer, f: ArticleFilter = {}) {
  const editor = v.kind === 'staff' && can(v.user, 'kb.edit');
  const all = await kbArticles.list(st(), f.centre ? { k1: f.centre } : undefined);
  const out: { id: string; a: Article; live: Article | null; updatedAt: string; createdAt: string }[] = [];
  for (const r of all) {
    if (!canRead(v, r.data)) continue;
    const live = await liveView(r);
    if (!editor && !live) continue;
    const a = editor ? r.data : live!;
    if (f.status && f.status !== 'all' && a.status !== f.status) continue;
    if (f.access && a.access !== f.access) continue;
    if (f.type && a.type !== f.type) continue;
    if (f.topic && a.topic !== f.topic) continue;
    if (f.owner && a.ownerId !== f.owner) continue;
    if (f.department && a.department !== f.department) continue;
    if (f.q) {
      const hay = `${a.title.en} ${a.title.te ?? ''} ${a.title.hi ?? ''} ${a.body.en} ${a.body.te ?? ''} ${a.body.hi ?? ''} ${a.tags.join(' ')}`.toLowerCase();
      if (!f.q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w))) continue;
    }
    out.push({ id: r.id, a, live, updatedAt: r.updatedAt, createdAt: r.createdAt });
  }
  return out.sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));
}

export async function getArticle(v: Viewer, id: string, { logView = true } = {}) {
  const rec = await kbArticles.get(st(), id);
  if (!rec || !canRead(v, rec.data)) return null;
  const editor = v.kind === 'staff' && can(v.user, 'kb.edit');
  const live = await liveView(rec);
  if (!editor && !live) return null;
  if (logView) await audit(v, 'view', 'article', id, rec.data.title.en);
  return { rec, live, shown: editor ? rec.data : live! };
}

export async function deleteArticle(user: Staff, id: string) {
  if (!canApproveKb(user)) throw new KbError('Only approvers can delete articles.');
  const rec = await kbArticles.get(st(), id);
  if (!rec) throw new KbError('Article not found.');
  if (rec.data.status === 'published') throw new KbError('Archive a published article before deleting it.');
  await kbArticles.remove(st(), id);
  await audit(user, 'delete', 'article', id, rec.data.title.en, `status was ${rec.data.status}`);
  await bumpSync(`delete article ${id}`);
}

// ---------------------------------------------------------------- categories

export async function listCategories(centre?: string) {
  return (await kbCategories.list(st(), centre ? { k1: centre } : undefined)).sort((a, b) => a.data.name.en.localeCompare(b.data.name.en));
}

export async function saveCategory(user: Staff, input: { nameEn: string; nameTe?: string | null; nameHi?: string | null; centre: string; parentId?: string | null; icon?: string; reviewerRoles?: string[] }, id?: string) {
  if (!canApproveKb(user)) throw new KbError('Only approvers can manage categories.');
  if (!centreById(input.centre)) throw new KbError('Unknown centre.');
  if (input.parentId && input.parentId === id) throw new KbError('A category can’t be its own parent.');
  const rec = await kbCategories.put(st(), { name: { en: input.nameEn, te: input.nameTe || null, hi: input.nameHi || null }, centre: input.centre, parentId: input.parentId || null, icon: input.icon || '📁', ownerId: user.id, reviewerRoles: input.reviewerRoles ?? [] }, id);
  await audit(user, id ? 'edit' : 'create', 'settings', rec.id, `Category: ${input.nameEn}`);
  return rec;
}

// ---------------------------------------------------------------- audit log

export async function auditLog(user: Staff, f: { targetId?: string; limit?: number; action?: string } = {}) {
  if (!can(user, 'kb.analytics') && !can(user, 'kb.approve')) throw new KbError('Your role can’t read the audit log.');
  const rows = (await kbAudit.list(st(), f.targetId ? { k1: f.targetId } : undefined)).map((r) => r.data);
  return rows.filter((r) => !f.action || r.action === f.action).sort((a, b) => b.at.localeCompare(a.at)).slice(0, f.limit ?? 500);
}

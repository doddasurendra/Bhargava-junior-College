'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import type { Level, Sensitivity } from '@/lib/kb/access';
import { CHANNELS, kbGaps, kbGrievances, deptRequests, licences, NOTIFY_CHANNELS, type Article } from '@/lib/kb/collections';
import { replaceFile, retryExtraction, transitionFile, updateFileMeta, uploadFile } from '@/lib/kb/files';
import { aiFaqs, aiSummarise, dailyBriefing } from '@/lib/kb/intel';
import { saveRule, testRule, type Channel, type Trigger } from '@/lib/kb/notify';
import { commentOn, deleteArticle, KbError, restoreVersion, saveArticle, saveCategory, saveSettings, transitionArticle, type Transition } from '@/lib/kb/service';
import { importFile, importWebPage } from '@/lib/kb/transfer';
import { getRecordStore } from '@/lib/records';
import type { ActionState } from './actions';

const s = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};
const req = (fd: FormData, k: string, label: string) => {
  const v = s(fd, k);
  if (!v) throw new KbError(`${label} is required.`);
  return v;
};
const PATHS = ['/crm/knowledge', '/knowledge-base', '/app/knowledge'];

async function run(fn: () => Promise<string>, paths: string[] = PATHS): Promise<ActionState> {
  try {
    const message = await fn();
    for (const p of paths) revalidatePath(p, 'layout');
    return { ok: true, message };
  } catch (e) {
    if (e instanceof KbError) return { error: e.message };
    if (e instanceof z.ZodError) return { error: e.issues[0] ? `${e.issues[0].path.join('.')}: ${e.issues[0].message}` : 'Check the form.' };
    console.error('[kb] action failed', e);
    return { error: 'Something went wrong. Please try again.' };
  }
}

function articleInput(fd: FormData) {
  return {
    titleEn: req(fd, 'titleEn', 'English title'),
    titleTe: s(fd, 'titleTe'),
    titleHi: s(fd, 'titleHi'),
    bodyEn: req(fd, 'bodyEn', 'English text'),
    bodyTe: s(fd, 'bodyTe'),
    bodyHi: s(fd, 'bodyHi'),
    centre: req(fd, 'centre', 'Centre'),
    topic: s(fd, 'topic'),
    type: (s(fd, 'type') ?? 'article') as Article['type'],
    access: req(fd, 'access', 'Access') as Level,
    sensitivity: req(fd, 'sensitivity', 'Sensitivity') as Sensitivity,
    channels: CHANNELS.filter((c) => fd.get(`ch_${c}`) === 'on'),
    tags: (s(fd, 'tags') ?? '').split(',').map((t) => t.trim()).filter(Boolean),
    categoryId: s(fd, 'categoryId'),
    reviewBy: s(fd, 'reviewBy'),
    department: s(fd, 'department'),
    campus: s(fd, 'campus'),
  };
}

export async function createArticleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff('kb.edit');
  let id: string | null = null;
  const r = await run(async () => {
    id = (await saveArticle(user, articleInput(fd))).id;
    return 'Draft saved.';
  });
  if (id) redirect(`/crm/knowledge/articles/${id}?saved=1`);
  return r;
}

export async function saveArticleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff('kb.edit');
  return run(async () => {
    const r = await saveArticle(user, articleInput(fd), req(fd, 'id', 'Article'), s(fd, 'note'));
    return `Saved as version ${r.data.version}${r.data.liveVersion && r.data.status !== 'published' ? ` (readers still see version ${r.data.liveVersion} until this is approved)` : ''}.`;
  });
}

export async function transitionArticleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff('kb.view');
  return run(async () => {
    const t = req(fd, 't', 'Action') as Transition;
    const a = await transitionArticle(user, req(fd, 'id', 'Article'), t, s(fd, 'reason'));
    return `Now: ${a.status}.`;
  });
}

export async function deleteArticleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff('kb.approve');
  const r = await run(async () => {
    await deleteArticle(user, req(fd, 'id', 'Article'));
    return 'Deleted.';
  });
  if (r.ok) redirect('/crm/knowledge/repository');
  return r;
}

export async function restoreVersionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff('kb.edit');
  return run(async () => {
    const r = await restoreVersion(user, req(fd, 'id', 'Article'), Number(req(fd, 'version', 'Version')));
    return `Restored as version ${r.data.version} (draft: send it for review to publish).`;
  });
}

export async function commentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff('kb.view');
  return run(async () => {
    await commentOn(user, req(fd, 'id', 'Item'), req(fd, 'text', 'Comment'));
    return 'Comment added.';
  });
}

// ---------------------------------------------------------------- documents

function fileMeta(fd: FormData) {
  return {
    titleEn: s(fd, 'titleEn'),
    titleTe: s(fd, 'titleTe'),
    titleHi: s(fd, 'titleHi'),
    centre: req(fd, 'centre', 'Centre'),
    topic: s(fd, 'topic'),
    access: req(fd, 'access', 'Access') as Level,
    sensitivity: req(fd, 'sensitivity', 'Sensitivity') as Sensitivity,
    channels: CHANNELS.filter((c) => fd.get(`ch_${c}`) === 'on'),
    reviewBy: s(fd, 'reviewBy'),
    department: s(fd, 'department'),
  };
}

export async function uploadFilesAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff('kb.edit');
  return run(async () => {
    const files = fd.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) throw new KbError('Choose at least one file.');
    const meta = fileMeta(fd);
    const ok: string[] = [];
    const bad: string[] = [];
    for (const f of files.slice(0, 20)) {
      try {
        const r = await uploadFile(user, f.name, new Uint8Array(await f.arrayBuffer()), { ...meta, titleEn: files.length === 1 ? meta.titleEn : null });
        ok.push(`${f.name} (${r.data.extract.status === 'ok' ? `${r.data.extract.pages} ${r.data.extract.pages === 1 ? 'page' : 'pages'} of text` : r.data.extract.status === 'ocr_needed' ? 'OCR needed' : r.data.extract.status})`);
      } catch (e) {
        bad.push(e instanceof KbError ? e.message : `${f.name}: ${(e as Error).message}`);
      }
    }
    if (!ok.length) throw new KbError(bad.join(' · '));
    return `Uploaded as drafts: ${ok.join(', ')}.${bad.length ? ` Not uploaded: ${bad.join(' · ')}` : ''}`;
  });
}

export async function replaceFileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff('kb.edit');
  return run(async () => {
    const f = fd.get('file');
    if (!(f instanceof File) || !f.size) throw new KbError('Choose the new file.');
    await replaceFile(user, req(fd, 'id', 'Document'), f.name, new Uint8Array(await f.arrayBuffer()), s(fd, 'note'));
    return 'New version uploaded as a draft. Earlier versions are kept.';
  });
}

export async function fileMetaAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff('kb.edit');
  return run(async () => {
    await updateFileMeta(user, req(fd, 'id', 'Document'), fileMeta(fd));
    return 'Details saved.';
  });
}

export async function transitionFileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff('kb.view');
  return run(async () => {
    await transitionFile(user, req(fd, 'id', 'Document'), req(fd, 't', 'Action') as Transition, s(fd, 'reason'));
    return 'Done.';
  });
}

export async function retryExtractionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff('kb.edit');
  return run(async () => {
    await retryExtraction(user, req(fd, 'id', 'Document'));
    return 'Text extracted again.';
  });
}

export async function aiDraftAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff('kb.edit');
  let id: string | null = null;
  const r = await run(async () => {
    const kind = req(fd, 'kind', 'Kind') as 'article' | 'file';
    const what = req(fd, 'what', 'What');
    const rec = what === 'faq' ? await aiFaqs(user, kind, req(fd, 'id', 'Item')) : await aiSummarise(user, kind, req(fd, 'id', 'Item'));
    id = rec.id;
    return 'Draft created. A staff approver must approve it before it is published.';
  });
  if (id) redirect(`/crm/knowledge/articles/${id}?saved=1`);
  return r;
}

// ---------------------------------------------------------------- categories, settings, import

export async function categoryAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff('kb.approve');
  return run(async () => {
    await saveCategory(user, { nameEn: req(fd, 'nameEn', 'Name'), nameTe: s(fd, 'nameTe'), nameHi: s(fd, 'nameHi'), centre: req(fd, 'centre', 'Centre'), parentId: s(fd, 'parentId'), icon: s(fd, 'icon') ?? undefined, reviewerRoles: (s(fd, 'reviewerRoles') ?? '').split(',').map((x) => x.trim()).filter(Boolean) }, s(fd, 'id') ?? undefined);
    return 'Category saved.';
  });
}

export async function subjectHeadsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff('kb.approve');
  return run(async () => {
    await saveSettings(user, { subjectHeads: { maths: s(fd, 'maths'), physics: s(fd, 'physics'), chemistry: s(fd, 'chemistry'), biology: s(fd, 'biology') } });
    return 'Subject heads saved.';
  });
}

export async function governanceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff('kb.admin');
  return run(async () => {
    await saveSettings(user, { retentionYears: Math.min(25, Math.max(1, Number(req(fd, 'retentionYears', 'Retention')))), reviewMonths: Math.min(36, Math.max(1, Number(req(fd, 'reviewMonths', 'Review interval')))) });
    return 'Governance settings saved.';
  });
}

export async function assistantSettingsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff('kb.approve');
  return run(async () => {
    const id = req(fd, 'assistant', 'Assistant');
    const { getSettings } = await import('@/lib/kb/service');
    const cur = (await getSettings()).assistants;
    await saveSettings(user, { assistants: { ...cur, [id]: { prompt: (s(fd, 'prompt') ?? '').slice(0, 2000), suggestions: (s(fd, 'suggestions') ?? '').split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 8) } } });
    return 'Assistant saved.';
  });
}

export async function importAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff('kb.edit');
  return run(async () => {
    const d = { centre: req(fd, 'centre', 'Centre'), access: req(fd, 'access', 'Access') as Level, sensitivity: req(fd, 'sensitivity', 'Sensitivity') as Sensitivity };
    const url = s(fd, 'url');
    if (url) {
      const r = await importWebPage(user, url, d);
      return `Imported “${r.data.title.en}” as a draft article.`;
    }
    const f = fd.get('file');
    if (!(f instanceof File) || !f.size) throw new KbError('Choose a file or give a page link.');
    const r = await importFile(user, f.name, new Uint8Array(await f.arrayBuffer()), d);
    return `Imported ${r.articles} article(s) and ${r.files} file(s) as drafts.${r.errors.length ? ` Problems: ${r.errors.slice(0, 5).join(' · ')}` : ''}`;
  });
}

export async function gapAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff('kb.edit');
  const id = req(fd, 'id', 'Question');
  const what = req(fd, 'what', 'Action');
  const g = await kbGaps.get(getRecordStore(), id);
  if (!g) return { error: 'Question not found.' };
  if (what === 'create') redirect(`/crm/knowledge/articles/new?title=${encodeURIComponent(g.data.q.slice(0, 190))}&gap=${id}`);
  return run(async () => {
    await kbGaps.put(getRecordStore(), { ...g.data, status: what === 'ignore' ? 'ignored' : 'resolved' }, id);
    void user;
    return 'Updated.';
  });
}

// ---------------------------------------------------------------- grievances, departments, licences

export async function grievanceReplyAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff('grievance.handle');
  return run(async () => {
    const st = getRecordStore();
    const g = await kbGrievances.get(st, req(fd, 'id', 'Grievance'));
    if (!g) throw new KbError('Not found.');
    await kbGrievances.put(st, { ...g.data, status: req(fd, 'status', 'Status') as 'open' | 'in_progress' | 'resolved', reply: s(fd, 'reply') ?? g.data.reply, handledBy: user.id, updatedAt: new Date().toISOString() }, g.id);
    return 'Grievance updated.';
  });
}

export async function deptRequestAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff('kb.view');
  return run(async () => {
    const kind = req(fd, 'kind', 'Kind') as 'equipment' | 'purchase' | 'expense';
    await deptRequests.put(getRecordStore(), { department: req(fd, 'department', 'Department'), kind, item: req(fd, 'item', 'Item'), qty: Number(s(fd, 'qty') ?? 1), condition: (s(fd, 'condition') ?? (kind === 'equipment' ? 'good' : 'new_request')) as 'good', amount: Number(s(fd, 'amount') ?? 0), status: kind === 'equipment' ? 'listed' : 'requested', by: user.id, at: new Date().toISOString(), note: s(fd, 'note') });
    return 'Saved.';
  });
}

export async function deptDecideAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff('kb.approve');
  return run(async () => {
    const st = getRecordStore();
    const r = await deptRequests.get(st, req(fd, 'id', 'Request'));
    if (!r) throw new KbError('Not found.');
    await deptRequests.put(st, { ...r.data, status: fd.get('approve') === '1' ? 'approved' : 'rejected', note: `${r.data.note ?? ''} · decided by ${user.fullName}`.trim() }, r.id);
    return 'Decided.';
  });
}

export async function licenceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff('kb.edit');
  if (!can(user, 'kb.approve') && user.roles[0] !== 'admin_office') return { error: 'Only the admin office and approvers can manage licences.' };
  return run(async () => {
    await licences.put(getRecordStore(), { name: req(fd, 'name', 'Name'), campus: req(fd, 'campus', 'Campus'), kind: req(fd, 'kind', 'Kind') as 'fire', number: s(fd, 'number'), validTo: req(fd, 'validTo', 'Valid to'), fileId: s(fd, 'fileId'), sample: false });
    return 'Licence saved. Renewal reminders go out 60 days before expiry.';
  });
}

// ---------------------------------------------------------------- notifications, briefing

export async function ruleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff('notify.manage');
  return run(async () => {
    await saveRule(user, { name: req(fd, 'name', 'Name'), trigger: req(fd, 'trigger', 'Trigger') as Trigger, audience: req(fd, 'audience', 'Audience'), channels: NOTIFY_CHANNELS.filter((c) => fd.get(`n_${c}`) === 'on') as Channel[], templateEn: req(fd, 'templateEn', 'English template'), templateTe: s(fd, 'templateTe'), templateHi: s(fd, 'templateHi'), schedule: req(fd, 'schedule', 'Schedule'), active: fd.get('active') === 'on' }, s(fd, 'id') ?? undefined);
    return 'Rule saved.';
  }, ['/crm/knowledge/notifications']);
}

export async function testRuleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff('notify.manage');
  return run(async () => {
    const r = await testRule(user, req(fd, 'id', 'Rule'));
    return `Test: ${r.sent} sent, ${r.notDelivered} not delivered (channel not configured), ${r.logged} logged only, ${r.held} held for quiet hours, ${r.failed} failed. See the message log.`;
  }, ['/crm/knowledge/notifications']);
}

export async function reindexAction(_: ActionState, fd: FormData): Promise<ActionState> {
  void fd;
  const user = await requireStaff('kb.admin');
  return run(async () => {
    const { buildIndex } = await import('@/lib/kb/index');
    const { clearEmbeddingCache } = await import('@/lib/kb/embed');
    const { bumpSync, audit } = await import('@/lib/kb/service');
    clearEmbeddingCache();
    await bumpSync('manual re-index');
    const idx = await buildIndex(true);
    await audit(user, 'reindex', 'system', null, 'Re-index', `${idx.chunks.length} chunks in ${idx.ms} ms`);
    return `Re-indexed: ${idx.chunks.length} chunks in ${idx.ms} ms.`;
  }, ['/crm/knowledge/supabase']);
}

export async function retryQueueAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff('kb.admin');
  return run(async () => {
    const { kbQueue } = await import('@/lib/kb/collections');
    const st = getRecordStore();
    const q = await kbQueue.get(st, req(fd, 'id', 'Job'));
    if (!q) throw new KbError('Job not found.');
    await retryExtraction(user, q.data.targetId);
    await kbQueue.put(st, { ...q.data, status: 'done', error: `${q.data.error ?? ''} (retried OK)`.trim(), attempts: q.data.attempts + 1, doneAt: new Date().toISOString() }, q.id);
    return 'Retried successfully.';
  }, ['/crm/knowledge/supabase']);
}

export async function briefingAction(_: ActionState, fd: FormData): Promise<ActionState> {
  void fd;
  const user = await requireStaff();
  return run(async () => {
    await dailyBriefing(user);
    return 'Briefing generated.';
  }, ['/crm/knowledge/intelligence']);
}

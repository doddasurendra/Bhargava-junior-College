import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { can } from '../crm/permissions';
import type { Staff } from '../crm/types';
import { getRecordStore } from '../records';
import type { Rec } from '../records/types';
import { canRead, needsWatermark, type Level, type Sensitivity, type Viewer } from './access';
import { centreById } from './centres';
import { CHANNELS, kbFiles, kbFileText, kbQueue } from './collections';
import { detectScripts, extract, MAX_FILE_BYTES, needsOcr, sniff, type FileKind } from './extract';
import { ocr, ocrAvailable } from './ocr';
import { assertLevel, audit, bumpSync, canApproveKb, canEditKb, getSettings, KbError, staffViewer, type Transition } from './service';
import { putKbFile, readKbFile } from './storage';

/**
 * Documents (§2): upload → type check (magic bytes) → safety scan → store privately → extract text (or OCR)
 * → draft. Replacing a file keeps every earlier version. The same approval workflow as articles; a document
 * becomes searchable (and citable by page) the moment it is published.
 */
const st = () => getRecordStore();
const now = () => new Date().toISOString();
type FileData = (typeof kbFiles)['schema']['_output'];
export type FileRec = Rec<FileData>;

export interface FileMeta {
  titleEn?: string | null;
  titleTe?: string | null;
  titleHi?: string | null;
  centre: string;
  topic?: string | null;
  access: Level;
  sensitivity: Sensitivity;
  channels?: (typeof CHANNELS)[number][];
  reviewBy?: string | null;
  department?: string | null;
  campus?: string | null;
  sample?: boolean;
}

async function queue(kind: 'ingest' | 'ocr' | 'index', targetId: string, fn: () => Promise<void>) {
  const t0 = Date.now();
  const q = await kbQueue.put(st(), { kind, targetId, status: 'processing', attempts: 1, error: null, at: now(), doneAt: null, ms: null });
  try {
    await fn();
    await kbQueue.put(st(), { ...q.data, status: 'done', doneAt: now(), ms: Date.now() - t0 }, q.id);
  } catch (e) {
    await kbQueue.put(st(), { ...q.data, status: 'failed', error: (e as Error).message.slice(0, 500), doneAt: now(), ms: Date.now() - t0 }, q.id);
    throw e;
  }
}

/** Extract text for one stored version; OCR when there's no text layer (and OCR is configured). */
async function ingest(fileId: string, version: number, kind: FileKind, mime: string, bytes: Uint8Array) {
  let pages: string[] = [''];
  let label: 'page' | 'sheet' | 'slide' | 'part' = 'page';
  let method = 'none';
  let warnings: string[] = [];
  let error: string | null = null;
  try {
    const x = await extract(kind, bytes);
    ({ pages, method, warnings } = x);
    label = x.pageLabel;
  } catch (e) {
    error = `Text extraction failed: ${(e as Error).message.slice(0, 200)}`;
  }
  let status: 'ok' | 'empty' | 'ocr_needed' | 'failed' = error ? 'failed' : 'ok';
  if (!error && needsOcr(kind, pages)) {
    status = 'ocr_needed';
    if (ocrAvailable()) {
      const r = await ocr(bytes, mime);
      if ('pages' in r) {
        pages = r.pages;
        method = `${method === 'none' ? '' : `${method}+`}ocr-claude`;
        status = pages.join('').trim() ? 'ok' : 'empty';
      } else error = r.error;
    } else error = 'Scanned document or image: OCR needs ANTHROPIC_API_KEY. Not configured, so it is not searchable yet.';
  }
  if (status === 'ok' && !pages.join('').trim()) status = 'empty';
  await kbFileText.put(st(), { fileId, version, pages: pages.map((p) => p.slice(0, 40000)).slice(0, 3000), pageLabel: label }, `${fileId}:${version}`);
  const text = pages.join('\n');
  return { extract: { status, method, pages: pages.length, chars: text.length, langs: detectScripts(text), error }, warnings };
}

function scanNotes(name: string, size: number, warnings: string[]) {
  const notes = [...warnings];
  if (/\.(pdf|docx|xlsx|pptx|csv|txt|md|jpe?g|png|webp|gif)\.[a-z0-9]+$/i.test(name)) notes.push('Double extension in the file name');
  if (size === 0) notes.push('Empty file');
  // Macros, embedded executables and PDF JavaScript/Launch block the upload; the rest are warnings.
  const blocking = notes.some((n) => /macros|executable|JavaScript|Launch|Double extension|Empty file/.test(n));
  return { ok: !blocking, notes };
}

export async function uploadFile(user: Staff, name: string, bytes: Uint8Array, meta: FileMeta): Promise<FileRec> {
  if (!canEditKb(user)) throw new KbError('Your role can’t upload documents.');
  if (bytes.length > MAX_FILE_BYTES) throw new KbError(`${name}: larger than 50 MB.`);
  if (!centreById(meta.centre)) throw new KbError('Unknown centre.');
  const v = await staffViewer(user);
  assertLevel(v, meta.access, meta.sensitivity);
  if (meta.access === 'public' && meta.sensitivity !== 'public') throw new KbError('A public document must have the Public sensitivity label.');
  const type = sniff(name, bytes);
  if ('error' in type) throw new KbError(`${name}: ${type.error}`);
  const sha = createHash('sha256').update(bytes).digest('hex');
  const dup = (await kbFiles.list(st())).find((f) => f.data.sha256 === sha || f.data.history.some((h) => h.sha256 === sha));
  if (dup) throw new KbError(`${name} is already uploaded as “${dup.data.title.en}”. Use “Replace file” there to add a new version.`);
  const id = randomUUID();
  const storageKey = `${id}/v1-${sha.slice(0, 16)}`;
  let rec = null as FileRec | null;
  await queue('ingest', id, async () => {
    const { extract: ex, warnings } = await ingest(id, 1, type.kind, type.mime, bytes);
    const scan = scanNotes(name, bytes.length, warnings);
    if (!scan.ok) throw new KbError(`${name} was blocked by the safety scan: ${scan.notes.join('; ')}.`);
    await putKbFile(storageKey, bytes, type.mime);
    const settings = await getSettings();
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() + settings.reviewMonths);
    rec = await kbFiles.put(st(), {
      title: { en: meta.titleEn?.trim() || name.replace(/\.[^.]+$/, ''), te: meta.titleTe || null, hi: meta.titleHi || null },
      name: name.slice(0, 260),
      mime: type.mime,
      kind: type.kind,
      size: bytes.length,
      sha256: sha,
      storageKey,
      version: 1,
      liveVersion: null,
      history: [{ version: 1, storageKey, sha256: sha, size: bytes.length, mime: type.mime, name: name.slice(0, 260), at: now(), by: user.id, note: 'uploaded' }],
      extract: ex,
      scan,
      channels: meta.channels?.length ? meta.channels : ['staff'],
      centre: meta.centre,
      topic: meta.topic || null,
      access: meta.access,
      sensitivity: meta.sensitivity,
      ownerId: user.id,
      reviewBy: meta.reviewBy || d.toISOString().slice(0, 10),
      status: 'draft',
      sample: meta.sample ?? false,
      department: meta.department ?? null,
      campus: meta.campus ?? null,
      uploadedBy: user.id,
      publishedAt: null,
      approvedBy: null,
      rejectReason: null,
    }, id);
  });
  await audit(user, 'upload', 'file', id, rec!.data.title.en, `${type.kind}, ${bytes.length} bytes, text: ${rec!.data.extract.status}`);
  return rec!;
}

export async function replaceFile(user: Staff, id: string, name: string, bytes: Uint8Array, note: string | null) {
  const rec = await kbFiles.get(st(), id);
  const v = await staffViewer(user);
  if (!rec || !canRead(v, rec.data)) throw new KbError('Document not found.');
  if (!canEditKb(user)) throw new KbError('Your role can’t replace documents.');
  if (rec.data.status === 'archived') throw new KbError('Unarchive the document first.');
  if (bytes.length > MAX_FILE_BYTES) throw new KbError('Larger than 50 MB.');
  const type = sniff(name, bytes);
  if ('error' in type) throw new KbError(type.error);
  const sha = createHash('sha256').update(bytes).digest('hex');
  if (rec.data.history.some((h) => h.sha256 === sha)) throw new KbError('This exact file is already one of the versions.');
  const version = rec.data.version + 1;
  const storageKey = `${id}/v${version}-${sha.slice(0, 16)}`;
  await queue('ingest', id, async () => {
    const { extract: ex, warnings } = await ingest(id, version, type.kind, type.mime, bytes);
    const scan = scanNotes(name, bytes.length, warnings);
    if (!scan.ok) throw new KbError(`Blocked by the safety scan: ${scan.notes.join('; ')}.`);
    await putKbFile(storageKey, bytes, type.mime);
    const wasLive = rec.data.status === 'published' ? rec.data.version : rec.data.liveVersion;
    await kbFiles.put(st(), {
      ...rec.data,
      name: name.slice(0, 260),
      mime: type.mime,
      kind: type.kind,
      size: bytes.length,
      sha256: sha,
      storageKey,
      version,
      liveVersion: wasLive,
      history: [...rec.data.history, { version, storageKey, sha256: sha, size: bytes.length, mime: type.mime, name: name.slice(0, 260), at: now(), by: user.id, note }].slice(-100),
      extract: ex,
      scan,
      // a replaced document goes back through approval; readers keep the live version meanwhile
      status: 'draft',
      approvedBy: null,
    }, id);
  });
  await audit(user, 'replace', 'file', id, rec.data.title.en, `v${version}${note ? `: ${note}` : ''}`);
}

export async function retryExtraction(user: Staff, id: string) {
  const rec = await kbFiles.get(st(), id);
  if (!rec || !canEditKb(user)) throw new KbError('Document not found.');
  const bytes = await readKbFile(rec.data.storageKey);
  if (!bytes) throw new KbError('The stored file is missing.');
  await queue('ocr', id, async () => {
    const { extract: ex } = await ingest(id, rec.data.version, rec.data.kind, rec.data.mime, bytes);
    await kbFiles.put(st(), { ...rec.data, extract: ex }, id);
  });
  await audit(user, 'reextract', 'file', id, rec.data.title.en);
  await bumpSync(`re-extract ${id}`);
}

export async function transitionFile(user: Staff, id: string, t: Transition, reason: string | null = null) {
  const rec = await kbFiles.get(st(), id);
  const v = await staffViewer(user);
  if (!rec || !canRead(v, rec.data)) throw new KbError('Document not found.');
  const f = { ...rec.data };
  const need = (ok: boolean, msg: string) => {
    if (!ok) throw new KbError(msg);
  };
  switch (t) {
    case 'submit':
      need(canEditKb(user) && f.status === 'draft', 'Only drafts can be sent for review.');
      f.status = 'review';
      break;
    case 'reject':
      need(canApproveKb(user) && (f.status === 'review' || f.status === 'approved'), 'Only documents in review can be rejected.');
      need(!!reason?.trim(), 'Give a reason for rejecting.');
      f.status = 'draft';
      f.rejectReason = reason!.trim();
      break;
    case 'approve':
    case 'approve_publish':
    case 'publish':
      need(canApproveKb(user), 'Only approvers can approve documents.');
      if (t === 'publish') need(f.status === 'approved', 'Approve it first.');
      else need(f.status === 'review' || f.status === 'approved', 'Only documents in review can be approved.');
      if (t !== 'publish') need(f.uploadedBy !== user.id || ['super_admin', 'developer'].includes(user.roles[0]), 'Someone else must approve what you uploaded.');
      if (t !== 'publish') {
        f.status = 'approved';
        f.approvedBy = user.id;
      }
      if (t !== 'approve') {
        f.status = 'published';
        f.liveVersion = f.version;
        f.publishedAt = now();
      }
      f.rejectReason = null;
      break;
    case 'archive':
      need(canApproveKb(user) || f.ownerId === user.id, 'Only an approver or the owner can archive.');
      f.status = 'archived';
      break;
    case 'unarchive':
      need(canApproveKb(user) && f.status === 'archived', 'Only an approver can unarchive.');
      f.status = 'draft';
      f.liveVersion = null;
      break;
  }
  await kbFiles.put(st(), f, id);
  await audit(user, t, 'file', id, f.title.en, reason);
  if (['publish', 'approve_publish', 'archive', 'unarchive'].includes(t)) await bumpSync(`${t} file ${id}`);
}

export async function updateFileMeta(user: Staff, id: string, meta: FileMeta) {
  const rec = await kbFiles.get(st(), id);
  const v = await staffViewer(user);
  if (!rec || !canRead(v, rec.data) || !canEditKb(user)) throw new KbError('Document not found.');
  assertLevel(v, meta.access, meta.sensitivity);
  if (meta.access === 'public' && meta.sensitivity !== 'public') throw new KbError('A public document must have the Public sensitivity label.');
  const changedAccess = meta.access !== rec.data.access || meta.sensitivity !== rec.data.sensitivity;
  await kbFiles.put(st(), { ...rec.data, title: { en: meta.titleEn?.trim() || rec.data.title.en, te: meta.titleTe || null, hi: meta.titleHi || null }, centre: meta.centre, topic: meta.topic || null, access: meta.access, sensitivity: meta.sensitivity, channels: meta.channels?.length ? meta.channels : rec.data.channels, reviewBy: meta.reviewBy || rec.data.reviewBy, department: meta.department ?? rec.data.department }, id);
  await audit(user, 'edit', 'file', id, rec.data.title.en, changedAccess ? `access ${rec.data.access}/${rec.data.sensitivity} → ${meta.access}/${meta.sensitivity}` : 'details');
  if (changedAccess && rec.data.status === 'published') await bumpSync(`access change ${id}`);
}

/** A reader's view: published, or the live version while a replacement is in review. */
export function liveFileVersion(f: FileData): number | null {
  if (f.status === 'published') return f.version;
  if (f.status === 'archived') return null;
  return f.liveVersion;
}

export async function listFiles(v: Viewer, f: { centre?: string; status?: string; kind?: string; q?: string } = {}) {
  const editor = v.kind === 'staff' && can(v.user, 'kb.edit');
  return (await kbFiles.list(st(), f.centre ? { k1: f.centre } : undefined))
    .filter((r) => canRead(v, r.data) && (editor || liveFileVersion(r.data) !== null))
    .filter((r) => (!f.status || f.status === 'all' || r.data.status === f.status) && (!f.kind || r.data.kind === f.kind))
    .filter((r) => !f.q || `${r.data.title.en} ${r.data.name}`.toLowerCase().includes(f.q.toLowerCase()))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getFile(v: Viewer, id: string) {
  const rec = await kbFiles.get(st(), id);
  if (!rec || !canRead(v, rec.data)) return null;
  const editor = v.kind === 'staff' && can(v.user, 'kb.edit');
  if (!editor && liveFileVersion(rec.data) === null) return null;
  return rec;
}

export async function fileText(fileId: string, version: number) {
  return (await kbFileText.get(st(), `${fileId}:${version}`))?.data ?? null;
}

/**
 * Bytes for a download, after the access check, with the version a reader may get (editors: any version).
 * Confidential/restricted PDFs are watermarked with the user and date; every download is audited.
 */
export async function downloadFile(v: Viewer, id: string, version?: number) {
  const rec = await getFile(v, id);
  if (!rec) return null;
  const editor = v.kind === 'staff' && can(v.user, 'kb.edit');
  const want = editor ? version ?? rec.data.version : liveFileVersion(rec.data)!;
  const h = rec.data.history.find((x) => x.version === want);
  if (!h) return null;
  let bytes = await readKbFile(h.storageKey);
  if (!bytes) return null;
  let watermarked = false;
  if (needsWatermark(rec.data.sensitivity) && h.mime === 'application/pdf') {
    const who = v.kind === 'staff' ? `${v.user.fullName} (${v.user.roles[0]})` : v.kind;
    bytes = await watermark(bytes, `${rec.data.sensitivity.toUpperCase()} · ${who} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`);
    watermarked = true;
  }
  await audit(v, 'download', 'file', id, rec.data.title.en, `v${want}${watermarked ? ' (watermarked)' : ''}`);
  return { bytes, mime: h.mime, name: h.name, watermarked };
}

export async function watermark(pdf: Uint8Array, text: string) {
  const doc = await PDFDocument.load(pdf, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const p of doc.getPages()) {
    const { width, height } = p.getSize();
    p.drawText(text, { x: 24, y: 14, size: 8, font, color: rgb(0.55, 0.1, 0.1), opacity: 0.8 });
    p.drawText(text, { x: width * 0.12, y: height * 0.35, size: 18, font, color: rgb(0.6, 0.6, 0.6), opacity: 0.18, rotate: degrees(35) });
  }
  return new Uint8Array(await doc.save());
}

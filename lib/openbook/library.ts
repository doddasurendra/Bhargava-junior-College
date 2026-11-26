import 'server-only';
import type { Staff } from '../crm/types';
import { extract, needsOcr, sniff } from '../kb/extract';
import { ocr } from '../kb/ocr';
import { obBookmarks, obBookPages, obBooks, obMastery, obNotes, obReading } from './collections';
import { audit, canManage, canTeach, need, OpenBookError, putFile, readFile, staffActor, store, type Actor } from './core';
import { EXAM_BY_ID } from './taxonomy';

/**
 * Digital library (§3, §17). Books are metadata + (only when the licence allows) a stored file. Copyrighted
 * books show metadata, the Google preview and the purchase/official link — never a copy. Nothing is scraped:
 * Google data comes from the Books API (server side).
 */
export type BookRow = Awaited<ReturnType<typeof listBooks>>['items'][number];
const LICENCES_STORABLE = new Set(['public_domain', 'open_licence', 'free_official', 'institution_owned']);

// ---------------------------------------------------------------- Google Books import

interface GVolume {
  id: string;
  volumeInfo: { title?: string; subtitle?: string; authors?: string[]; publisher?: string; publishedDate?: string; description?: string; industryIdentifiers?: { type: string; identifier: string }[]; imageLinks?: { thumbnail?: string }; previewLink?: string; infoLink?: string; categories?: string[] };
  saleInfo?: { buyLink?: string };
  accessInfo?: { publicDomain?: boolean; viewability?: string; webReaderLink?: string; pdf?: { isAvailable?: boolean; downloadLink?: string }; epub?: { isAvailable?: boolean; downloadLink?: string } };
}

const OFFICIAL_PUBLISHER = /\b(ncert|national council of educational research|telugu akademi|national testing agency|nta)\b/i;

export async function searchGoogleBooks(q: string, max = 20): Promise<GVolume[]> {
  const key = process.env.GOOGLE_BOOKS_API_KEY ? `&key=${encodeURIComponent(process.env.GOOGLE_BOOKS_API_KEY)}` : '';
  const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=${Math.min(40, max)}&printType=books&langRestrict=en${key}`, { headers: { Accept: 'application/json' } });
  if (r.status === 429) throw new OpenBookError('Google Books rate limit reached. Add GOOGLE_BOOKS_API_KEY or try again later.');
  if (!r.ok) throw new OpenBookError(`Google Books returned HTTP ${r.status}.`);
  return ((await r.json()) as { items?: GVolume[] }).items ?? [];
}

/** Imports Google Books results for a category/exam/subject (metadata, cover, preview and purchase links). */
export async function importFromGoogle(u: Staff, input: { query: string; category: string; examIds: string[]; subjects: string[]; cls: '11' | '12' | 'both' | 'na'; max?: number }) {
  need(canManage(u));
  const vols = await searchGoogleBooks(input.query, input.max ?? 20);
  const have = new Set((await obBooks.list(store())).map((b) => b.data.googleId).filter(Boolean));
  let added = 0;
  for (const v of vols) {
    if (have.has(v.id) || !v.volumeInfo.title) continue;
    const vi = v.volumeInfo, ai = v.accessInfo ?? {};
    const isbn = vi.industryIdentifiers?.find((i) => i.type === 'ISBN_13')?.identifier ?? vi.industryIdentifiers?.find((i) => i.type === 'ISBN_10')?.identifier ?? null;
    const publicDomain = !!ai.publicDomain;
    await obBooks.put(store(), {
      title: [vi.title, vi.subtitle].filter(Boolean).join(': ').slice(0, 300), authors: (vi.authors ?? []).slice(0, 12), publisher: vi.publisher ?? null, edition: null, isbn, year: vi.publishedDate?.slice(0, 4) ?? null,
      coverUrl: vi.imageLinks?.thumbnail?.replace(/^http:/, 'https:') ?? null, description: vi.description?.slice(0, 4000) ?? null,
      category: input.category, examIds: input.examIds, subjects: input.subjects, cls: input.cls, chapters: [],
      kind: OFFICIAL_PUBLISHER.test(vi.publisher ?? '') ? 'official' : 'reference',
      licence: publicDomain ? 'public_domain' : 'copyrighted', source: 'google_books', googleId: v.id,
      previewUrl: ai.viewability && ai.viewability !== 'NO_PAGES' ? (ai.webReaderLink ?? vi.previewLink ?? null) : null,
      purchaseUrl: v.saleInfo?.buyLink ?? vi.infoLink ?? null, officialUrl: null,
      // only public-domain books whose PDF/EPUB Google says is available may be downloaded (§2)
      downloadAllowed: publicDomain && !!(ai.pdf?.isAvailable || ai.epub?.isAvailable),
      status: 'approved', uploadedBy: staffActor(u),
    });
    added++;
  }
  await audit(staffActor(u), 'books.google_import', input.category, `${input.query}: ${added} added`);
  return { found: vols.length, added };
}

// ---------------------------------------------------------------- upload (institution-owned / open-licence files)

export async function uploadBook(by: Actor, isManager: boolean, file: { name: string; bytes: Uint8Array }, meta: { title: string; authors: string[]; publisher: string | null; edition: string | null; year: string | null; isbn: string | null; description: string | null; category: string; examIds: string[]; subjects: string[]; cls: '11' | '12' | 'both' | 'na'; chapters: string[]; kind: 'official' | 'reference' | 'institution'; licence: string; officialUrl: string | null; downloadAllowed: boolean }) {
  if (!LICENCES_STORABLE.has(meta.licence)) throw new OpenBookError('Only public-domain, open-licence, free official or institution-owned books can be uploaded. For copyrighted books, add the metadata with a purchase or preview link instead.');
  const s = sniff(file.name, file.bytes);
  if ('error' in s) throw new OpenBookError(s.error);
  if (s.kind !== 'pdf' && s.kind !== 'word') throw new OpenBookError('Upload books as PDF or Word (.docx).');
  const fileKey = await putFile('book', file.bytes, s.mime);
  const book = await obBooks.put(store(), {
    ...meta, coverUrl: null, source: 'upload', googleId: null, previewUrl: null, purchaseUrl: null,
    fileKey, fileName: file.name.slice(0, 200), fileSize: file.bytes.length, pages: 0, textStatus: 'none',
    status: isManager ? 'approved' : 'pending', uploadedBy: by,
  });
  await audit(by, 'book.upload', book.id, `${meta.title} (${meta.licence})`);
  await extractBookText(book.id);
  return book.id;
}

/** Page-by-page text for search, the study assistant and citations; scans go to OCR (needs the AI key). */
export async function extractBookText(bookId: string) {
  const b = await obBooks.get(store(), bookId);
  if (!b?.data.fileKey) return;
  const bytes = await readFile(b.data.fileKey);
  if (!bytes) return;
  const s = sniff(b.data.fileName ?? 'book.pdf', bytes);
  if ('error' in s) return;
  let pages: string[] = [];
  let textStatus: 'extracted' | 'ocr_needed' | 'failed' = 'extracted';
  try {
    pages = (await extract(s.kind, bytes)).pages;
    if (needsOcr(s.kind, pages)) {
      const o = await ocr(bytes, s.mime);
      if ('pages' in o) pages = o.pages;
      else textStatus = 'ocr_needed';
    }
  } catch {
    textStatus = 'failed';
  }
  for (const old of await obBookPages.list(store(), { k1: bookId })) await obBookPages.remove(store(), old.id);
  if (textStatus === 'extracted') for (let i = 0; i < pages.length; i++) await obBookPages.put(store(), { bookId, page: i + 1, text: pages[i].slice(0, 40_000) });
  await obBooks.put(store(), { ...b.data, pages: pages.length || b.data.pages, textStatus }, b.id);
}

export async function reviewBook(u: Staff, id: string, approve: boolean, note: string | null) {
  need(canManage(u));
  const b = await obBooks.get(store(), id);
  need(b, 'Book not found.');
  await obBooks.put(store(), { ...b!.data, status: approve ? 'approved' : 'rejected', reviewNote: note }, id);
  await audit(staffActor(u), approve ? 'book.approve' : 'book.reject', id, note);
}

export async function editBook(u: Staff, id: string, patch: Record<string, unknown>) {
  need(canManage(u));
  const b = await obBooks.get(store(), id);
  need(b, 'Book not found.');
  await obBooks.put(store(), { ...b!.data, ...patch }, id);
  await audit(staffActor(u), 'book.edit', id);
}

/** Removes unauthorised or invalid content (the stored file stays in storage for the audit trail). */
export async function removeBook(u: Staff, id: string, reason: string) {
  need(canManage(u));
  const b = await obBooks.get(store(), id);
  need(b, 'Book not found.');
  await obBooks.put(store(), { ...b!.data, status: 'rejected', reviewNote: `Removed: ${reason}`, downloadAllowed: false }, id);
  await audit(staffActor(u), 'book.remove', id, reason);
}

// ---------------------------------------------------------------- search & browse

export interface BookFilter { q?: string; category?: string; examId?: string; subject?: string; cls?: string; kind?: string; page?: number; size?: number; status?: 'approved' | 'pending' | 'all' }

export async function listBooks(f: BookFilter = {}) {
  const all = (await obBooks.list(store())).map((r) => ({ id: r.id, createdAt: r.createdAt, ...r.data }));
  const words = (f.q ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const items = all
    .filter((b) => (f.status ?? 'approved') === 'all' || b.status === (f.status ?? 'approved'))
    .filter((b) => !f.category || b.category === f.category)
    .filter((b) => !f.examId || b.examIds.includes(f.examId))
    .filter((b) => !f.subject || b.subjects.includes(f.subject))
    .filter((b) => !f.cls || b.cls === f.cls || b.cls === 'both')
    .filter((b) => !f.kind || b.kind === f.kind)
    .filter((b) => {
      if (!words.length) return true;
      const hay = [b.title, b.authors.join(' '), b.publisher ?? '', b.subjects.join(' '), b.chapters.join(' '), b.isbn ?? '', ...b.examIds.map((e) => EXAM_BY_ID.get(e)?.name ?? e)].join(' ').toLowerCase();
      return words.every((w) => hay.includes(w));
    })
    .sort((a, b) => (a.kind === 'official' ? 0 : 1) - (b.kind === 'official' ? 0 : 1) || b.createdAt.localeCompare(a.createdAt));
  const size = Math.min(60, f.size ?? 24), page = Math.max(1, f.page ?? 1);
  return { total: items.length, page, pages: Math.max(1, Math.ceil(items.length / size)), items: items.slice((page - 1) * size, page * size) };
}

export async function getBook(id: string) {
  const b = await obBooks.get(store(), id);
  return b ? { id: b.id, createdAt: b.createdAt, ...b.data } : null;
}

/** Full-text search inside a book's extracted pages (reader search, assistant retrieval). */
export async function searchInBook(bookId: string, q: string, limit = 30) {
  const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  if (!words.length) return [];
  const pages = await obBookPages.list(store(), { k1: bookId });
  return pages
    .map((p) => {
      const t = p.data.text.toLowerCase();
      const score = words.reduce((n, w) => n + (t.split(w).length - 1), 0);
      const i = t.indexOf(words[0]);
      return { page: p.data.page, score, snippet: i >= 0 ? p.data.text.slice(Math.max(0, i - 80), i + 160).replace(/\s+/g, ' ') : '' };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.page - b.page)
    .slice(0, limit);
}

export async function pageText(bookId: string, page: number) {
  return (await obBookPages.list(store(), { k1: bookId, k2: String(page).padStart(5, '0') }))[0]?.data.text ?? '';
}

// ---------------------------------------------------------------- the student's own reading data (private)

async function readingRow(studentId: string, bookId: string) {
  return (await obReading.list(store(), { k1: studentId, k2: bookId }))[0] ?? null;
}

export async function openBook(studentId: string, bookId: string) {
  const r = await readingRow(studentId, bookId);
  const now = new Date().toISOString();
  await obReading.put(store(), r ? { ...r.data, lastOpened: now } : { studentId, bookId, lastPage: 1, pagesRead: [], seconds: 0, favourite: false, lastOpened: now }, r?.id);
  return r?.data.lastPage ?? 1;
}

/** Called by the reader every ~20 s and on page change: resume position, pages read, time spent. */
export async function saveProgress(studentId: string, bookId: string, page: number, seconds: number) {
  const r = await readingRow(studentId, bookId);
  const base = r?.data ?? { studentId, bookId, lastPage: 1, pagesRead: [], seconds: 0, favourite: false, lastOpened: new Date().toISOString() };
  const pagesRead = base.pagesRead.includes(page) ? base.pagesRead : [...base.pagesRead, page].slice(-5000);
  await obReading.put(store(), { ...base, lastPage: Math.max(1, page), pagesRead, seconds: base.seconds + Math.max(0, Math.min(600, Math.round(seconds))), lastOpened: new Date().toISOString() }, r?.id);
}

export async function toggleFavourite(studentId: string, bookId: string) {
  const r = await readingRow(studentId, bookId);
  const base = r?.data ?? { studentId, bookId, lastPage: 1, pagesRead: [], seconds: 0, favourite: false, lastOpened: new Date().toISOString() };
  await obReading.put(store(), { ...base, favourite: !base.favourite }, r?.id);
  return !base.favourite;
}

export async function readingHistory(studentId: string) {
  const rows = await obReading.list(store(), { k1: studentId });
  const books = new Map((await Promise.all(rows.map((r) => getBook(r.data.bookId)))).filter(Boolean).map((b) => [b!.id, b!]));
  return rows.map((r) => ({ ...r.data, id: r.id, book: books.get(r.data.bookId) ?? null })).filter((r) => r.book).sort((a, b) => b.lastOpened.localeCompare(a.lastOpened));
}

export async function addBookmark(studentId: string, bookId: string, page: number, label: string | null) {
  const have = (await obBookmarks.list(store(), { k1: studentId, k2: bookId })).find((b) => b.data.page === page);
  if (have) return have.id;
  return (await obBookmarks.put(store(), { studentId, bookId, page, label })).id;
}
export async function removeBookmark(studentId: string, id: string) {
  const b = await obBookmarks.get(store(), id);
  need(b && b.data.studentId === studentId, 'Bookmark not found.');
  await obBookmarks.remove(store(), id);
}
export async function bookmarksOf(studentId: string, bookId?: string) {
  return (await obBookmarks.list(store(), bookId ? { k1: studentId, k2: bookId } : { k1: studentId })).map((b) => ({ id: b.id, createdAt: b.createdAt, ...b.data }));
}

export async function addNote(studentId: string, input: { bookId: string; page: number; text: string; color: 'yellow' | 'green' | 'blue' | 'pink' | null; note: string | null; revision?: boolean }) {
  need(input.text.trim() || input.note?.trim(), 'Select some text or write a note.');
  return (await obNotes.put(store(), { studentId, ...input, revision: input.revision ?? false })).id;
}
export async function updateNote(studentId: string, id: string, patch: { note?: string | null; color?: 'yellow' | 'green' | 'blue' | 'pink' | null; revision?: boolean }) {
  const n = await obNotes.get(store(), id);
  need(n && n.data.studentId === studentId, 'Note not found.');
  await obNotes.put(store(), { ...n!.data, ...patch }, id);
}
export async function removeNote(studentId: string, id: string) {
  const n = await obNotes.get(store(), id);
  need(n && n.data.studentId === studentId, 'Note not found.');
  await obNotes.remove(store(), id);
}
export async function notesOf(studentId: string, bookId?: string) {
  return (await obNotes.list(store(), bookId ? { k1: studentId, k2: bookId } : { k1: studentId })).map((n) => ({ id: n.id, createdAt: n.createdAt, ...n.data })).sort((a, b) => a.bookId.localeCompare(b.bookId) || a.page - b.page);
}

/** Markdown export of a student's highlights and notes (the print view gives the PDF). */
export async function notesMarkdown(studentId: string, bookId?: string) {
  const notes = await notesOf(studentId, bookId);
  const titles = new Map<string, string>();
  for (const id of new Set(notes.map((n) => n.bookId))) titles.set(id, (await getBook(id))?.title ?? 'Book');
  let md = '# My Open Book notes\n';
  let cur = '';
  for (const n of notes) {
    if (n.bookId !== cur) { cur = n.bookId; md += `\n## ${titles.get(cur)}\n`; }
    md += `\n- **p. ${n.page}**${n.color ? ` (${n.color})` : ''}${n.text ? `: "${n.text.replace(/\s+/g, ' ')}"` : ''}${n.note ? `\n  - ${n.note.replace(/\n/g, '\n    ')}` : ''}`;
  }
  return md + '\n';
}

// ---------------------------------------------------------------- recommendations

/** Books matching the student's exam, weak chapters and what they read recently, with the reason shown. */
export async function recommendations(studentId: string, examIds: string[], limit = 8) {
  const [{ items }, mastery, history] = await Promise.all([listBooks({ size: 60 }), obMastery.list(store(), { k1: studentId }), readingHistory(studentId)]);
  const weak = mastery.filter((m) => m.data.attempts >= 3 && m.data.score < 60).map((m) => m.data);
  const readIds = new Set(history.map((h) => h.bookId));
  const readSubjects = new Set(history.flatMap((h) => h.book?.subjects ?? []));
  return items
    .filter((b) => !readIds.has(b.id))
    .map((b) => {
      let score = 0;
      let reason = '';
      const weakHit = weak.find((w) => b.subjects.includes(w.subject) && (b.chapters.length === 0 || b.chapters.includes(w.chapter)));
      if (weakHit) { score += 3; reason = `You scored ${Math.round(weakHit.score)}% in ${weakHit.chapter}`; }
      if (b.examIds.some((e) => examIds.includes(e))) { score += 2; reason ||= `For your ${EXAM_BY_ID.get(b.examIds.find((e) => examIds.includes(e))!)?.name ?? ''} preparation`; }
      if (b.subjects.some((s) => readSubjects.has(s))) { score += 1; reason ||= 'Similar to books you read'; }
      if (b.kind === 'official') score += 0.5;
      return { book: b, score, reason: reason || 'Recently added' };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export const canUploadBooks = (u: Staff) => canTeach(u);
export const isManager = (u: Staff) => canManage(u);

// ---------------------------------------------------------------- official catalogue (link-only)

const NCERT = 'https://ncert.nic.in/textbook.php';
const NCERT_BOOKS: [title: string, subject: string, cls: '11' | '12'][] = [
  ['Physics Part I – Textbook for Class XI', 'Physics', '11'], ['Physics Part II – Textbook for Class XI', 'Physics', '11'],
  ['Chemistry Part I – Textbook for Class XI', 'Chemistry', '11'], ['Chemistry Part II – Textbook for Class XI', 'Chemistry', '11'],
  ['Mathematics – Textbook for Class XI', 'Mathematics', '11'], ['Biology – Textbook for Class XI', 'Biology', '11'],
  ['Physics Part I – Textbook for Class XII', 'Physics', '12'], ['Physics Part II – Textbook for Class XII', 'Physics', '12'],
  ['Chemistry Part I – Textbook for Class XII', 'Chemistry', '12'], ['Chemistry Part II – Textbook for Class XII', 'Chemistry', '12'],
  ['Mathematics Part I – Textbook for Class XII', 'Mathematics', '12'], ['Mathematics Part II – Textbook for Class XII', 'Mathematics', '12'],
  ['Biology – Textbook for Class XII', 'Biology', '12'],
];
const OPENSTAX: [title: string, subject: string, slugPath: string, exams: string[]][] = [
  ['College Physics 2e', 'Physics', 'college-physics-2e', ['jee-main', 'neet-ug', 'inter1-mpc', 'inter2-mpc']],
  ['Chemistry 2e', 'Chemistry', 'chemistry-2e', ['jee-main', 'neet-ug', 'inter1-mpc', 'inter2-mpc']],
  ['Biology 2e', 'Biology', 'biology-2e', ['neet-ug', 'inter1-bipc', 'inter2-bipc']],
  ['Calculus Volume 1', 'Mathematics', 'calculus-volume-1', ['jee-main', 'jee-advanced', 'inter2-mpc']],
  ['Calculus Volume 2', 'Mathematics', 'calculus-volume-2', ['jee-advanced', 'inter2-mpc']],
  ['Precalculus 2e', 'Mathematics', 'precalculus-2e', ['jee-main', 'inter1-mpc']],
];

/**
 * Adds the official NCERT Class 11/12 science and mathematics textbooks and free OpenStax textbooks (CC BY 4.0)
 * as link-only catalogue entries: students see the book and open it on the official site; nothing is
 * re-hosted. Idempotent (matched by title + publisher).
 */
export async function seedCatalogue(u: Staff | null) {
  if (u) need(canManage(u));
  const { chapters } = await import('./core');
  const chs = await chapters();
  const have = new Set((await obBooks.list(store())).map((b) => `${b.data.title}|${b.data.publisher}`));
  const by = { kind: 'system' as const, id: 'catalogue', name: 'Official catalogue' };
  let added = 0;
  for (const [title, subject, cls] of NCERT_BOOKS) {
    if (have.has(`${title}|NCERT`)) continue;
    const exams = subject === 'Biology' ? ['neet-ug', cls === '11' ? 'inter1-bipc' : 'inter2-bipc', 'eapcet-am', 'aiims'] : subject === 'Mathematics' ? ['jee-main', 'jee-advanced', cls === '11' ? 'inter1-mpc' : 'inter2-mpc', 'eapcet-e', 'upsc'] : ['jee-main', 'jee-advanced', 'neet-ug', cls === '11' ? 'inter1-mpc' : 'inter2-mpc', cls === '11' ? 'inter1-bipc' : 'inter2-bipc', 'eapcet-e', 'eapcet-am'];
    await obBooks.put(store(), {
      title, authors: ['NCERT'], publisher: 'NCERT', edition: 'Current rationalised edition', isbn: null, year: null, coverUrl: null,
      description: `Official NCERT textbook, the core book for TS Intermediate ${cls === '11' ? '1st' : '2nd'} year, JEE and NEET. Free on the NCERT website (choose Class ${cls === '11' ? 'XI' : 'XII'} › ${subject}); linked, not re-hosted.`,
      category: 'intermediate', examIds: exams, subjects: [subject], cls, chapters: chs.filter((c) => c.subject === subject && c.cls === cls).map((c) => c.name).slice(0, 60),
      kind: 'official', licence: 'free_official', source: 'official', googleId: null, previewUrl: null, purchaseUrl: null, officialUrl: NCERT,
      fileKey: null, downloadAllowed: false, status: 'approved', uploadedBy: by,
    });
    added++;
  }
  for (const [title, subject, path, exams] of OPENSTAX) {
    if (have.has(`${title}|OpenStax (Rice University)`)) continue;
    await obBooks.put(store(), {
      title, authors: ['OpenStax'], publisher: 'OpenStax (Rice University)', edition: null, isbn: null, year: null, coverUrl: null,
      description: 'Free, peer-reviewed open textbook (CC BY 4.0). Useful as a reference alongside NCERT; read it free on the OpenStax website.',
      category: subject === 'Biology' ? 'medical' : 'engineering', examIds: exams, subjects: [subject], cls: 'both', chapters: [],
      kind: 'reference', licence: 'open_licence', source: 'official', googleId: null, previewUrl: `https://openstax.org/details/books/${path}`, purchaseUrl: null, officialUrl: `https://openstax.org/details/books/${path}`,
      fileKey: null, downloadAllowed: false, status: 'approved', uploadedBy: by,
    });
    added++;
  }
  return added;
}

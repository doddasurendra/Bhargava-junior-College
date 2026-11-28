import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { allowedLevels, canRead, maskPhones, type Viewer } from './access';
import { extractCsv, extractDocx, extractPptx, extractXlsx, needsOcr, sniff, unzip } from './extract';
import { bm25, chunkText, diffLines, normQuestion, prepare, similarity, tokens } from './text';
import { zip } from './zip';

vi.mock('server-only', () => ({}));

const enc = (s: string) => new TextEncoder().encode(s);
const staff = (id: string, role: string) => ({ id, fullName: id, email: null, phone: null, roles: [role] as never, active: true });
const sv = (id: string, role: string, heads: string[] = []): Viewer => ({ kind: 'staff', user: staff(id, role), subjectHeadOf: heads });

describe('access levels and sensitivity', () => {
  const student: Viewer = { kind: 'student', studentId: 's1' };
  const parent: Viewer = { kind: 'parent', studentIds: ['s1'], phone: '+919000000001' };
  const pub: Viewer = { kind: 'public' };
  it('families read only their levels', () => {
    expect(canRead(student, { access: 'student', sensitivity: 'internal' })).toBe(true);
    expect(canRead(student, { access: 'parent', sensitivity: 'internal' })).toBe(false);
    expect(canRead(parent, { access: 'student', sensitivity: 'internal' })).toBe(false);
    expect(canRead(student, { access: 'faculty', sensitivity: 'internal' })).toBe(false);
    expect(canRead(pub, { access: 'public', sensitivity: 'public' })).toBe(true);
    expect(canRead(pub, { access: 'public', sensitivity: 'internal' })).toBe(false);
  });
  it('confidential never reaches families; restricted only leaders or the owner', () => {
    expect(canRead(student, { access: 'student', sensitivity: 'confidential' })).toBe(false);
    expect(canRead(sv('f1', 'faculty'), { access: 'faculty', sensitivity: 'confidential' })).toBe(true);
    expect(canRead(sv('f1', 'faculty'), { access: 'faculty', sensitivity: 'restricted' })).toBe(false);
    expect(canRead(sv('f1', 'faculty'), { access: 'faculty', sensitivity: 'restricted', ownerId: 'f1' })).toBe(true);
    expect(canRead(sv('p1', 'principal'), { access: 'principal', sensitivity: 'restricted' })).toBe(true);
  });
  it('roles map to levels; subject heads get the subject_head level; only the active role counts', () => {
    expect(allowedLevels(sv('t', 'telecaller'))).toContain('admissions');
    expect(allowedLevels(sv('t', 'telecaller'))).not.toContain('faculty');
    expect(allowedLevels(sv('a', 'accounts'))).toContain('accounts');
    expect(allowedLevels(sv('f', 'faculty'))).not.toContain('subject_head');
    expect(allowedLevels(sv('f', 'faculty', ['physics']))).toContain('subject_head');
    expect(allowedLevels(sv('m', 'management'))).toHaveLength(10);
  });
  it('masks phone numbers', () => {
    expect(maskPhones('Call 9876543210 or +91 9123456789')).toBe('Call 98XXXX3210 or +91 91XXXX6789');
  });
});

describe('text: tokens, BM25, chunks, diff, duplicates', () => {
  it('tokenises Telugu and Hindi, not just English', () => {
    expect(tokens('హాజరు నియమాలు')).toEqual(['హాజరు', 'నియమాలు']);
    expect(tokens('फीस कितनी है')).toContain('फीस');
    expect(tokens('The fees are due')).toEqual(['fee', 'due']);
  });
  it('ranks and filters before scoring', () => {
    const p = prepare([{ id: 'a', title: 'Hostel rules', text: 'hostel timings and mess' }, { id: 'b', title: 'Fees', text: 'tuition fees instalments' }]);
    expect(bm25(p, 'hostel mess', () => true)[0].i).toBe(0);
    expect(bm25(p, 'hostel mess', (i) => i !== 0)).toHaveLength(0);
  });
  it('chunks keep the nearest heading', () => {
    const c = chunkText('## Fire\nRaise the alarm.\n## Medical\nCall the doctor.');
    expect(c.map((x) => x.section)).toEqual(['Fire', 'Medical']);
  });
  it('diffs lines and detects near-duplicates', () => {
    expect(diffLines('a\nb\nc', 'a\nc\nd').map((d) => d.op).join('')).toBe('=-=+');
    expect(similarity('students must keep attendance above seventy five percent always', 'students must keep attendance above seventy five percent always please')).toBeGreaterThan(0.6);
    expect(normQuestion('Is there a bus from Ibrahimpatnam?')).toBe(normQuestion('ibrahimpatnam bus there?'));
  });
});

describe('file checks and extraction', () => {
  const x = (s: string) => enc(`<?xml version="1.0"?>${s}`);
  it('reads Word, PowerPoint and Excel (they are ZIPs of XML)', () => {
    const docx = zip([{ name: 'word/document.xml', data: x('<w:document><w:body><w:p><w:r><w:t>Hostel rules</w:t></w:r></w:p><w:p><w:r><w:lastRenderedPageBreak/><w:t>Page two &amp; more</w:t></w:r></w:p></w:body></w:document>') }]);
    const d = extractDocx(docx);
    expect(d.pageLabel).toBe('page');
    expect(d.pages[0]).toContain('Hostel rules');
    expect(d.pages[1]).toContain('Page two & more');
    const pptx = zip([{ name: 'ppt/slides/slide2.xml', data: x('<p:sld><a:p><a:t>Second</a:t></a:p></p:sld>') }, { name: 'ppt/slides/slide1.xml', data: x('<p:sld><a:p><a:t>First</a:t></a:p></p:sld>') }]);
    expect(extractPptx(pptx).pages).toEqual(['First', 'Second']);
    const xlsx = zip([
      { name: 'xl/sharedStrings.xml', data: x('<sst><si><t>Item</t></si><si><t>Burette</t></si></sst>') },
      { name: 'xl/workbook.xml', data: x('<workbook><sheets><sheet name="Lab" sheetId="1"/></sheets></workbook>') },
      { name: 'xl/worksheets/sheet1.xml', data: x('<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>12</v></c></row><row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2"><v>20</v></c></row></sheetData></worksheet>') },
    ]);
    expect(extractXlsx(xlsx).pages[0]).toBe('Sheet: Lab\nItem\t12\nBurette\t20');
    expect(extractCsv(enc('a,b\n"x, y",2'), 'csv').pages[0]).toBe('a\tb\nx, y\t2');
    expect(unzip(docx).has('word/document.xml')).toBe(true);
  });
  it('checks the bytes, not just the name', () => {
    expect(sniff('notes.pdf', enc('MZ fake exe'))).toHaveProperty('error');
    expect(sniff('macro.docm', enc('PK'))).toHaveProperty('error');
    expect(sniff('old.doc', enc('xx'))).toHaveProperty('error');
    expect(sniff('a.csv', enc('a,b'))).toEqual({ kind: 'csv', mime: 'text/csv' });
    expect(sniff('a.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0]))).toEqual({ kind: 'image', mime: 'image/png' });
  });
  it('marks scans and images for OCR', () => {
    expect(needsOcr('image', [''])).toBe(true);
    expect(needsOcr('pdf', ['', ' '])).toBe(true);
    expect(needsOcr('pdf', ['This page has plenty of real extracted text for search.'])).toBe(false);
  });
});

describe('Knowledge Hub workflow, search, AI and files (local store)', { timeout: 60_000 }, () => {
  let dir: string;
  let cwd: string;
  beforeAll(() => {
    cwd = process.cwd();
    dir = mkdtempSync(path.join(tmpdir(), 'bjc-kb-'));
    process.chdir(dir);
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.ANTHROPIC_API_KEY; delete process.env.OPENROUTER_API_KEY;
    delete process.env.VOYAGE_API_KEY;
  });
  afterAll(() => {
    process.chdir(cwd);
    rmSync(dir, { recursive: true, force: true });
  });
  const faculty = staff('st-fac', 'faculty');
  const principal = staff('st-pri', 'principal');
  const student: Viewer = { kind: 'student', studentId: 'stu-1' };
  const parent: Viewer = { kind: 'parent', studentIds: ['stu-1'], phone: '+919000000009' };

  it('Draft → review → (four-eyes) → published; edits keep the live version until re-approved', async () => {
    const s = await import('./service');
    const rec = await s.saveArticle(faculty, { titleEn: 'Mess timings', bodyEn: '## Breakfast\nBreakfast is served from 7:00 to 7:45 in the hostel mess.', bodyTe: 'అల్పాహారం ఉదయం 7:00 నుండి 7:45 వరకు హాస్టల్ మెస్‌లో.', centre: 'student', topic: 'welfare', access: 'student', sensitivity: 'internal', channels: ['app', 'staff'] });
    expect(rec.data.status).toBe('draft');
    expect(await s.getArticle(student, rec.id)).toBeNull(); // drafts are invisible to readers
    await s.transitionArticle(faculty, rec.id, 'submit');
    await expect(s.transitionArticle(faculty, rec.id, 'approve')).rejects.toThrow(/reviewer|approve/i);
    await s.transitionArticle(principal, rec.id, 'approve_publish');
    expect((await s.getArticle(student, rec.id))?.shown.version).toBe(1);
    await s.saveArticle(faculty, { titleEn: 'Mess timings', bodyEn: 'Breakfast now 7:15 to 8:00.', centre: 'student', topic: 'welfare', access: 'student', sensitivity: 'internal', channels: ['app', 'staff'] }, rec.id);
    const reader = await s.getArticle(student, rec.id);
    expect(reader?.shown.body.en).toContain('7:00 to 7:45'); // still v1 for readers
    expect((await s.diffVersions(rec.id, 1, 2)).some((d) => d.op === '+' && d.line.includes('7:15'))).toBe(true);
    await s.restoreVersion(faculty, rec.id, 1);
    expect((await s.versionsOf(rec.id)).map((v) => v.version)).toEqual([3, 2, 1]);
    expect((await s.auditLog(principal, { targetId: rec.id })).map((a) => a.action)).toEqual(expect.arrayContaining(['create', 'submit', 'approve_publish', 'edit', 'restore']));
  });

  it('search finds Telugu text and Hindi questions; restricted text never reaches a student or the AI', async () => {
    const s = await import('./service');
    const { search } = await import('./index');
    const { answer } = await import('./ai');
    const secret = await s.saveArticle(principal, { titleEn: 'Salary revision 2027', bodyEn: 'The confidential salary revision gives every lecturer an increment from June.', centre: 'principal', access: 'principal', sensitivity: 'restricted', channels: ['staff'] });
    await s.transitionArticle(principal, secret.id, 'submit');
    await s.transitionArticle(staff('st-sa', 'super_admin'), secret.id, 'approve_publish');
    const fees = await s.saveArticle(faculty, { titleEn: 'Hostel fee instalments', bodyEn: 'Hostel fees can be paid in three instalments.', centre: 'parent', access: 'public', sensitivity: 'public', channels: ['website', 'bot', 'app', 'staff'] });
    await s.transitionArticle(faculty, fees.id, 'submit');
    await s.transitionArticle(principal, fees.id, 'approve_publish');

    expect((await search(student, 'అల్పాహారం')).some((h) => h.title === 'Mess timings')).toBe(true);
    expect((await search(parent, 'हॉस्टल फीस')).some((h) => h.title === 'Hostel fee instalments')).toBe(true);
    expect((await search(student, 'salary revision increment')).some((h) => h.sourceId === secret.id)).toBe(false);
    expect((await search(await s.staffViewer(principal), 'salary revision increment')).some((h) => h.sourceId === secret.id)).toBe(true);
    // parents can't read student-level articles
    expect((await search(parent, 'breakfast mess')).some((h) => h.title === 'Mess timings')).toBe(false);

    const a = await answer(student, 'student', 'What is the salary revision increment for lecturers?');
    // it may quote public website text, but never the restricted article
    expect(a.text).not.toMatch(/increment from June/);
    expect(a.sources.some((x) => x.title.includes('Salary revision'))).toBe(false);
    const none = await answer(student, 'student', 'What is the zorblax quantum policy?');
    expect(none.found).toBe(false);
    const gaps = await (await import('./collections')).kbGaps.list((await import('../records')).getRecordStore());
    expect(gaps.length).toBeGreaterThan(0);

    const ok = await answer(parent, 'parent', 'Can hostel fees be paid in instalments?');
    expect(ok.found).toBe(true);
    expect(ok.sources[0]?.title).toBe('Hostel fee instalments');
    expect(ok.basedOn).toMatch(/allowed to see/);
  });

  it('documents: type check, duplicate refusal, page citations, version history, access on download, watermark', async () => {
    const f = await import('./files');
    const s = await import('./service');
    const { search } = await import('./index');
    const { answer } = await import('./ai');
    const pdf = await PDFDocument.create();
    pdf.addPage().drawText('Page one: library opens at 8 AM.');
    pdf.addPage().drawText('Page two: Library fines are two rupees per day after the due date.');
    const bytes = new Uint8Array(await pdf.save());
    const up = await f.uploadFile(faculty, 'library-rules.pdf', bytes, { centre: 'library', access: 'student', sensitivity: 'internal', channels: ['app', 'staff'] });
    expect(up.data.extract.status).toBe('ok');
    expect(up.data.extract.pages).toBe(2);
    await expect(f.uploadFile(faculty, 'copy.pdf', bytes, { centre: 'library', access: 'student', sensitivity: 'internal' })).rejects.toThrow(/already uploaded/);
    await expect(f.uploadFile(faculty, 'fake.pdf', enc('MZ not a pdf'), { centre: 'library', access: 'student', sensitivity: 'internal' })).rejects.toThrow(/doesn’t match/);
    expect(await f.getFile(student, up.id)).toBeNull(); // draft
    await f.transitionFile(faculty, up.id, 'submit');
    await f.transitionFile(principal, up.id, 'approve_publish');
    const hit = (await search(student, 'library fines per day')).find((h) => h.sourceId === up.id);
    expect(hit?.page).toBe(2);
    const ans = await answer(student, 'library', 'How much are library fines per day?');
    expect(ans.sources.some((x) => x.page === 2)).toBe(true);

    await f.replaceFile(faculty, up.id, 'library-rules-v2.pdf', new Uint8Array(await (async () => { const d = await PDFDocument.create(); d.addPage().drawText('Fines are five rupees per day.'); return d.save(); })()), 'new fine');
    const after = await f.getFile(await s.staffViewer(faculty), up.id);
    expect(after?.data.history.map((h) => h.version)).toEqual([1, 2]);
    expect(f.liveFileVersion(after!.data)).toBe(1); // readers keep v1 until v2 is approved
    const dl = await f.downloadFile(student, up.id);
    expect(dl?.name).toBe('library-rules.pdf');

    const conf = await f.uploadFile(principal, 'inspection.pdf', bytes.slice(), { centre: 'compliance', access: 'principal', sensitivity: 'confidential' }).catch(async () => {
      const d = await PDFDocument.create();
      d.addPage().drawText('Board inspection notes');
      return f.uploadFile(principal, 'inspection.pdf', new Uint8Array(await d.save()), { centre: 'compliance', access: 'principal', sensitivity: 'confidential' });
    });
    expect(await f.downloadFile(student, conf.id)).toBeNull();
    expect((await f.downloadFile(await s.staffViewer(principal), conf.id))?.watermarked).toBe(true);
  });

  it('notifications respect quiet hours and log honestly', async () => {
    const { dispatch, messageLog } = await import('./notify');
    const late = new Date('2026-11-21T17:30:00Z'); // 11 PM IST
    const r = await dispatch({ ruleId: null, trigger: 'announcement', channels: ['sms', 'email'], template: { en: 'Hello {name}' }, recipients: [{ name: 'A', phone: '+919000000001', email: 'a@example.com' }] }, late);
    expect(r.held).toBe(2);
    const day = new Date('2026-11-21T06:30:00Z'); // noon IST
    const r2 = await dispatch({ ruleId: null, trigger: 'announcement', channels: ['sms'], template: { en: 'Hello' }, recipients: [{ name: 'A', phone: '+919000000001' }] }, day);
    expect(r2.notDelivered).toBe(1); // no SMS provider: never shown as sent
    expect((await messageLog()).some((m) => m.status === 'held_quiet_hours')).toBe(true);
  });

  it('published public articles reach the website chatbot content', async () => {
    const { botContent } = await import('./publicFeed');
    const c = await botContent();
    expect(c.knowledgeBase.items.some((i) => i.title === 'Hostel fee instalments')).toBe(true);
    expect(c.knowledgeBase.items.some((i) => i.title === 'Mess timings')).toBe(false); // student-only
  });
});

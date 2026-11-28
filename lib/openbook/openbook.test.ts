import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

let dir: string;
let cwd: string;
beforeAll(() => {
  cwd = process.cwd();
  dir = mkdtempSync(path.join(tmpdir(), 'bjc-openbook-'));
  process.chdir(dir);
  delete process.env.SUPABASE_URL;
  delete process.env.ANTHROPIC_API_KEY; delete process.env.OPENROUTER_API_KEY;
  delete process.env.VOYAGE_API_KEY;
});
afterAll(() => {
  process.chdir(cwd);
  rmSync(dir, { recursive: true, force: true });
});

const staff = (id: string, role: string) => ({ id, fullName: id, email: null, phone: null, roles: [role] as never, active: true });
const student = (id: string) => ({ kind: 'student' as const, id, name: id });

async function pdf(lines: string[][]) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const page of lines) {
    const p = doc.addPage([595, 842]);
    page.forEach((l, i) => p.drawText(l, { x: 40, y: 800 - i * 18, size: 11, font }));
  }
  return new Uint8Array(await doc.save());
}

describe('uniqueness engine: normalisation, fingerprints, similarity', () => {
  it('treats formatting changes as the same question and new numbers as a different one', async () => {
    const T = await import('./text');
    expect(T.fingerprint('A ball is thrown at 20 m/s.  Find   the height.')).toBe(T.fingerprint('a BALL is thrown at 20 m/s. find the height'));
    expect(T.fingerprint('A ball is thrown at 20 m/s')).not.toBe(T.fingerprint('A ball is thrown at 25 m/s'));
    expect(T.lexicalSimilarity('A ball is thrown vertically upward at 20 m/s. Find the maximum height.', 'Find the maximum height reached by a ball thrown vertically upwards at 20 m/s.')).toBeGreaterThan(0.82);
    expect(T.lexicalSimilarity('A ball is thrown vertically upward at 20 m/s. Find the maximum height.', 'Calculate the de Broglie wavelength of an electron accelerated through 100 V.')).toBeLessThan(0.4);
  });

  it('rejects exact and near duplicates against the pool and the current batch', async () => {
    const Q = await import('./questions');
    const T = await import('./text');
    const stem = 'A body starts from rest with acceleration 2 m/s². Find its velocity after 5 s.';
    const pool = [{ id: 'q1', fingerprint: T.fingerprint(stem), stem, options: [] }];
    expect((await Q.checkCandidate(stem, pool, [], 0.82, null, [])).reason).toBe('exact');
    expect((await Q.checkCandidate('A body starts from rest with an acceleration of 2 m/s². Find the velocity after 5 s.', pool, [], 0.82, null, [])).reason).toBe('semantic');
    const fresh = await Q.checkCandidate('A train moving at 72 km/h brakes uniformly and stops in 10 s. Find the braking distance.', pool, [], 0.82, null, []);
    expect(fresh.ok).toBe(true);
    expect(fresh.method).toBe('fingerprint+lexical');
    expect((await Q.checkCandidate(stem, [], [stem], 0.82, null, [])).reason).toBe('exact');
    // with an embedding, a high pgvector score rejects a paraphrase the lexical check misses
    expect((await Q.checkCandidate('Totally different words here', [], [], 0.82, [0.1, 0.2], [{ questionId: 'q9', score: 0.93 }])).method).toBe('pgvector');
  });
});

describe('marking', () => {
  it('marks MCQ, multi-correct (partial), numerical (tolerance) and one-word answers', async () => {
    const { markObjective } = await import('./questions');
    const base = { options: ['a', 'b', 'c', 'd'], marks: 4, negative: 1 };
    expect(markObjective({ ...base, type: 'mcq_single', answer: ['2'] }, ['2'])).toEqual({ correct: true, score: 4 });
    expect(markObjective({ ...base, type: 'mcq_single', answer: ['2'] }, ['1'])).toEqual({ correct: false, score: -1 });
    expect(markObjective({ ...base, type: 'mcq_single', answer: ['2'] }, [])).toEqual({ correct: null, score: 0 });
    expect(markObjective({ ...base, type: 'mcq_multi', answer: ['0', '2'] }, ['0'])).toEqual({ correct: false, score: 2 });
    expect(markObjective({ ...base, type: 'mcq_multi', answer: ['0', '2'] }, ['0', '3']).score).toBe(-1);
    expect(markObjective({ ...base, type: 'numerical', options: [], answer: ['9.8'] }, ['9.81']).correct).toBe(true);
    expect(markObjective({ ...base, type: 'numerical', options: [], answer: ['9.8'] }, ['10.5']).correct).toBe(false);
    expect(markObjective({ ...base, type: 'one_word', options: [], answer: ['Mitochondria'] }, ['  mitochondria ']).correct).toBe(true);
  });
});

describe('safety filters for the community', () => {
  it('blocks phone numbers, emails, links, handles and abuse but allows years and numbers in physics', async () => {
    const { blockedContent } = await import('./text');
    expect(blockedContent('call me 98765 43210')).toBe('phone');
    expect(blockedContent('mail me at abc@gmail.com')).toBe('email');
    expect(blockedContent('see www.example.com')).toBe('link');
    expect(blockedContent('dm on insta')).toBe('handle');
    expect(blockedContent('you are stupid')).toBe('abuse');
    expect(blockedContent('JEE 2024 paper: a car accelerates at 3 m/s² for 12 s from 0. Find the distance.')).toBeNull();
  });
});

describe('papers: question splitting, options and answer keys', () => {
  it('splits numbered questions and pulls out (a)-(d) options', async () => {
    const T = await import('./text');
    const qs = T.splitQuestions('Physics Paper 2024\n1. A car moves at 10 m/s. Its speed after 2 s is\n(a) 10 (b) 20 (c) 30 (d) 40\n2. State Newton\'s second law of motion clearly.\n3) Define work and give its SI unit please.');
    expect(qs.map((q) => q.qno)).toEqual(['1', '2', '3']);
    expect(T.parseOptions(qs[0].text).options).toEqual(['10', '20', '30', '40']);
    const P = await import('./papers');
    const key = P.parseAnswerKey('1-B, 2. (c), Q3: 4.5');
    expect([key.get('1'), key.get('2'), key.get('3')]).toEqual(['1', '2', '4.5']);
  });
});

describe('spaced repetition', () => {
  it('SM-2 grows intervals for good answers and resets on again', async () => {
    const F = await import('./flashcards');
    let c = { ef: 2.5, interval: 0, reps: 0, lapses: 0 };
    const a = F.sm2(c, 'good', '2026-11-25'); expect(a.interval).toBe(1); c = a;
    const b = F.sm2(c, 'good', '2026-11-26'); expect(b.interval).toBe(3); c = b;
    const d = F.sm2(c, 'good', '2026-11-29'); expect(d.interval).toBeGreaterThan(5);
    const e = F.sm2(d, 'again', '2026-12-10'); expect(e.interval).toBe(1); expect(e.lapses).toBe(1); expect(e.ef).toBeLessThan(d.ef);
    const M = await import('./mastery');
    expect(M.nextSchedule(0, false, false, '2026-11-25').nextReview).toBe('2026-11-26');
    expect(M.nextSchedule(3, true, true, '2026-11-25').interval).toBe(7);
  });
});

describe('Open Book with real record-store operations (file store)', () => {
  it('library: upload, extract, search, read, bookmark, notes, export; copyright rule', async () => {
    const L = await import('./library');
    const by = { kind: 'staff' as const, id: 'coord', name: 'Coordinator' };
    const bytes = await pdf([['Chapter 1 Kinematics', 'Displacement is the change in position.', 'Velocity is the rate of change of displacement.'], ['Projectile motion', 'The range of a projectile is u^2 sin 2theta / g.']]);
    await expect(L.uploadBook(by, true, { name: 'x.pdf', bytes }, { title: 'Copyrighted', authors: [], publisher: null, edition: null, year: null, isbn: null, description: null, category: 'engineering', examIds: ['jee-main'], subjects: ['Physics'], cls: '11', chapters: [], kind: 'reference', licence: 'copyrighted', officialUrl: null, downloadAllowed: false })).rejects.toThrow(/Only public-domain/);
    const id = await L.uploadBook(by, true, { name: 'notes.pdf', bytes }, { title: 'BJC Physics Notes', authors: ['BJC Physics Dept'], publisher: 'Bhargava Junior College', edition: '2027', year: '2026', isbn: null, description: null, category: 'engineering', examIds: ['jee-main'], subjects: ['Physics'], cls: '11', chapters: ['Motion in a Plane'], kind: 'institution', licence: 'institution_owned', officialUrl: null, downloadAllowed: true });
    const book = await L.getBook(id);
    expect(book?.textStatus).toBe('extracted');
    expect(book?.pages).toBe(2);
    expect((await L.listBooks({ q: 'physics notes' })).total).toBe(1);
    expect((await L.listBooks({ examId: 'neet-ug' })).total).toBe(0);
    expect((await L.searchInBook(id, 'projectile range'))[0].page).toBe(2);
    expect(await L.openBook('s1', id)).toBe(1);
    await L.saveProgress('s1', id, 2, 30);
    expect(await L.openBook('s1', id)).toBe(2);
    await L.addBookmark('s1', id, 2, 'Range formula');
    await L.addNote('s1', { bookId: id, page: 2, text: 'u^2 sin 2theta / g', color: 'yellow', note: 'max at 45°' });
    expect((await L.bookmarksOf('s1', id)).length).toBe(1);
    expect(await L.notesMarkdown('s1')).toContain('max at 45°');
    // privacy: another student sees nothing and cannot delete s1's note
    expect((await L.notesOf('s2')).length).toBe(0);
    const n = (await L.notesOf('s1'))[0];
    await expect(L.removeNote('s2', n.id)).rejects.toThrow(/not found/);
  });

  it('papers: text-layer extraction, tagging, approval and pattern analysis across years', async () => {
    const P = await import('./papers');
    const by = { kind: 'staff' as const, id: 'coord', name: 'Coordinator' };
    const ids: string[] = [];
    for (const [year, v] of [[2023, 10], [2024, 12], [2025, 15]] as const) {
      const bytes = await pdf([[`JEE Main ${year} Physics`, `1. A projectile is fired at ${v} m/s at 45 degrees. Find its range.`, '(a) 10 m (b) 20 m (c) 30 m (d) 40 m', `2. A body moves with uniform acceleration ${v / 5} m/s2 from rest for 4 s. Find displacement.`, '(a) 8 m (b) 16 m (c) 24 m (d) 32 m', '3. State Ohm\'s law and the resistivity of a wire in a circuit.']]);
      ids.push(await P.uploadPaper(by, true, { name: `jee-${year}.pdf`, bytes }, { title: `JEE Main ${year} Physics`, examId: 'jee-main', board: 'NTA', subject: 'Physics', topics: [], year, session: 'January', paperType: 'official', difficulty: null, cls: 'both', licence: 'official_public', answerKey: '1-B, 2-B' }));
    }
    const qs = await P.paperQuestions(ids[0]);
    expect(qs.length).toBe(3);
    expect(qs[0].options).toEqual(['10 m', '20 m', '30 m', '40 m']);
    expect(qs[0].answer).toEqual(['1']);
    expect(qs[0].chapter).toBe('Motion in a Plane');
    const a = await P.patternAnalysis('jee-main', 'Physics');
    expect(a.basis.papers).toBe(3);
    expect(a.years).toEqual([2023, 2024, 2025]);
    expect(a.chapters[0].perYear.length).toBe(3);
    expect(a.repeated.length).toBeGreaterThan(0);
    expect(a.neverAsked).toContain('Waves');
    const M = await import('./mocks');
    const mid = await M.createMock({ kind: 'student', id: 's1', name: 'S' }, 's1', null, { examId: 'jee-main', subjects: ['Physics'], chapters: [], concepts: [], count: 10, difficulty: null, minutes: null, marks: null, negative: null, source: 'pattern' });
    expect((await M.getMock(mid))?.questionIds.length).toBeGreaterThan(0);
    // a scanned paper is never filled with made-up text without OCR
    const scan = await P.uploadPaper({ kind: 'student', id: 's1', name: 'S' }, false, { name: 'scan.png', bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(64).fill(0)]) }, { title: 'Photo', examId: 'jee-main', board: null, subject: 'Physics', topics: [], year: 2022, session: null, paperType: 'handwritten', difficulty: null, cls: 'na', licence: 'student_upload', answerKey: null });
    expect((await P.getPaper(scan))?.status).toBe('pending');
    expect(['ocr_needed', 'failed']).toContain((await P.getPaper(scan))?.extraction.status);
    expect((await P.paperQuestions(scan)).length).toBe(0);
  });

  it('AI features say "not configured" instead of faking answers', async () => {
    const Q = await import('./questions');
    await expect(Q.generate(student('s1'), 's1', { examId: 'jee-main', subject: 'Physics', chapter: 'Motion in a Plane', concept: 'Projectile motion', types: ['mcq_single'], difficulty: 'medium', count: 5 })).rejects.toThrow(/AI is not configured/);
    await expect(Q.generate(student('s1'), 's1', { examId: 'jee-main', subject: 'Physics', chapter: 'Motion in a Plane', concept: 'Projectile motion', types: ['long'], difficulty: 'medium', count: 5 })).rejects.toThrow(/not used in JEE Main/);
    const A = await import('./assistant');
    const r = await A.ask({ studentId: 's1', task: 'answer', question: 'range of a projectile', lang: 'en' });
    expect(r.mode).toBe('extract');
    expect(r.sources[0]?.page).toBe(2);
  });

  it('practice bank import, pool mock with timer/save/submit/report, mastery', { timeout: 120_000 }, async () => {
    const S = await import('./seed');
    expect(await S.importPracticeBank()).toBeGreaterThan(100);
    expect(await S.importPracticeBank()).toBe(0); // idempotent
    const M = await import('./mocks');
    const mockId = await M.createMock(student('s1'), 's1', null, { examId: 'jee-main', subjects: ['Physics'], chapters: ['Laws of Motion'], concepts: [], count: 5, difficulty: null, minutes: 10, marks: 4, negative: 1, source: 'pool' });
    const mock = await M.getMock(mockId);
    expect(mock?.questionIds.length).toBe(5);
    const attemptId = await M.startAttempt('s1', null, mockId);
    expect(await M.startAttempt('s1', null, mockId)).toBe(attemptId); // resume, not restart
    const { getQuestions } = await import('./questions');
    const qs = await getQuestions(mock!.questionIds);
    await M.saveAnswers('s1', attemptId, { answers: { [qs[0].id]: [qs[0].answer[0]], [qs[1].id]: [String((Number(qs[1].answer[0]) + 1) % 4)] }, review: [qs[2].id], time: { [qs[0].id]: 40 } });
    await expect(M.saveAnswers('s2', attemptId, {})).rejects.toThrow(/not found/);
    const res = await M.submit('s1', null, attemptId);
    expect(res.score).toBe(3); // +4 −1
    const rep = await M.report('s1', attemptId);
    expect(rep.summary.correct).toBe(1);
    expect(rep.summary.wrong).toBe(1);
    expect(rep.summary.skipped).toBe(3);
    const Ma = await import('./mastery');
    expect((await Ma.masteryOf('s1')).length).toBeGreaterThan(0);
  });

  it('flashcards from wrong answers with due counts and rating', async () => {
    const F = await import('./flashcards');
    const r = await F.cardsFromWrongAnswers('s1');
    expect(r.added).toBe(1);
    expect(await F.dueCount('s1')).toBe(1);
    const [card] = await F.dueCards('s1');
    await F.rate('s1', card.id, 'good');
    expect(await F.dueCount('s1')).toBe(0);
    await expect(F.rate('s2', card.id, 'good')).rejects.toThrow(/not found/);
  });

  it('community: nickname, blocked content, report → hidden after 3, accept, moderation', async () => {
    const C = await import('./community');
    await expect(C.createThread(student('s1'), { title: 'Call me please', body: 'my number 9876543210', subject: 'Physics', chapter: null, concept: null })).rejects.toThrow(/Phone numbers/);
    const { id } = await C.createThread(student('s1'), { title: 'Why is range maximum at 45 degrees?', body: 'I do not get the sin 2θ part.', subject: 'Physics', chapter: 'Motion in a Plane', concept: 'Projectile motion' });
    await C.answer({ kind: 'staff', id: 't9', name: 'QA Academic Coordinator / Exam Cell' }, id, 'Staff answer with a long role name.');
    const a = await C.answer(student('s2'), id, 'Because sin 2θ is largest when 2θ = 90°.');
    await C.accept('s1', id, a.id);
    await expect(C.accept('s2', id, a.id)).rejects.toThrow(/Only the person/);
    await C.verify(staff('t1', 'faculty') as never, a.id);
    const t = await C.thread(id);
    expect(t?.thread.acceptedId).toBe(a.id);
    expect(t?.answers[0].verifiedBy).toBe('t1');
    expect(t?.thread.nickname).toMatch(/^Learner\d{4}$/);
    for (const r of ['r1', 'r2']) expect((await C.report(r, a.id, 'spam')).hidden).toBe(false);
    expect((await C.report('r3', a.id, 'spam')).hidden).toBe(true);
    expect((await C.thread(id))?.answers.length).toBe(1); // only the staff answer left visible
    await C.moderate(staff('t1', 'faculty') as never, a.id, 'restore', null);
    expect((await C.thread(id))?.answers.length).toBe(2);
    await expect(C.verify(staff('acc', 'accounts') as never, a.id)).rejects.toThrow(/permission/);
    expect((await C.similarThreads('range maximum 45 degrees', 'Physics'))[0]?.id).toBe(id);
  });
  it('learning path: build from mastery, daily plan, refresh', { timeout: 60_000 }, async () => {
    const P = await import('./path');
    const { addDays, todayIST } = await import('../dates');
    const p = await P.buildPath('s1', { examId: 'jee-main', examDate: addDays(todayIST(), 120), minutesPerDay: 60 });
    expect(p.items.length).toBeGreaterThan(100);
    expect(p.items.filter((i) => i.status === 'in_progress').length).toBe(2);
    const plan = await P.todayPlan('s1');
    expect(plan?.tasks.length).toBeGreaterThan(0);
  });

  it('pending items: diagram cards, offline cards, formula sheet, tutor → path, weekly winners, catalogue', { timeout: 120_000 }, async () => {
    // diagram (image-occlusion) cards: one card per labelled box, all masks kept
    const F = await import('./flashcards');
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(64).fill(1)]);
    const occ = await F.occlusionCards('s3', { deckName: 'Heart', subject: 'Biology', image: { bytes: png, mime: 'image/png' }, boxes: [{ x: 0.1, y: 0.1, w: 0.2, h: 0.1, label: 'Left atrium' }, { x: 0.5, y: 0.5, w: 0.2, h: 0.1, label: 'Aorta' }, { x: 0.7, y: 0.7, w: 0.1, h: 0.1, label: '' }] });
    expect(occ.added).toBe(2);
    const due = await F.dueCards('s3');
    expect(due.every((c) => c.masks.length === 2 && c.imageKey)).toBe(true);
    expect(due.map((c) => c.target).sort()).toEqual([0, 1]);
    await expect(F.occlusionCards('s3', { deckName: 'x', subject: null, image: { bytes: png, mime: 'application/pdf' }, boxes: [] })).rejects.toThrow(/PNG or JPG/);
    // offline review: image cards excluded; the same SM-2 runs on the phone
    await F.addCard('s3', occ.deckId, { kind: 'qa', front: 'Q', back: 'A', source: 'manual' });
    const off = await F.cardsForOffline('s3');
    expect(off.length).toBe(1);
    const { sm2 } = await import('./sm2');
    expect(sm2(off[0], 'good', '2026-11-26').due).toBe('2026-11-27');
    // formula sheet from worked solutions (general formulas only, not numeric results)
    const R = await import('./revision');
    expect(R.generalFormulas('Sum of roots = −b/a = −(−7)/1 = 7. Range R = u² sin 2θ / g')).toEqual(expect.arrayContaining(['Sum of roots = −b/a', 'Range R = u² sin 2θ / g']));
    const sheet = await R.formulaSheet('s1', 'Mathematics', 'Complex Numbers and Quadratic Equations');
    expect(sheet.formulas.some((f) => /b\/a/.test(f.text))).toBe(true);
    // tutor weak point → learning path item in progress with the reason
    const P = await import('./path');
    const placed = await P.flagFromTutor('s1', [{ subject: 'Physics', chapter: 'Waves', concept: 'Doppler effect' }]);
    expect(placed).toEqual(['Doppler effect']);
    const item = (await P.pathOf('s1'))!.items.find((i) => i.concept === 'Doppler effect')!;
    expect(item.status).toBe('in_progress');
    expect(item.reason).toMatch(/Voice tutor/);
    // weekly winners → Notices (batch audience), idempotent, bonus XP, opted-out excluded
    const { allBatches } = await import('../school/common');
    const { batches, notices } = await import('../records/collections');
    const { getRecordStore } = await import('../records');
    const b = await batches.put(getRecordStore(), { name: 'OB 1A', program: 'IIT-JEE', year: 1, section: 'A', capacity: 40, classTeacherId: null, studentIds: ['s1', 's2'], active: true });
    const { obChallengeAttempts } = await import('./collections');
    const { addDays, todayIST } = await import('../dates');
    await obChallengeAttempts.put(getRecordStore(), { studentId: 's1', batchId: b.id, date: addDays(todayIST(), -2), subject: 'Physics', correct: 4, total: 5, xp: 50 });
    await obChallengeAttempts.put(getRecordStore(), { studentId: 's2', batchId: b.id, date: addDays(todayIST(), -3), subject: 'Physics', correct: 5, total: 5, xp: 60 });
    const Ch = await import('./challenge');
    await Ch.saveProfile('s2', { optOut: true });
    const { saveSettings } = await import('./core');
    await saveSettings({ id: 'adm', fullName: 'Admin', email: null, phone: null, roles: ['super_admin'], active: true } as never, { weeklyReward: 'Certificate at assembly', weeklyBonusXp: 20 });
    expect((await Ch.announceWeeklyWinners()).posted).toBeGreaterThanOrEqual(1);
    const n = (await notices.list(getRecordStore(), { k1: `batch:${b.id}` }))[0];
    expect(n.data.body).toContain('Certificate at assembly');
    expect(n.data.body).toContain('50 XP');
    expect(n.data.body).not.toContain('60 XP'); // opted out
    expect((await Ch.announceWeeklyWinners()).posted).toBe(0); // once per week
    expect((await allBatches()).length).toBeGreaterThan(0);
    // official catalogue (link-only, idempotent)
    const L = await import('./library');
    expect(await L.seedCatalogue(null)).toBe(19);
    expect(await L.seedCatalogue(null)).toBe(0);
    const ncert = (await L.listBooks({ q: 'Physics Part I Class XI', kind: 'official' })).items[0];
    expect(ncert.fileKey).toBeNull();
    expect(ncert.officialUrl).toBe('https://ncert.nic.in/textbook.php');
  });
});
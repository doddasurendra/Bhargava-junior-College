import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

let dir: string;
let cwd: string;

beforeAll(() => {
  cwd = process.cwd();
  dir = mkdtempSync(path.join(tmpdir(), 'bjc-modules-'));
  process.chdir(dir);
  delete process.env.SUPABASE_URL;
});
afterAll(() => {
  process.chdir(cwd);
  rmSync(dir, { recursive: true, force: true });
});

const staff = (id: string, role: string) => ({ id, fullName: id, email: null, phone: null, roles: [role] as never, active: true });

async function admit(phone: string, name: string) {
  const { createFileStore } = await import('../store/file');
  const { createFileCrmRepo } = await import('../crm/fileRepo');
  const store = createFileStore();
  const repo = createFileCrmRepo();
  const { leadId } = await store.captureLead({ name: 'Parent', phone, consent: true, source: 'callback', program: 'neet' });
  await repo.updateLead(leadId, { status: 'confirmed' }, []);
  await repo.signOffStage(leadId, 'application', 'staff-office', null);
  await repo.signOffStage(leadId, 'documents', 'staff-office', null);
  const pid = await repo.addPayment({ leadId, amount: 1000, mode: 'upi', reference: `R${phone}`, paidOn: '2026-11-02', status: 'pending_approval', recordedBy: 'staff-frontdesk', approvedBy: null, approvedAt: null });
  await repo.decidePayment(pid, true, 'staff-accounts');
  await repo.signOffStage(leadId, 'fee', 'staff-accounts', null);
  await repo.issueReceipts(leadId, 'staff-accounts');
  await repo.createStudent(leadId, { fullName: name, dob: '2011-01-01', gender: 'female', program: 'neet', stay: 'day', guardianName: 'Parent', guardianPhone: phone }, 'staff-adminoffice');
  await repo.issueCollegeId(leadId, 'staff-adminoffice');
  return (await repo.getVerification(leadId)).student!.id;
}

describe('new modules', () => {
  it('syllabus, multi-channel doubts, exams from the bank, knowledge base and summary', async () => {
    const sid = await admit('+919777700201', 'Meghana');
    const { getRecordStore } = await import('../records');
    const { batches } = await import('../records/collections');
    const batch = await batches.put(getRecordStore(), { name: 'NEET A', program: 'neet', year: 1, section: 'A', capacity: 40, classTeacherId: 'staff-ct', studentIds: [sid], active: true });
    // A faculty member who is also this batch's class teacher (like the sample V. Naresh / A. Swathi).
    const teacher = { ...staff('staff-ct', 'faculty'), roles: ['faculty', 'class_teacher'] as never };

    // Syllabus: NEET batch studies Physics, Chemistry, Biology; coverage counts in-progress as half.
    const Sy = await import('./syllabus');
    expect(Sy.subjectsForProgram('neet')).toEqual(['Physics', 'Chemistry', 'Biology']);
    expect(Sy.subjectsForProgram('iit-jee')).toEqual(['Mathematics', 'Physics', 'Chemistry']);
    expect(Sy.coverage(['done', 'in_progress', 'not_started', 'not_started'])).toBe(38);
    await Sy.setChapterStatus(teacher, { batchId: batch.id, subject: 'Physics', chapter: 'Kinematics', status: 'done' }, '2026-11-05');
    await expect(Sy.setChapterStatus(teacher, { batchId: batch.id, subject: 'Mathematics', chapter: 'Differentiation', status: 'done' })).rejects.toThrow(/not in this batch/);
    await expect(Sy.setChapterStatus(staff('staff-x', 'faculty'), { batchId: batch.id, subject: 'Physics', chapter: 'Kinematics', status: 'done' })).rejects.toThrow(/don’t teach/);
    const mine = await Sy.syllabusForStudent(sid);
    expect(mine!.subjects.find((s) => s.subject === 'Physics')!.chapters.find((c) => c.chapter === 'Kinematics')!.status).toBe('done');
    expect(mine!.overall).toBeGreaterThan(0);

    // Multi-channel doubts: a teacher logs a WhatsApp doubt; it joins the inbox with its channel.
    const A = await import('./academics');
    await expect(A.logDoubt(teacher, { studentId: sid, subject: 'Biology', text: 'What is 2pq?', channel: 'app' })).rejects.toThrow(/where the doubt came in/);
    await A.logDoubt(teacher, { studentId: sid, subject: 'Biology', text: 'What is 2pq?', channel: 'whatsapp' });
    await A.askDoubt(sid, { subject: 'Physics', text: 'Why v = u + at?', imageUrl: null });
    const inbox = await A.doubtInbox(teacher);
    expect(inbox.map((d) => d.channel).sort()).toEqual(['app', 'whatsapp']);

    // Online exam from the question bank: +4/−1, no duplicates, max marks updated.
    const head = staff('staff-exam', 'academic_coordinator');
    const t = await A.createTest(head, { batchId: batch.id, title: 'Weekly test 1', date: '2026-11-05', mode: 'online', durationMin: 60, maxMarks: 100, subjects: ['Physics'] });
    await A.addFromBank(head, t.id, { subject: 'Physics', chapter: 'Kinematics', difficulty: null, count: 5 });
    await A.addFromBank(head, t.id, { subject: 'Physics', chapter: 'Kinematics', difficulty: null, count: 5 });
    const { tests } = await import('../records/collections');
    const saved = (await tests.get(getRecordStore(), t.id))!.data;
    expect(saved.questions).toHaveLength(10);
    expect(new Set(saved.questions.map((q) => q.id)).size).toBe(10);
    expect(saved.maxMarks).toBe(40);
    expect(saved.questions.every((q) => q.marks === 4 && q.negative === 1)).toBe(true);

    // Knowledge base: only public, published articles reach the website assistant.
    const { buildKnowledge } = await import('../assistant/knowledge');
    const { defaultContent } = await import('../cms/blocks');
    const c = defaultContent();
    c.knowledgeBase.items.push({ title: 'Secret staff note', body: 'internal only', category: 'policies', audience: 'staff', published: true }, { title: 'Draft article', body: 'not yet', category: 'other', audience: 'public', published: false });
    const kb = buildKnowledge(c);
    expect(kb).toContain('How do I track my admission?');
    expect(kb).not.toContain('Secret staff note');
    expect(kb).not.toContain('Draft article');
    expect(kb).not.toContain('Handling a parent complaint');

    // Staff assistant finds staff-only articles.
    const S = await import('../staffAssistant/service');
    const hits = await S.ask(staff('staff-principal', 'principal'), 'notes about parent complaint');
    expect(hits.kind).toBe('notes');

    // Summary: sections by role.
    const Sm = await import('./summary');
    const forPrincipal = await Sm.summary(staff('staff-principal', 'principal'), '2026-11-05');
    expect(forPrincipal.sections.map((s) => s.area)).toEqual(expect.arrayContaining(['Admissions', 'Academics', 'Practice', 'Library']));
    expect(forPrincipal.sections.find((s) => s.area === 'Academics')!.tiles.find((t) => t.label === 'Open doubts')!.value).toBe('2');
    const forTelecaller = await Sm.summary(staff('staff-priya', 'telecaller'), '2026-11-05');
    expect(forTelecaller.sections).toEqual([]);
  }, 60_000);
});

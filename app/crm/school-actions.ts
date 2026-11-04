'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaff } from '@/lib/crm/auth';
import { normalizeIndianMobile } from '@/lib/phone';
import * as A from '@/lib/school/academics';
import * as F from '@/lib/school/accounts';
import { SchoolError } from '@/lib/school/common';
import * as M from '@/lib/school/mentoring';
import * as O from '@/lib/school/operations';
import { recordCounselling } from '@/lib/school/counselling';
import type { ActionState } from './actions';

const s = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};
const n = (fd: FormData, k: string) => Number(fd.get(k) ?? NaN);
const b = (fd: FormData, k: string) => fd.get(k) === 'on' || fd.get(k) === 'true';
const req = (fd: FormData, k: string, label: string) => {
  const v = s(fd, k);
  if (!v) throw new SchoolError(`${label} is required.`);
  return v;
};

async function run(fn: () => Promise<string | void>, paths: string[]): Promise<ActionState> {
  try {
    const message = await fn();
    for (const p of paths) revalidatePath(p);
    return { ok: true, message: message || 'Saved.' };
  } catch (e) {
    if (e instanceof SchoolError) return { error: e.message };
    if (e instanceof z.ZodError) return { error: e.issues[0]?.message ?? 'Check the form.' };
    if (e instanceof Error && /permission/i.test(e.message)) return { error: e.message };
    console.error('[school] action failed', e);
    return { error: 'Something went wrong. Please try again.' };
  }
}

const ACAD = ['/crm/academics', '/crm/academics/my-classes'];

// ---------------------------------------------------------------- academics
export const saveBatchAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    const user = await requireStaff('academics.manage');
    await A.saveBatch(user, { id: s(fd, 'id') ?? undefined, name: req(fd, 'name', 'Name'), program: req(fd, 'program', 'Program'), year: n(fd, 'year'), section: req(fd, 'section', 'Section'), capacity: n(fd, 'capacity'), classTeacherId: s(fd, 'classTeacherId'), active: fd.get('active') === null ? true : b(fd, 'active') });
    return 'Batch saved.';
  }, ACAD);

export const allotStudentAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    const user = await requireStaff('academics.manage');
    await A.allotStudent(user, req(fd, 'studentId', 'Student'), s(fd, 'batchId'));
    return 'Student allotted.';
  }, [...ACAD, '/crm/students']);

export const addPeriodAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    const user = await requireStaff('academics.manage');
    await A.addPeriod(user, { batchId: req(fd, 'batchId', 'Batch'), day: n(fd, 'day'), start: req(fd, 'start', 'Start'), end: req(fd, 'end', 'End'), subject: req(fd, 'subject', 'Subject'), facultyId: req(fd, 'facultyId', 'Teacher'), room: s(fd, 'room') });
    return 'Period added.';
  }, ACAD);

export const removePeriodAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    await A.removePeriod(await requireStaff('academics.manage'), req(fd, 'id', 'Period'));
    return 'Removed.';
  }, ACAD);

export const markAttendanceAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    const user = await requireStaff('attendance.mark');
    const marks: Record<string, string> = {};
    for (const [k, v] of fd.entries()) if (k.startsWith('m:') && typeof v === 'string') marks[k.slice(2)] = v;
    const r = await A.markAttendance(user, req(fd, 'batchId', 'Batch'), req(fd, 'date', 'Date'), marks);
    return `Attendance saved. ${r.absent} absent; parents of absent students have been informed.`;
  }, ['/crm/academics/batch']);

export const addMaterialAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    const user = await requireStaff('materials.upload');
    await A.addMaterial(user, { batchId: req(fd, 'batchId', 'Batch'), subject: req(fd, 'subject', 'Subject'), title: req(fd, 'title', 'Title'), kind: req(fd, 'kind', 'Kind'), url: s(fd, 'url'), dueDate: s(fd, 'dueDate') });
    return 'Shared with the batch.';
  }, ['/crm/academics/batch']);

export const createTestAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    const user = await requireStaff('tests.manage');
    await A.createTest(user, { batchId: req(fd, 'batchId', 'Batch'), title: req(fd, 'title', 'Title'), date: req(fd, 'date', 'Date'), mode: s(fd, 'mode') === 'offline' ? 'offline' : 'online', durationMin: n(fd, 'durationMin') || 60, maxMarks: n(fd, 'maxMarks') || 100, subjects: (s(fd, 'subjects') ?? '').split(',').map((x) => x.trim()).filter(Boolean) });
    return 'Test created.';
  }, ['/crm/academics/batch', ...ACAD]);

export const addQuestionAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    const user = await requireStaff('tests.manage');
    await A.addQuestion(user, req(fd, 'testId', 'Test'), { subject: s(fd, 'subject'), chapter: s(fd, 'chapter'), text: s(fd, 'text'), options: [s(fd, 'o0'), s(fd, 'o1'), s(fd, 'o2'), s(fd, 'o3')], answer: n(fd, 'answer'), marks: n(fd, 'marks') || 4, negative: Number.isFinite(n(fd, 'negative')) ? n(fd, 'negative') : 1 });
    return 'Question added.';
  }, ['/crm/academics/test']);

export const enterMarksAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    const user = await requireStaff('tests.manage');
    const marks: Record<string, { score: number }> = {};
    for (const [k, v] of fd.entries()) if (k.startsWith('s:') && typeof v === 'string' && v.trim() !== '') marks[k.slice(2)] = { score: Number(v) };
    await A.enterMarks(user, req(fd, 'testId', 'Test'), marks);
    return 'Marks saved.';
  }, ['/crm/academics/test']);

export const publishTestAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    await A.publishTest(await requireStaff('results.publish'), req(fd, 'testId', 'Test'));
    return 'Published. Students and parents can see it now.';
  }, ['/crm/academics/test', ...ACAD]);

export const answerDoubtAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    await A.answerDoubt(await requireStaff('doubts.answer'), req(fd, 'doubtId', 'Doubt'), req(fd, 'answer', 'Answer'));
    return 'Answered.';
  }, ACAD);

export const publishNoticeAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    await A.publishNotice(await requireStaff('notices.publish'), { title: req(fd, 'title', 'Title'), body: req(fd, 'body', 'Text'), audience: req(fd, 'audience', 'Audience'), attachmentUrl: s(fd, 'attachmentUrl'), notify: b(fd, 'notify') });
    return 'Notice published.';
  }, ['/crm/notices']);

// ---------------------------------------------------------------- mentoring
export const assignMentorAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    await M.assignMentor(await requireStaff('academics.manage'), req(fd, 'mentorId', 'Mentor'), req(fd, 'studentId', 'Student'));
    return 'Mentor assigned.';
  }, ['/crm/academics', '/crm/mentor']);

export const mentorNoteAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    const kind = s(fd, 'kind');
    await M.addMentorNote(await requireStaff('mentor.notes'), { studentId: req(fd, 'studentId', 'Student'), kind: kind === 'parent_call' || kind === 'one_to_one' ? kind : 'note', note: req(fd, 'note', 'Note'), shareWithParent: b(fd, 'share') });
    return 'Saved.';
  }, ['/crm/mentor']);

export const checkInAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    const r = await M.recordCheckIn(await requireStaff('wellbeing.view'), { studentId: req(fd, 'studentId', 'Student'), month: req(fd, 'month', 'Month'), stress: n(fd, 'stress'), sleep: n(fd, 'sleep'), note: s(fd, 'note') });
    return r.data.followUp === 'parent_call' ? 'Saved. A low score: please call the parent privately this week.' : 'Saved.';
  }, ['/crm/mentor']);

export const disciplineAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    await M.addDiscipline(await requireStaff('discipline.record'), { studentId: req(fd, 'studentId', 'Student'), note: req(fd, 'note', 'Note'), action: s(fd, 'actionTaken') });
    return 'Recorded.';
  }, ['/crm/mentor', '/crm/students']);

export const ptmSlotsAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    const times = (s(fd, 'times') ?? '').split(/[,\s]+/).filter((t) => /^\d{2}:\d{2}$/.test(t));
    if (!times.length) throw new SchoolError('Give at least one time like 10:00.');
    const k = await M.addPtmSlots(await requireStaff('ptm.manage'), req(fd, 'date', 'Date'), times, n(fd, 'minutes') || 15);
    return `${k} slot${k === 1 ? '' : 's'} added.`;
  }, ['/crm/mentor']);

export const replyParentAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    await M.replyToParent(await requireStaff('messages.reply'), req(fd, 'studentId', 'Student'), req(fd, 'text', 'Message'));
    return 'Sent.';
  }, ['/crm/mentor']);

// ---------------------------------------------------------------- hostel
export const saveRoomAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    await O.saveRoom(await requireStaff('hostel.manage'), { id: s(fd, 'id') ?? undefined, block: s(fd, 'block') === 'girls' ? 'girls' : 'boys', room: req(fd, 'room', 'Room'), ac: b(fd, 'ac'), capacity: n(fd, 'capacity') });
    return 'Room saved.';
  }, ['/crm/hostel']);

export const allotRoomAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    await O.allotRoom(await requireStaff('hostel.manage'), req(fd, 'studentId', 'Student'), s(fd, 'roomId'));
    return 'Room allotted.';
  }, ['/crm/hostel']);

export const nightRollAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    const r = await O.markNightRoll(await requireStaff('hostel.manage'), s(fd, 'block') === 'girls' ? 'girls' : 'boys', fd.getAll('present').map(String));
    return `Night roll saved: ${r.present} present, ${r.absent} absent.`;
  }, ['/crm/hostel']);

export const sickRoomAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    await O.logSickRoom(await requireStaff('hostel.manage'), { studentId: req(fd, 'studentId', 'Student'), complaint: req(fd, 'complaint', 'Complaint'), action: req(fd, 'actionTaken', 'Action'), doctorCalled: b(fd, 'doctor'), informParent: b(fd, 'informParent') });
    return 'Logged.';
  }, ['/crm/hostel']);

export const outpassDecisionAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    const user = await requireStaff('outpass.approve');
    const id = req(fd, 'id', 'Out-pass');
    const d = s(fd, 'decision');
    if (d === 'returned') await O.markReturned(user, id);
    else await O.wardenDecideOutpass(user, id, d === 'approve', s(fd, 'note'));
    return 'Updated.';
  }, ['/crm/hostel']);

export const resolveComplaintAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    await O.resolveComplaint(await requireStaff('hostel.manage'), req(fd, 'id', 'Complaint'), req(fd, 'resolution', 'Resolution'));
    return 'Resolved.';
  }, ['/crm/hostel']);

export const visitorAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    const kind = s(fd, 'kind');
    await O.logVisitor(await requireStaff('visitor.log'), { name: req(fd, 'name', 'Name'), phone: s(fd, 'phone'), purpose: req(fd, 'purpose', 'Purpose'), studentId: s(fd, 'studentId'), place: s(fd, 'place') === 'hostel' ? 'hostel' : 'front_desk', kind: kind === 'gate_pass' || kind === 'parcel' ? kind : 'visitor' });
    return 'Logged.';
  }, ['/crm/front-desk', '/crm/hostel']);

export const visitorOutAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    await O.visitorOut(await requireStaff('visitor.log'), req(fd, 'id', 'Entry'));
  }, ['/crm/front-desk', '/crm/hostel']);

export const walkInAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    const phone = normalizeIndianMobile(req(fd, 'phone', 'Mobile'));
    if (!phone) throw new SchoolError('Enter a valid 10-digit mobile number.');
    await O.walkIn(await requireStaff('walkin.create'), { name: req(fd, 'name', 'Parent name'), phone, studentName: s(fd, 'studentName') ?? undefined, program: s(fd, 'program') ?? undefined, note: s(fd, 'note') ?? undefined });
    return 'Walk-in lead created (or merged with the existing lead for this number).';
  }, ['/crm/front-desk', '/crm/leads']);

// ---------------------------------------------------------------- transport
export const saveBusAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    await O.saveBus(await requireStaff('transport.manage'), { id: s(fd, 'id') ?? undefined, route: req(fd, 'route', 'Route'), busNo: req(fd, 'busNo', 'Bus number'), driverName: req(fd, 'driverName', 'Driver'), driverPhone: s(fd, 'driverPhone') });
    return 'Bus saved.';
  }, ['/crm/transport']);

export const assignBusAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    await O.assignBus(await requireStaff('transport.manage'), req(fd, 'studentId', 'Student'), s(fd, 'busId'));
    return 'Assigned.';
  }, ['/crm/transport']);

export const busAttendanceAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    await O.markBusAttendance(await requireStaff('transport.manage'), req(fd, 'busId', 'Bus'), s(fd, 'trip') === 'drop' ? 'drop' : 'pickup', fd.getAll('present').map(String));
    return 'Bus attendance saved.';
  }, ['/crm/transport']);

// ---------------------------------------------------------------- accounts
export const scheduleAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    const items = [];
    for (let i = 0; i < 12; i++) {
      const due = s(fd, `due${i}`);
      const amount = n(fd, `amount${i}`);
      if (due && amount > 0) items.push({ due, amount, label: `Instalment ${items.length + 1}` });
    }
    if (!items.length) throw new SchoolError('Add at least one instalment with a date and amount.');
    await F.saveSchedule(await requireStaff('fees.dues'), req(fd, 'studentId', 'Student'), items);
    return 'Instalment plan saved.';
  }, ['/crm/accounts']);

export const remindersAction = async (_: ActionState) =>
  run(async () => {
    const k = await F.sendFeeReminders(await requireStaff('fees.dues'));
    return `${k} reminder${k === 1 ? '' : 's'} sent.`;
  }, ['/crm/accounts']);

export const feeRequestAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    const kind = s(fd, 'kind') === 'refund' ? 'refund' : 'concession';
    const user = await requireStaff();
    const r = await F.requestFeeChange(user, { kind, leadId: req(fd, 'leadId', 'Student'), amount: n(fd, 'amount'), reason: req(fd, 'reason', 'Reason') });
    return r.data.level === 'above' ? 'Requested. It needs Management approval.' : 'Requested. The Admission Manager can approve it.';
  }, ['/crm/accounts']);

export const feeDecisionAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    await F.decideFeeChange(await requireStaff(), req(fd, 'id', 'Request'), s(fd, 'decision') === 'approve', s(fd, 'note'));
    return 'Decided.';
  }, ['/crm/accounts']);

// ---------------------------------------------------------------- admin office
export const certificateAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    const kind = s(fd, 'kind');
    if (kind !== 'tc' && kind !== 'bonafide' && kind !== 'study' && kind !== 'conduct') throw new SchoolError('Pick a certificate.');
    const c = await O.issueCertificate(await requireStaff('certificates.issue'), { studentId: req(fd, 'studentId', 'Student'), kind, purpose: s(fd, 'purpose'), conduct: s(fd, 'conduct') });
    return `Issued ${c.data.number}.`;
  }, ['/crm/students']);

// ---------------------------------------------------------------- staff leave
export const leaveRequestAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    await O.requestLeave(await requireStaff('leave.request'), { from: req(fd, 'from', 'From'), to: req(fd, 'to', 'To'), reason: req(fd, 'reason', 'Reason') });
    return 'Leave requested.';
  }, ['/crm/leave']);

export const leaveDecisionAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    await O.decideLeave(await requireStaff('leave.approve'), req(fd, 'id', 'Request'), s(fd, 'decision') === 'approve');
    return 'Decided.';
  }, ['/crm/leave', '/crm/academics/overview']);

// ---------------------------------------------------------------- counselling (§7.1 step 7)
export const counsellingAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    const decision = s(fd, 'decision');
    await recordCounselling(await requireStaff('counselling.record'), {
      leadId: req(fd, 'leadId', 'Lead'),
      programDiscussed: req(fd, 'program', 'Program discussed'),
      feesExplained: b(fd, 'fees'),
      scholarshipExplained: b(fd, 'scholarship'),
      concerns: s(fd, 'concerns'),
      decision: decision === 'confirmed' || decision === 'lost' ? decision : 'pending',
      notes: s(fd, 'notes'),
    });
    return 'Counselling recorded.';
  }, ['/crm/leads']);

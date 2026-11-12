'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaff } from '@/lib/crm/auth';
import { isIsoDate } from '@/lib/dates';
import { SchoolError } from '@/lib/school/common';
import * as SP from '@/lib/studentLife/sports';
import * as SE from '@/lib/studentLife/sessions';
import * as W from '@/lib/studentLife/wellbeing';
import * as OB from '@/lib/studentLife/openbook';
import type { ActionState } from './actions';

const s = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};
const req = (fd: FormData, k: string, label: string) => {
  const v = s(fd, k);
  if (!v) throw new SchoolError(`${label} is required.`);
  return v;
};
const date = (fd: FormData, k: string, label: string) => {
  const v = req(fd, k, label);
  if (!isIsoDate(v)) throw new SchoolError(`${label}: use a valid date.`);
  return v;
};
const num = (fd: FormData, k: string) => (s(fd, k) === null ? null : Number(s(fd, k)));

async function run(fn: () => Promise<string>, paths: string[]): Promise<ActionState> {
  try {
    const message = await fn();
    for (const p of paths) revalidatePath(p);
    return { ok: true, message };
  } catch (e) {
    if (e instanceof SchoolError) return { error: e.message };
    if (e instanceof z.ZodError) return { error: e.issues[0]?.message ?? 'Check the form.' };
    console.error('[student-life] action failed', e);
    return { error: 'Something went wrong. Please try again.' };
  }
}
/** For plain <form action> (checkbox lists, rubric grids): errors are logged; the page shows the saved state. */
async function plain(fn: () => Promise<unknown>, paths: string[]) {
  try {
    await fn();
  } catch (e) {
    console.error('[student-life] form failed', (e as Error).message);
  }
  for (const p of paths) revalidatePath(p);
}

// ---------------------------------------------------------------- sports
export const assignHouseAction = async (_: ActionState, fd: FormData) => run(async () => { await SP.assignHouse(await requireStaff(), req(fd, 'studentId', 'Student'), req(fd, 'house', 'House')); return 'House saved.'; }, ['/crm/sports']);
export const addFixtureAction = async (_: ActionState, fd: FormData) =>
  run(async () => { await SP.addFixture(await requireStaff(), { title: req(fd, 'title', 'Title'), sport: req(fd, 'sport', 'Sport'), kind: req(fd, 'kind', 'Type'), date: date(fd, 'date', 'Date'), time: s(fd, 'time'), venue: s(fd, 'venue'), home: req(fd, 'home', 'Team 1'), away: req(fd, 'away', 'Team 2') }); return 'Fixture added.'; }, ['/crm/sports']);
export const recordResultAction = async (_: ActionState, fd: FormData) =>
  run(async () => { await SP.recordResult(await requireStaff(), req(fd, 'id', 'Fixture'), req(fd, 'homeScore', 'Score 1'), req(fd, 'awayScore', 'Score 2'), req(fd, 'winner', 'Result') as 'home' | 'away' | 'draw'); return 'Result saved. Points table updated.'; }, ['/crm/sports']);
export const sportsAttendanceForm = async (fd: FormData) =>
  plain(async () => SP.markAttendance(await requireStaff(), date(fd, 'date', 'Date'), req(fd, 'sport', 'Sport'), fd.getAll('present').map(String)), ['/crm/sports']);
export const addAchievementAction = async (_: ActionState, fd: FormData) =>
  run(async () => { await SP.addAchievement(await requireStaff(), { studentId: req(fd, 'studentId', 'Student'), title: req(fd, 'title', 'Title'), medal: req(fd, 'medal', 'Medal'), event: req(fd, 'event', 'Event'), date: date(fd, 'date', 'Date') }); return 'Achievement added to the student profile.'; }, ['/crm/sports']);
export const addFitnessAction = async (_: ActionState, fd: FormData) =>
  run(async () => { await SP.addFitness(await requireStaff(), { studentId: req(fd, 'studentId', 'Student'), date: date(fd, 'date', 'Date'), run600mSec: num(fd, 'run'), sitReachCm: num(fd, 'reach'), bmi: num(fd, 'bmi') }); return 'Fitness check saved (private).'; }, ['/crm/sports']);

// ---------------------------------------------------------------- sessions
export const addSpeakerAction = async (_: ActionState, fd: FormData) =>
  run(async () => { await SE.addSpeaker(await requireStaff(), { name: req(fd, 'name', 'Name'), background: req(fd, 'background', 'Background'), topic: req(fd, 'topic', 'Topic'), contact: s(fd, 'contact'), fee: num(fd, 'fee') }); return 'Speaker added.'; }, ['/crm/sessions']);
export const createSessionAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    await SE.createSession(await requireStaff(), { title: req(fd, 'title', 'Title'), type: req(fd, 'type', 'Type'), speakerId: s(fd, 'speakerId'), date: date(fd, 'date', 'Date'), time: req(fd, 'time', 'Time'), venue: s(fd, 'venue'), onlineUrl: s(fd, 'onlineUrl'), audience: req(fd, 'audience', 'Audience'), capacity: Number(s(fd, 'capacity') ?? 100), summary: s(fd, 'summary') });
    return 'Session scheduled. It is on the Events calendar and in Notices.';
  }, ['/crm/sessions', '/crm/events', '/crm/notices']);
export const sessionAttendanceForm = async (fd: FormData) => plain(async () => SE.markAttended(await requireStaff(), req(fd, 'sessionId', 'Session'), fd.getAll('present').map(String)), ['/crm/sessions']);
export const setRecordingAction = async (_: ActionState, fd: FormData) => run(async () => { await SE.setRecording(await requireStaff(), req(fd, 'sessionId', 'Session'), req(fd, 'path', 'Recording link')); return 'Recording saved (visible to registered students and parents).'; }, ['/crm/sessions']);

// ---------------------------------------------------------------- wellbeing
export const counsellorNoteAction = async (_: ActionState, fd: FormData) => run(async () => { await W.addCounsellorNote(await requireStaff(), req(fd, 'studentId', 'Student'), req(fd, 'note', 'Note')); return 'Private note saved.'; }, ['/crm/wellbeing']);
export const answerAnonAction = async (_: ActionState, fd: FormData) => run(async () => { await W.answerAnon(await requireStaff(), req(fd, 'id', 'Question'), req(fd, 'answer', 'Answer')); return 'Answer posted. The student sees it with their ticket.'; }, ['/crm/wellbeing']);
export const bookingStatusForm = async (fd: FormData) => plain(async () => W.setBookingStatus(await requireStaff(), req(fd, 'id', 'Booking'), req(fd, 'status', 'Status') as 'confirmed' | 'done' | 'cancelled'), ['/crm/wellbeing']);
export const flagForm = async (fd: FormData) => plain(async () => W.flagStudent(await requireStaff(), req(fd, 'studentId', 'Student'), req(fd, 'status', 'Status') as 'needs_conversation' | 'resolved'), ['/crm/wellbeing', '/crm/mentor']);
export const alertStatusForm = async (fd: FormData) => plain(async () => W.updateAlert(await requireStaff(), req(fd, 'id', 'Alert'), req(fd, 'status', 'Status') as 'acknowledged' | 'closed'), ['/crm/wellbeing']);
export const saveHelplineAction = async (_: ActionState, fd: FormData) => run(async () => { await W.saveHelpline(await requireStaff(), { name: req(fd, 'name', 'Name'), number: req(fd, 'number', 'Number'), hours: s(fd, 'hours'), note: s(fd, 'note') }); return 'Helpline saved.'; }, ['/crm/wellbeing']);
export const removeHelplineForm = async (fd: FormData) => plain(async () => W.removeHelpline(await requireStaff(), req(fd, 'id', 'Helpline')), ['/crm/wellbeing']);

// ---------------------------------------------------------------- open-book
export const addObQuestionAction = async (_: ActionState, fd: FormData) =>
  run(async () => { await OB.addQuestion(await requireStaff(), { subject: req(fd, 'subject', 'Subject'), chapter: req(fd, 'chapter', 'Chapter'), kind: req(fd, 'kind', 'Type'), answerType: req(fd, 'answerType', 'Answer type'), text: req(fd, 'text', 'Question'), modelAnswer: req(fd, 'modelAnswer', 'Model answer') }); return 'Question added with the default rubric.'; }, ['/crm/open-book']);
export const createObAssignmentForm = async (fd: FormData) =>
  plain(async () => {
    const opens = req(fd, 'opensAt', 'Opens');
    const closes = req(fd, 'closesAt', 'Closes');
    await OB.createAssignment(await requireStaff(), {
      batchId: req(fd, 'batchId', 'Batch'), title: req(fd, 'title', 'Title'), subject: req(fd, 'subject', 'Subject'), questionIds: fd.getAll('questionIds').map(String), perStudent: Number(s(fd, 'perStudent') ?? 3),
      resources: { ownNotes: fd.get('ownNotes') === 'on', ncert: fd.get('ncert') === 'on', formulaSheet: fd.get('formulaSheet') === 'on', calculator: fd.get('calculator') === 'on', internet: fd.get('internet') === 'on' },
      durationMin: Number(s(fd, 'durationMin') ?? 60), opensAt: new Date(`${opens}:00+05:30`).toISOString(), closesAt: new Date(`${closes}:00+05:30`).toISOString(),
    });
  }, ['/crm/open-book']);
export const suggestMarksForm = async (fd: FormData) => plain(async () => OB.suggestMarks(await requireStaff(), req(fd, 'attemptId', 'Attempt')), ['/crm/open-book']);
export const confirmMarksForm = async (fd: FormData) =>
  plain(async () => {
    const marks: Record<string, Record<string, number>> = {};
    for (const [k, v] of fd.entries()) {
      const m = /^m:([^:]+):(.+)$/.exec(k);
      if (m && typeof v === 'string') (marks[m[1]] ??= {})[m[2]] = Number(v);
    }
    await OB.confirmMarks(await requireStaff(), req(fd, 'attemptId', 'Attempt'), marks, s(fd, 'feedback'));
  }, ['/crm/open-book']);
export const postBigQuestionAction = async (_: ActionState, fd: FormData) => run(async () => { await OB.postBigQuestion(await requireStaff(), req(fd, 'subject', 'Subject'), req(fd, 'text', 'Question')); return 'Big question posted for this week.'; }, ['/crm/open-book']);
export const featureForm = async (fd: FormData) => plain(async () => OB.featureAnswer(await requireStaff(), req(fd, 'id', 'Answer'), fd.get('featured') === '1'), ['/crm/open-book']);

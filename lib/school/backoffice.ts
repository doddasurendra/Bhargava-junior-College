import 'server-only';
import { can } from '../crm/permissions';
import type { Staff } from '../crm/types';
import { addDays, todayIST } from '../dates';
import { events, homework, libraryBooks, libraryLoans } from '../records/collections';
import { allBatches, canTeachBatch, myBatchIds, SchoolError, store, studentsById, visibleStudentIds } from './common';

/** Back-office modules (Gurukul/Raion baseline): library, events calendar, homework. */

const need = (ok: boolean, msg = 'You do not have permission to do this.') => {
  if (!ok) throw new SchoolError(msg);
};

// ---------------------------------------------------------------- pure rules (tested)

/** Copies still on the shelf. */
export function availableCopies(copies: number, loans: { returnedOn: string | null }[]) {
  return copies - loans.filter((l) => !l.returnedOn).length;
}

/** Whole days a loan is late on `today` (0 if returned or not yet due). */
export function daysOverdue(loan: { dueOn: string; returnedOn: string | null }, today: string) {
  if (loan.returnedOn || loan.dueOn >= today) return 0;
  return Math.round((Date.parse(today) - Date.parse(loan.dueOn)) / 86_400_000);
}

/** Events on or after `from`, soonest first; multi-day events stay listed until their last day. */
export function upcoming<T extends { date: string; endDate: string | null }>(list: T[], from: string) {
  return list.filter((e) => (e.endDate ?? e.date) >= from).sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------- library

export const LOAN_DAYS = 14;

export async function libraryOverview(user: Staff, today = todayIST()) {
  need(can(user, 'library.manage') || can(user, 'students.view'));
  const [books, loans, byId] = await Promise.all([libraryBooks.list(store()), libraryLoans.list(store()), studentsById()]);
  const rows = books
    .map((b) => {
      const mine = loans.filter((l) => l.data.bookId === b.id).map((l) => l.data);
      return { id: b.id, ...b.data, available: availableCopies(b.data.copies, mine) };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
  const out = loans
    .filter((l) => !l.data.returnedOn)
    .map((l) => ({ id: l.id, ...l.data, book: books.find((b) => b.id === l.data.bookId)?.data.title ?? 'Unknown book', student: byId.get(l.data.studentId) ?? null, late: daysOverdue(l.data, today) }))
    .sort((a, b) => b.late - a.late || a.dueOn.localeCompare(b.dueOn));
  return { books: rows, out, students: [...byId.values()].sort((a, b) => a.fullName.localeCompare(b.fullName)) };
}

export async function addBook(user: Staff, input: { title: string; author: string | null; subject: string | null; isbn: string | null; shelf: string | null; copies: number }) {
  need(can(user, 'library.manage'));
  await libraryBooks.put(store(), input);
  return `Added “${input.title}”.`;
}

export async function issueBook(user: Staff, bookId: string, studentId: string, today = todayIST()) {
  need(can(user, 'library.manage'));
  const [book, byId, loans] = await Promise.all([libraryBooks.get(store(), bookId), studentsById(), libraryLoans.list(store(), { k1: bookId })]);
  if (!book) throw new SchoolError('Book not found.');
  const s = byId.get(studentId);
  if (!s) throw new SchoolError('Student not found.');
  if (availableCopies(book.data.copies, loans.map((l) => l.data)) <= 0) throw new SchoolError('No copies of this book are available.');
  if (loans.some((l) => l.data.studentId === studentId && !l.data.returnedOn)) throw new SchoolError(`${s.fullName} already has this book.`);
  await libraryLoans.put(store(), { bookId, studentId, issuedOn: today, dueOn: addDays(today, LOAN_DAYS), returnedOn: null, issuedBy: user.id });
  return `Issued to ${s.fullName}, due back in ${LOAN_DAYS} days.`;
}

export async function returnBook(user: Staff, loanId: string, today = todayIST()) {
  need(can(user, 'library.manage'));
  const loan = await libraryLoans.get(store(), loanId);
  if (!loan) throw new SchoolError('Loan not found.');
  if (loan.data.returnedOn) throw new SchoolError('This book has already been returned.');
  await libraryLoans.put(store(), { ...loan.data, returnedOn: today }, loan.id);
  return 'Returned.';
}

// ---------------------------------------------------------------- events calendar

export async function listEvents(today = todayIST()) {
  const all = (await events.list(store())).map((e) => ({ id: e.id, ...e.data }));
  return { upcoming: upcoming(all, today), past: all.filter((e) => (e.endDate ?? e.date) < today).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20) };
}

export async function addEvent(user: Staff, input: { title: string; date: string; endDate: string | null; kind: string; audience: string; location: string | null; note: string | null }) {
  need(can(user, 'events.manage'));
  if (input.endDate && input.endDate < input.date) throw new SchoolError('The end date is before the start date.');
  await events.put(store(), { ...input, createdBy: user.id });
  return `Added “${input.title}” to the calendar.`;
}

export async function removeEvent(user: Staff, id: string) {
  need(can(user, 'events.manage'));
  await events.remove(store(), id);
  return 'Removed.';
}

// ---------------------------------------------------------------- homework

/** Batches this user can set homework for: heads see all, teachers their own. */
export async function homeworkBatches(user: Staff) {
  need(can(user, 'homework.assign') || can(user, 'students.view'));
  const all = (await allBatches()).filter((b) => b.data.active);
  if (can(user, 'academics.manage')) return all;
  const mine = await myBatchIds(user);
  return all.filter((b) => mine.has(b.id));
}

export async function listHomework(user: Staff, today = todayIST()) {
  const batches = await homeworkBatches(user);
  const ids = new Set(batches.map((b) => b.id));
  const items = (await homework.list(store())).filter((h) => ids.has(h.data.batchId)).map((h) => ({ id: h.id, ...h.data, batch: batches.find((b) => b.id === h.data.batchId)?.data.name ?? '' }));
  return {
    batches,
    open: items.filter((h) => h.dueOn >= today).sort((a, b) => a.dueOn.localeCompare(b.dueOn)),
    past: items.filter((h) => h.dueOn < today).sort((a, b) => b.dueOn.localeCompare(a.dueOn)).slice(0, 30),
  };
}

export async function setHomework(user: Staff, input: { batchId: string; subject: string; title: string; details: string | null; dueOn: string }, today = todayIST()) {
  need(can(user, 'homework.assign'));
  if (!(await canTeachBatch(user, input.batchId))) throw new SchoolError('You don’t teach this batch.');
  if (input.dueOn < today) throw new SchoolError('The due date is in the past.');
  await homework.put(store(), { ...input, setBy: user.id, setOn: today });
  return `Homework set for ${input.dueOn}.`;
}

export async function removeHomework(user: Staff, id: string) {
  const h = await homework.get(store(), id);
  if (!h) throw new SchoolError('Not found.');
  need(can(user, 'academics.manage') || h.data.setBy === user.id, 'Only the teacher who set it can remove it.');
  await homework.remove(store(), id);
  return 'Removed.';
}

/** For exports: students the user may see. */
export async function exportableStudents(user: Staff) {
  const [byId, vis] = await Promise.all([studentsById(), visibleStudentIds(user)]);
  return [...byId.values()].filter((s) => vis === 'all' || vis.has(s.id));
}

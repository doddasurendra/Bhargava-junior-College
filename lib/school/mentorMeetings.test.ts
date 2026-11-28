import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

let dir: string, cwd: string;
beforeAll(() => { cwd = process.cwd(); dir = mkdtempSync(path.join(tmpdir(), 'bjc-mm-')); process.chdir(dir); delete process.env.SUPABASE_URL; });
afterAll(() => { process.chdir(cwd); rmSync(dir, { recursive: true, force: true }); });

const mentor = { id: 'staff-m1', fullName: 'Mentor One', email: null, phone: null, roles: ['class_teacher' as const], active: true };
const other = { ...mentor, id: 'staff-m2', fullName: 'Mentor Two' };
const coach = { ...mentor, id: 'staff-coach', roles: ['sports_coach' as const] };

describe('mentor meetings and in-app reminders', () => {
  it('request → schedule → held with private outcome; family sees shared outcome only; reminders list today/tomorrow items', async () => {
    const C = await import('../records/collections');
    const { getRecordStore } = await import('../records');
    const M = await import('./mentorMeetings');
    const R = await import('../app/reminders');
    const AC = await import('../studentLife/activities');
    const { todayIST, addDays } = await import('../dates');
    const t = todayIST();
    const b = await C.batches.put(getRecordStore(), { name: 'JEE-1A', program: 'iit-jee', year: 1, section: 'A', capacity: 40, classTeacherId: mentor.id, studentIds: ['s1', 's2'], active: true });
    await C.mentorships.put(getRecordStore(), { mentorId: mentor.id, studentId: 's1' });

    await expect(M.requestMeeting('s2', 'help')).rejects.toThrow(/No mentor/);
    const req = await M.requestMeeting('s1', 'Physics marks are falling');
    await expect(M.requestMeeting('s1', 'again')).rejects.toThrow(/already have a request/);
    await expect(M.setMeetingTime(other, req.id, t, '16:00', 'in_person')).rejects.toThrow(/another mentor/);
    await expect(M.setMeetingTime(mentor, req.id, addDays(t, -1), '16:00', 'in_person')).rejects.toThrow(/from today/);
    await M.setMeetingTime(mentor, req.id, t, '16:00', 'online');
    await expect(M.scheduleMeeting(coach, { studentId: 's1', date: t, time: '10:00', mode: 'phone', agenda: '' })).rejects.toThrow(/Only mentors/);
    const later = await M.scheduleMeeting(mentor, { studentId: 's1', date: addDays(t, 1), time: '09:30', mode: 'in_person', agenda: 'Goal setting' });
    expect((await M.myMeetings(mentor)).upcoming.map((m) => m.id)).toEqual([req.id, later.id]);

    // reminders: the mentor meeting today and tomorrow, plus a registered yoga class
    const yoga = await AC.createProgram(coach, { title: 'Morning yoga', kind: 'yoga', instructor: 'Ms. L', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], time: '06:30', durationMin: 45, venue: 'Hall', audience: `batch:${b.id}`, capacity: 10, startDate: t, endDate: null, description: null, videoUrl: null });
    await AC.toggleRegistration('s1', yoga.id);
    const rem = await R.comingUp({ kind: 'student', studentId: 's1', phone: null });
    expect(rem.filter((r) => r.title === 'Meeting with your mentor')).toHaveLength(2);
    expect(rem.filter((r) => r.title === 'Morning yoga')).toHaveLength(2);
    expect(rem[0]).toMatchObject({ date: t, time: '06:30' }); // sorted by date and time
    expect(await R.comingUp({ kind: 'student', studentId: 's2', phone: null })).toEqual([]);

    await expect(M.closeMeeting(mentor, later.id, 'held', 'x', false)).rejects.toThrow(/on or after/);
    await expect(M.closeMeeting(mentor, req.id, 'held', '', false)).rejects.toThrow(/short outcome/);
    await M.closeMeeting(mentor, req.id, 'held', 'Plan: 2 extra physics problem sets a week', false);
    await M.closeMeeting(mentor, later.id, 'cancelled', null, false);
    const fam = await M.studentMeetings('s1');
    expect(fam.past.find((m) => m.id === req.id)!.outcome).toBeNull(); // not shared
    const notes = await C.mentorNotes.list(getRecordStore(), { k1: 's1' });
    expect(notes.map((n) => n.data)).toEqual([expect.objectContaining({ kind: 'one_to_one', shareWithParent: false, note: 'Plan: 2 extra physics problem sets a week' })]);
    await expect(M.closeMeeting(mentor, req.id, 'missed', null, false)).rejects.toThrow(/already closed/);

    const shared = await M.scheduleMeeting(mentor, { studentId: 's1', date: t, time: '17:00', mode: 'phone', agenda: '' });
    await M.closeMeeting(mentor, shared.id, 'held', 'Doing well', true);
    expect((await M.studentMeetings('s1')).past.find((m) => m.id === shared.id)!.outcome).toBe('Doing well');
  });
});

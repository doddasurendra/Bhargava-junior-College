import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

let dir: string, cwd: string;
beforeAll(() => { cwd = process.cwd(); dir = mkdtempSync(path.join(tmpdir(), 'bjc-act-')); process.chdir(dir); delete process.env.SUPABASE_URL; });
afterAll(() => { process.chdir(cwd); rmSync(dir, { recursive: true, force: true }); });

const coach = { id: 'staff-coach', fullName: 'Coach', email: null, phone: null, roles: ['sports_coach' as const], active: true };
const principal = { ...coach, id: 'staff-p', roles: ['principal' as const] };
const telecaller = { ...coach, id: 'staff-t', roles: ['telecaller' as const] };

describe('activity programs (yoga, wellness, practice)', () => {
  it('weekday maths, registration rules, attendance rules, private portal view, aggregate report, permissions', async () => {
    const A = await import('./activities');
    const C = await import('../records/collections');
    const { getRecordStore } = await import('../records');
    const { todayIST, addDays } = await import('../dates');
    expect(A.weekdayOf('2026-11-30')).toBe('mon');
    expect(A.weekdayOf('2026-11-29')).toBe('sun');
    expect(A.occurrences({ days: ['mon', 'wed'], startDate: '2026-11-30', endDate: '2026-12-09' }, '2026-11-01', '2026-12-31')).toEqual(['2026-11-30', '2026-12-02', '2026-12-07', '2026-12-09']);

    const a = await C.batches.put(getRecordStore(), { name: 'JEE-1A', program: 'iit-jee', year: 1, section: 'A', capacity: 40, classTeacherId: null, studentIds: ['s1', 's2'], active: true });
    await C.batches.put(getRecordStore(), { name: 'NEET-1A', program: 'neet', year: 1, section: 'A', capacity: 40, classTeacherId: null, studentIds: ['s3'], active: true });
    const t = todayIST();
    const allDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const base = { title: 'Morning yoga', kind: 'yoga', instructor: 'Ms. Lakshmi', time: '06:30', durationMin: 45, venue: 'Yoga hall', capacity: 2, startDate: addDays(t, -7), endDate: null, description: null, videoUrl: null };
    await expect(A.createProgram(principal, { ...base, days: allDays, audience: 'all_students' })).rejects.toThrow(/Sports Coach/);
    await expect(A.createProgram(coach, { ...base, days: [], audience: 'all_students' })).rejects.toThrow(/at least one day/);
    await expect(A.createProgram(coach, { ...base, days: allDays, audience: 'all_students', videoUrl: 'javascript:alert(1)' })).rejects.toThrow(/https/);
    const yoga = await A.createProgram(coach, { ...base, days: allDays, audience: 'all_students' });
    const batchOnly = await A.createProgram(coach, { ...base, title: 'JEE breathing', kind: 'breathing', days: allDays, audience: `batch:${a.id}` });

    expect(await A.toggleRegistration('s1', yoga.id)).toBe('registered');
    expect(await A.toggleRegistration('s3', yoga.id)).toBe('registered');
    await expect(A.toggleRegistration('s2', yoga.id)).rejects.toThrow(/full/);
    await expect(A.toggleRegistration('s3', batchOnly.id)).rejects.toThrow(/another batch/);
    expect(await A.toggleRegistration('s3', yoga.id)).toBe('cancelled');
    expect(await A.toggleRegistration('s2', yoga.id)).toBe('registered');

    await expect(A.markProgramAttendance(coach, yoga.id, addDays(t, 1), ['s1'])).rejects.toThrow(/future/);
    await expect(A.markProgramAttendance(principal, yoga.id, t, ['s1'])).rejects.toThrow(/Sports Coach/);
    const r = await A.markProgramAttendance(coach, yoga.id, t, ['s1', 's3', 's1']); // s3 not registered, s1 duplicated
    expect(r.data.present).toEqual(['s1']);
    await A.markProgramAttendance(coach, yoga.id, addDays(t, -1), ['s1', 's2']);

    const mine = (await A.portalPrograms('s2')).find((p) => p.id === yoga.id)!;
    expect(mine).toMatchObject({ registered: true, attended: 1, classesHeld: 2 });
    expect(mine).not.toHaveProperty('students');
    expect((await A.portalPrograms('s3')).map((p) => p.id)).not.toContain(batchOnly.id);

    const rep = await A.programReport(principal, addDays(t, -30), t);
    expect(rep.participants).toBe(2);
    expect(rep.rows.find((x) => x.id === yoga.id)).toMatchObject({ registered: 2, held: 2, presentTotal: 3, avgAttendance: 75 });
    await expect(A.programReport(telecaller, t, t)).rejects.toThrow(/permission/);
    const staffView = await A.staffPrograms(principal);
    expect(staffView.find((p) => p.id === yoga.id)!.students).toEqual([]); // viewers get counts, not names
    expect((await A.programsForAssistant()).join('\n')).toContain('Morning yoga');

    await A.setProgramActive(coach, yoga.id, false);
    await expect(A.toggleRegistration('s3', yoga.id)).rejects.toThrow(/not open/);
  });
});

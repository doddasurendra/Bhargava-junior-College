import 'server-only';
import type { Staff } from '../crm/types';
import { parseCsv } from '../crm/csv';
import { excelSerialToIso, readXlsxRows, XlsxError } from '../crm/xlsx';
import { getRecordStore } from '../records';
import { studentImports } from '../records/collections';
import { addStudent, canManageSignups, validateNewStudent } from './pendingAdmin';
import { getAppStore } from './service';
import { normCollegeId, normDob, StudentAccountError } from './studentAccount';

/**
 * Admin Office import of real student records (Excel .xlsx or CSV). The whole file is checked first: missing
 * required columns stop the import before anything is written. Each valid row is then written atomically by the
 * database (lead + student + guardian in one transaction); a row whose College ID already exists is skipped, so
 * importing the same file twice never creates duplicates. Pending sign-ups that match a new record are linked
 * and activated; the rest become conflicts. A report is saved for every import.
 */
export const IMPORT_COLUMNS = ['college_id', 'full_name', 'dob', 'gender', 'program', 'stay', 'guardian_name', 'guardian_phone'] as const;
const ALIASES: Record<string, (typeof IMPORT_COLUMNS)[number] | 'relation'> = {
  college_id: 'college_id', collegeid: 'college_id', admission_no: 'college_id', admission_number: 'college_id', 'college id': 'college_id', 'admission no': 'college_id',
  full_name: 'full_name', name: 'full_name', student_name: 'full_name', 'student name': 'full_name', 'full name': 'full_name',
  dob: 'dob', date_of_birth: 'dob', 'date of birth': 'dob',
  gender: 'gender', sex: 'gender',
  program: 'program', programme: 'program', course: 'program',
  stay: 'stay', hostel: 'stay', 'day/hostel': 'stay',
  guardian_name: 'guardian_name', parent_name: 'guardian_name', 'parent name': 'guardian_name', 'guardian name': 'guardian_name', father_name: 'guardian_name',
  guardian_phone: 'guardian_phone', parent_phone: 'guardian_phone', 'parent mobile': 'guardian_phone', mobile: 'guardian_phone', phone: 'guardian_phone', 'guardian phone': 'guardian_phone',
  relation: 'relation',
};
const PROGRAMS: Record<string, string> = { 'iit-jee': 'iit-jee', jee: 'iit-jee', mpc: 'iit-jee', 'iit jee': 'iit-jee', neet: 'neet', bipc: 'neet', 'long-term-jee': 'long-term-jee', 'long term jee': 'long-term-jee', 'long-term-neet': 'long-term-neet', 'long term neet': 'long-term-neet' };

export interface ImportReport { id: string; total: number; created: number; linked: number; conflicts: number; existing: number; failed: number; rows: { row: number; collegeId: string; outcome: string; note: string }[] }

export function parseStudentFile(fileName: string, bytes: Buffer): string[][] {
  if (/\.xlsx$/i.test(fileName)) return readXlsxRows(bytes);
  if (/\.(csv|txt)$/i.test(fileName)) { const c = parseCsv(bytes.toString('utf8').replace(/^﻿/, '')); return [c.headers, ...c.rows]; }
  throw new StudentAccountError('Upload an Excel (.xlsx) or CSV file.');
}

export async function importStudents(u: Staff, fileName: string, bytes: Buffer): Promise<ImportReport> {
  if (!canManageSignups(u)) throw new StudentAccountError('Only the admin office can import students.');
  let table: string[][];
  try {
    table = parseStudentFile(fileName, bytes).filter((r) => r.some((c) => String(c ?? '').trim()));
  } catch (e) {
    if (e instanceof XlsxError || e instanceof StudentAccountError) throw new StudentAccountError(e.message);
    throw new StudentAccountError('The file could not be read. Save it as .xlsx or .csv and try again.');
  }
  if (table.length < 2) throw new StudentAccountError('The file has no student rows under the header row.');
  const header = table[0].map((h) => ALIASES[String(h).trim().toLowerCase().replace(/\s+/g, ' ')] ?? ALIASES[String(h).trim().toLowerCase().replace(/\s+/g, '_')] ?? null);
  const missing = IMPORT_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) throw new StudentAccountError(`Missing column(s): ${missing.join(', ')}. Nothing was imported.`);
  if (table.length - 1 > 5000) throw new StudentAccountError('Import at most 5 000 students per file.');

  const col = (r: string[], k: string) => String(r[header.indexOf(k as never)] ?? '').trim();
  const seen = new Set<string>();
  const report: Omit<ImportReport, 'id'> = { total: table.length - 1, created: 0, linked: 0, conflicts: 0, existing: 0, failed: 0, rows: [] };
  for (let i = 1; i < table.length; i++) {
    const r = table[i];
    const cid = normCollegeId(col(r, 'college_id'));
    const rawDob = col(r, 'dob');
    const dob = excelSerialToIso(rawDob) ?? normDob(rawDob) ?? rawDob;
    const program = PROGRAMS[col(r, 'program').toLowerCase()] ?? col(r, 'program').toLowerCase();
    const gender = ({ m: 'male', f: 'female', boy: 'male', girl: 'female' } as Record<string, string>)[col(r, 'gender').toLowerCase()] ?? col(r, 'gender').toLowerCase();
    const stay = /hostel/i.test(col(r, 'stay')) ? 'hostel' : /day/i.test(col(r, 'stay')) || !col(r, 'stay') ? 'day' : col(r, 'stay').toLowerCase();
    if (seen.has(cid)) { report.failed++; report.rows.push({ row: i + 1, collegeId: cid, outcome: 'failed', note: 'Duplicate College ID in this file' }); continue; }
    seen.add(cid);
    try {
      const input = validateNewStudent({ collegeId: cid, fullName: col(r, 'full_name'), dob, gender, program, stay, guardianName: col(r, 'guardian_name'), guardianPhone: col(r, 'guardian_phone'), relation: header.includes('relation' as never) ? col(r, 'relation') : undefined });
      if (await getAppStore().studentByCollegeId(input.collegeId)) { report.existing++; report.rows.push({ row: i + 1, collegeId: cid, outcome: 'existing', note: 'Already in the college records (skipped)' }); continue; }
      const res = await addStudent(u, input);
      report.created++;
      report.linked += res.linked;
      report.conflicts += res.conflicts;
      report.rows.push({ row: i + 1, collegeId: cid, outcome: res.linked ? 'linked' : res.conflicts ? 'conflict' : 'created', note: res.linked ? 'Created and linked to a pending sign-up (now active)' : res.conflicts ? 'Created; a pending sign-up with other details went to Conflicts' : 'Created' });
    } catch (e) {
      report.failed++;
      report.rows.push({ row: i + 1, collegeId: cid, outcome: 'failed', note: e instanceof StudentAccountError ? e.message : 'Could not be saved' });
      if (!(e instanceof StudentAccountError)) console.error('[student-import] row failed', i + 1, (e as Error).message);
    }
  }
  const saved = await studentImports.put(getRecordStore(), { at: new Date().toISOString(), by: u.fullName, fileName: fileName.slice(0, 200), ...report });
  return { id: saved.id, ...report };
}

export async function recentImports() {
  return (await studentImports.list(getRecordStore())).map((r) => ({ id: r.id, ...r.data })).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10);
}

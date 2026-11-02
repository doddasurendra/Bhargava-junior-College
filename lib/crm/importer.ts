/** Lead import: column mapping, normalisation, validation and in-file de-duplication (brief §7.1 step 1). Pure. */
import type { ProgramSlug } from '@/content/programs';
import { normalizeIndianMobile } from '../phone';

export const MAX_IMPORT_ROWS = 5000;

export const IMPORT_SOURCES = [
  { value: 'school_data', label: 'School data collection' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'referral', label: 'Referral' },
  { value: 'phone_in', label: 'Phone-in' },
  { value: 'social_ads', label: 'Social ads' },
  { value: 'other_import', label: 'Other' },
] as const;
export type ImportSource = (typeof IMPORT_SOURCES)[number]['value'];

export const IMPORT_FIELDS = [
  { key: 'studentName', label: 'Student name', synonyms: ['student', 'student name', 'name of student', 'candidate', 'pupil', 'name'] },
  { key: 'parentName', label: 'Parent name', synonyms: ['parent', 'parent name', 'father', 'father name', 'mother', 'guardian'] },
  { key: 'phone', label: 'Parent phone', synonyms: ['parent phone', 'parent mobile', 'father mobile', 'phone', 'mobile', 'contact', 'contact number', 'mobile number', 'phone number'] },
  { key: 'studentPhone', label: 'Student phone', synonyms: ['student phone', 'student mobile', 'student contact'] },
  { key: 'school', label: 'School', synonyms: ['school', 'school name', 'institution'] },
  { key: 'classLevel', label: 'Class', synonyms: ['class', 'grade', 'standard', 'std'] },
  { key: 'board', label: 'Board', synonyms: ['board', 'syllabus', 'curriculum'] },
  { key: 'area', label: 'Area', synonyms: ['area', 'location', 'locality', 'village', 'town', 'city', 'address'] },
  { key: 'program', label: 'Interested program', synonyms: ['program', 'programme', 'course', 'interest', 'group', 'stream'] },
  { key: 'note', label: 'Notes', synonyms: ['note', 'notes', 'remarks', 'comments'] },
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number]['key'];
export type Mapping = Partial<Record<ImportField, number | null>>;

const clean = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

/** Best guess of which column holds which field, preferring exact header matches over partial ones. */
export function guessMapping(headers: string[]): Mapping {
  const h = headers.map(clean);
  const used = new Set<number>();
  const out: Mapping = {};
  // Specific fields first so "Student phone" doesn't get taken by "phone".
  const order: ImportField[] = ['studentPhone', 'parentName', 'studentName', 'phone', 'school', 'classLevel', 'board', 'area', 'program', 'note'];
  for (const key of order) {
    const syn = IMPORT_FIELDS.find((f) => f.key === key)!.synonyms.map(clean);
    let idx = h.findIndex((x, i) => !used.has(i) && syn.includes(x));
    if (idx < 0) idx = h.findIndex((x, i) => !used.has(i) && x !== '' && syn.some((s) => s.length > 3 && x.includes(s)));
    if (idx >= 0) {
      out[key] = idx;
      used.add(idx);
    }
  }
  return out;
}

export function normalizeProgram(raw: string | undefined | null): ProgramSlug | null {
  const s = (raw ?? '').toLowerCase();
  if (!s.trim()) return null;
  const longTerm = /long\s*term|repeat|repeater|\blt\b/.test(s);
  const medical = /neet|bipc|medical|mbbs|bio/.test(s);
  const engineering = /jee|iit|mpc|engineer|eamcet|maths/.test(s);
  if (medical && !engineering) return longTerm ? 'long-term-neet' : 'neet';
  if (engineering && !medical) return longTerm ? 'long-term-jee' : 'iit-jee';
  return null;
}

const titleCase = (s: string) => s.replace(/\s+/g, ' ').trim().replace(/\b([a-z])/g, (m) => m.toUpperCase());

export interface ImportRecord {
  /** 1-based line in the file (header = line 1) of the first row for this phone */
  line: number;
  phone: string;
  studentPhone: string | null;
  studentName: string | null;
  parentName: string | null;
  school: string | null;
  classLevel: string | null;
  board: string | null;
  area: string | null;
  program: ProgramSlug | null;
  note: string | null;
}

export interface RejectedRow {
  line: number;
  reason: string;
  raw: string[];
}

export interface ImportDefaults {
  school?: string | null;
  program?: ProgramSlug | null;
}

export interface BuildResult {
  records: ImportRecord[];
  rejected: RejectedRow[];
  /** rows merged into an earlier row with the same phone */
  duplicatesInFile: number;
  totalRows: number;
}

export function validateMapping(m: Mapping, columnCount: number): string | null {
  for (const [k, v] of Object.entries(m)) {
    if (v === null || v === undefined) continue;
    if (!Number.isInteger(v) || v < 0 || v >= columnCount) return `Column for ${k} is out of range.`;
  }
  if (m.phone == null && m.studentPhone == null) return 'Map a parent phone or student phone column.';
  if (m.studentName == null && m.parentName == null) return 'Map a student name or parent name column.';
  const cols = Object.values(m).filter((v) => v !== null && v !== undefined);
  if (new Set(cols).size !== cols.length) return 'Each column can be mapped to only one field.';
  return null;
}

export function buildRecords(rows: string[][], mapping: Mapping, defaults: ImportDefaults = {}): BuildResult {
  const get = (r: string[], k: ImportField) => {
    const i = mapping[k];
    return i === null || i === undefined ? '' : (r[i] ?? '').trim();
  };
  const byPhone = new Map<string, ImportRecord>();
  const rejected: RejectedRow[] = [];
  let duplicatesInFile = 0;

  rows.forEach((r, idx) => {
    const line = idx + 2;
    const parentPhone = normalizeIndianMobile(get(r, 'phone'));
    const studentPhoneRaw = get(r, 'studentPhone');
    const studentPhone = normalizeIndianMobile(studentPhoneRaw);
    const phone = parentPhone ?? studentPhone;
    const studentName = get(r, 'studentName');
    const parentName = get(r, 'parentName');

    if (!phone) {
      const given = get(r, 'phone') || studentPhoneRaw;
      rejected.push({ line, reason: given ? `Invalid mobile number "${given}"` : 'No mobile number', raw: r });
      return;
    }
    if (!studentName && !parentName) {
      rejected.push({ line, reason: 'No student or parent name', raw: r });
      return;
    }

    const rec: ImportRecord = {
      line,
      phone,
      studentPhone: studentPhone && studentPhone !== phone ? studentPhone : null,
      studentName: studentName ? titleCase(studentName).slice(0, 80) : null,
      parentName: parentName ? titleCase(parentName).slice(0, 80) : null,
      school: (get(r, 'school') || defaults.school || '').slice(0, 120) || null,
      classLevel: get(r, 'classLevel').slice(0, 40) || null,
      board: get(r, 'board').slice(0, 40) || null,
      area: get(r, 'area').slice(0, 80) || null,
      program: normalizeProgram(get(r, 'program')) ?? defaults.program ?? null,
      note: get(r, 'note').slice(0, 300) || null,
    };

    const existing = byPhone.get(phone);
    if (existing) {
      duplicatesInFile++;
      // Keep the first row, fill its blanks from the duplicate.
      for (const k of Object.keys(rec) as (keyof ImportRecord)[]) {
        if (k === 'line') continue;
        if (existing[k] === null && rec[k] !== null) (existing as unknown as Record<string, unknown>)[k] = rec[k];
      }
      return;
    }
    byPhone.set(phone, rec);
  });

  return { records: Array.from(byPhone.values()), rejected, duplicatesInFile, totalRows: rows.length };
}

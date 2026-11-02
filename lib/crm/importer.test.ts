import { describe, expect, it } from 'vitest';
import { detectDelimiter, parseCsv, toCsv } from './csv';
import { buildRecords, guessMapping, normalizeProgram, validateMapping } from './importer';

describe('csv', () => {
  it('handles BOM, quotes, escaped quotes, embedded newlines, CRLF and blank lines', () => {
    const text = '﻿Name,Phone,Note\r\n"Rao, K",98765 43210,"said ""call later""\nafter 6"\r\n\r\nPriya,9000000001,\n';
    const { headers, rows } = parseCsv(text);
    expect(headers).toEqual(['Name', 'Phone', 'Note']);
    expect(rows).toEqual([
      ['Rao, K', '98765 43210', 'said "call later"\nafter 6'],
      ['Priya', '9000000001', ''],
    ]);
  });
  it('detects semicolon and tab delimiters (European Excel, copy-paste)', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(detectDelimiter('a\tb\n1\t2')).toBe('\t');
    expect(parseCsv('a;b\n1;2').rows).toEqual([['1', '2']]);
  });
  it('escapes formula injection on export', () => {
    expect(toCsv([['=HYPERLINK("x")', 'ok', '+91 9']])).toBe(`"'=HYPERLINK(""x"")",ok,'+91 9`);
  });
});

describe('mapping', () => {
  it('guesses common school-data headers', () => {
    const m = guessMapping(['S.No', 'Student Name', "Father's Name", 'Mobile No', 'Student Mobile', 'School', 'Class', 'Village', 'Group']);
    expect(m).toMatchObject({ studentName: 1, parentName: 2, phone: 3, studentPhone: 4, school: 5, classLevel: 6, area: 7, program: 8 });
  });
  it('validates required and duplicate columns', () => {
    expect(validateMapping({ studentName: 0 }, 3)).toMatch(/phone/);
    expect(validateMapping({ phone: 1 }, 3)).toMatch(/name/);
    expect(validateMapping({ phone: 1, studentName: 1 }, 3)).toMatch(/only one/);
    expect(validateMapping({ phone: 7, studentName: 0 }, 3)).toMatch(/range/);
    expect(validateMapping({ phone: 1, studentName: 0 }, 3)).toBeNull();
  });
  it('normalises program text', () => {
    expect(normalizeProgram('MPC')).toBe('iit-jee');
    expect(normalizeProgram('BiPC / NEET')).toBe('neet');
    expect(normalizeProgram('Long term NEET')).toBe('long-term-neet');
    expect(normalizeProgram('IIT repeater')).toBe('long-term-jee');
    expect(normalizeProgram('MPC or BiPC')).toBeNull();
    expect(normalizeProgram('')).toBeNull();
  });
});

describe('buildRecords', () => {
  const mapping = { studentName: 0, phone: 1, studentPhone: 2, school: 3, program: 4 };
  it('validates, normalises, falls back to student phone and merges in-file duplicates', () => {
    const rows = [
      ['ravi teja', '98765 43210', '', '', 'MPC'],
      ['RAVI TEJA', '+91 98765-43210', '9000000002', 'ZPHS Saroornagar', ''],
      ['No Phone', '', '', '', ''],
      ['Bad Phone', '12345', '', '', ''],
      ['', '9000000003', '', '', ''],
      ['Keerthi', 'n/a', '9000000004', '', 'bipc'],
    ];
    const r = buildRecords(rows, mapping, { school: 'Default School' });
    expect(r.totalRows).toBe(6);
    expect(r.duplicatesInFile).toBe(1);
    expect(r.records).toHaveLength(2);
    expect(r.records[0]).toMatchObject({ line: 2, phone: '+919876543210', studentName: 'Ravi Teja', studentPhone: '+919000000002', school: 'Default School', program: 'iit-jee' });
    expect(r.records[1]).toMatchObject({ line: 7, phone: '+919000000004', studentPhone: null, program: 'neet' });
    expect(r.rejected.map((x) => [x.line, x.reason])).toEqual([
      [4, 'No mobile number'],
      [5, 'Invalid mobile number "12345"'],
      [6, 'No student or parent name'],
    ]);
  });
});

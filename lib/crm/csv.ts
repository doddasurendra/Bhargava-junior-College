/** Minimal RFC 4180 CSV reader/writer. Pure — runs in the browser (preview) and on the server (import). */

export function detectDelimiter(text: string): ',' | ';' | '\t' {
  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  const counts = { ',': 0, ';': 0, '\t': 0 } as Record<',' | ';' | '\t', number>;
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch as ',' | ';' | '\t']++;
  }
  const [best, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return (n > 0 ? best : ',') as ',' | ';' | '\t';
}

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

export function parseCsv(input: string, delimiter = detectDelimiter(input)): ParsedCsv {
  const text = input.replace(/^﻿/, ''); // Excel's UTF-8 BOM
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === '') inQuotes = true;
    else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      records.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    records.push(row);
  }

  const nonEmpty = records.filter((r) => r.some((c) => c.trim() !== ''));
  const [headerRow = [], ...rows] = nonEmpty;
  return { headers: headerRow.map((h) => h.trim()), rows: rows.map((r) => r.map((c) => c.trim())) };
}

/** Prevent spreadsheet formula injection when staff open an exported file in Excel. */
function safeCell(v: string): string {
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map((c) => safeCell(c ?? '')).join(',')).join('\r\n');
}

import { inflateRawSync } from 'node:zlib';

/**
 * Minimal, dependency-free .xlsx reader for imports: the first worksheet as rows of strings. An .xlsx file is a
 * zip of XML parts; this reads the zip's central directory, inflates sharedStrings + the first sheet and walks
 * the cells. Dates stored as Excel serial numbers are returned as numbers (the caller converts the date column).
 * Limits: 5 MB file, 20 000 rows, 60 columns. Throws on anything that isn't a valid .xlsx.
 */
export class XlsxError extends Error {}

function entries(buf: Buffer) {
  if (buf.length < 22 || buf.length > 5 * 1024 * 1024) throw new XlsxError('The Excel file is empty or larger than 5 MB.');
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new XlsxError('This is not a valid .xlsx file.');
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const out = new Map<string, { method: number; size: number; local: number }>();
  for (let n = 0; n < count && n < 2000; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new XlsxError('This .xlsx file is damaged.');
    const method = buf.readUInt16LE(off + 10), size = buf.readUInt32LE(off + 20), nameLen = buf.readUInt16LE(off + 28), extra = buf.readUInt16LE(off + 30), comment = buf.readUInt16LE(off + 32), local = buf.readUInt32LE(off + 42);
    out.set(buf.toString('utf8', off + 46, off + 46 + nameLen), { method, size, local });
    off += 46 + nameLen + extra + comment;
  }
  return out;
}

function read(buf: Buffer, e: { method: number; size: number; local: number }) {
  const nameLen = buf.readUInt16LE(e.local + 26), extra = buf.readUInt16LE(e.local + 28);
  const start = e.local + 30 + nameLen + extra;
  const data = buf.subarray(start, start + e.size);
  if (e.method === 0) return data.toString('utf8');
  if (e.method === 8) return inflateRawSync(data, { maxOutputLength: 50 * 1024 * 1024 }).toString('utf8');
  throw new XlsxError('Unsupported compression in this .xlsx file.');
}

const unxml = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&amp;/g, '&');
const colIndex = (ref: string) => { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };

export function readXlsxRows(buf: Buffer): string[][] {
  const z = entries(buf);
  const shared: string[] = [];
  const ss = z.get('xl/sharedStrings.xml');
  if (ss) for (const si of read(buf, ss).match(/<si>[\s\S]*?<\/si>/g) ?? []) shared.push(unxml((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? []).map((t) => t.replace(/<t[^>]*>|<\/t>/g, '')).join('')));
  const sheetName = [...z.keys()].filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort((a, b) => +a.replace(/\D/g, '') - +b.replace(/\D/g, ''))[0];
  if (!sheetName) throw new XlsxError('The Excel file has no worksheet.');
  const xml = read(buf, z.get(sheetName)!);
  const rows: string[][] = [];
  for (const row of xml.match(/<row[^>]*>[\s\S]*?<\/row>|<row[^>]*\/>/g) ?? []) {
    if (rows.length >= 20_000) throw new XlsxError('The file has more than 20 000 rows.');
    const cells: string[] = [];
    for (const c of row.match(/<c [^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) ?? []) {
      const ref = /r="([A-Z]+\d+)"/.exec(c)?.[1];
      const t = /t="(\w+)"/.exec(c)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(c)?.[1];
      const inline = /<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/.exec(c)?.[1];
      const val = t === 's' && v !== undefined ? shared[+v] ?? '' : t === 'inlineStr' ? unxml(inline ?? '') : v !== undefined ? unxml(v) : '';
      const idx = ref ? colIndex(ref) : cells.length;
      if (idx > 60) continue;
      cells[idx] = val;
    }
    rows.push(Array.from(cells, (x) => x ?? ''));
  }
  return rows;
}

/** Excel serial day (1900 date system) → YYYY-MM-DD, or null. */
export function excelSerialToIso(v: string): string | null {
  if (!/^\d{4,6}(\.\d+)?$/.test(v)) return null;
  const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(+v) * 86_400_000);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

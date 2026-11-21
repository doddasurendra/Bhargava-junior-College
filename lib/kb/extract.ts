import { inflateRawSync } from 'node:zlib';

/**
 * File checks and text extraction for the Knowledge Hub (§2). Pure Node: a small ZIP reader covers Word
 * (.docx), PowerPoint (.pptx) and Excel (.xlsx) — they are ZIPs of XML — CSV/TXT are read directly, and PDFs
 * use pdf.js (unpdf). Scanned PDFs and images have no text layer: they are marked `ocr_needed` and sent to OCR
 * (lib/kb/ocr.ts, Claude vision reads Telugu and Hindi script too).
 */

export type FileKind = 'pdf' | 'word' | 'excel' | 'csv' | 'powerpoint' | 'image' | 'text';
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export interface Sniffed {
  kind: FileKind;
  mime: string;
}

const EXT_KIND: Record<string, Sniffed> = {
  pdf: { kind: 'pdf', mime: 'application/pdf' },
  docx: { kind: 'word', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  xlsx: { kind: 'excel', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  pptx: { kind: 'powerpoint', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  csv: { kind: 'csv', mime: 'text/csv' },
  txt: { kind: 'text', mime: 'text/plain' },
  md: { kind: 'text', mime: 'text/markdown' },
  jpg: { kind: 'image', mime: 'image/jpeg' },
  jpeg: { kind: 'image', mime: 'image/jpeg' },
  png: { kind: 'image', mime: 'image/png' },
  webp: { kind: 'image', mime: 'image/webp' },
  gif: { kind: 'image', mime: 'image/gif' },
};
export const ACCEPT = Object.keys(EXT_KIND).map((e) => `.${e}`).join(',');

const ext = (name: string) => (name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '');

/**
 * Decide the type from the bytes (magic numbers), and require the extension to agree, so a renamed
 * executable or a macro workbook can't pass as a document. Old binary .doc/.xls/.ppt are refused with a
 * "save as .docx/.xlsx/.pptx" message (their formats can't be read safely without a large parser).
 */
export function sniff(name: string, b: Uint8Array): Sniffed | { error: string } {
  const e = ext(name);
  if (['doc', 'xls', 'ppt'].includes(e)) return { error: `Old .${e} files can’t be read. Save it as .${e}x and upload again.` };
  if (['docm', 'xlsm', 'pptm', 'exe', 'bat', 'cmd', 'js', 'vbs', 'msi', 'scr', 'html', 'htm', 'svg'].includes(e)) return { error: `.${e} files are not allowed.` };
  const want = EXT_KIND[e];
  if (!want) return { error: 'Unsupported file type. Use PDF, Word (.docx), Excel (.xlsx/.csv), PowerPoint (.pptx), an image or text.' };
  const is = (...sig: number[]) => sig.every((v, i) => b[i] === v);
  let got: FileKind | null = null;
  if (is(0x25, 0x50, 0x44, 0x46)) got = 'pdf';
  else if (is(0xff, 0xd8, 0xff) || is(0x89, 0x50, 0x4e, 0x47) || is(0x47, 0x49, 0x46, 0x38) || (is(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50)) got = 'image';
  else if (is(0x50, 0x4b, 0x03, 0x04)) got = want.kind === 'word' || want.kind === 'excel' || want.kind === 'powerpoint' ? want.kind : null;
  else if (looksLikeText(b)) got = want.kind === 'csv' || want.kind === 'text' ? want.kind : null;
  if (got !== want.kind) return { error: `The file content doesn’t match its .${e} name.` };
  return want;
}

function looksLikeText(b: Uint8Array) {
  const n = Math.min(b.length, 4096);
  for (let i = 0; i < n; i++) if (b[i] === 0) return false;
  return true;
}

// ---------------------------------------------------------------- ZIP

export function unzip(buf: Uint8Array): Map<string, Uint8Array> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('not a zip');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = new Map<string, Uint8Array>();
  let total = 0;
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const usize = dv.getUint32(p + 24, true);
    const nlen = dv.getUint16(p + 28, true);
    const xlen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    // zip-bomb guard: refuse archives that expand past 200 MB
    total += usize;
    if (total > 200 * 1024 * 1024) throw new Error('archive too large when expanded');
    const lnlen = dv.getUint16(local + 26, true);
    const lxlen = dv.getUint16(local + 28, true);
    const start = local + 30 + lnlen + lxlen;
    const data = buf.subarray(start, start + csize);
    if (method === 0) out.set(name, data);
    else if (method === 8) out.set(name, new Uint8Array(inflateRawSync(data)));
  }
  return out;
}

const xmlText = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, '&');
const dec = (b?: Uint8Array) => (b ? new TextDecoder().decode(b) : '');
const byNumber = (a: string, b: string) => Number(a.match(/(\d+)\.xml$/)?.[1] ?? 0) - Number(b.match(/(\d+)\.xml$/)?.[1] ?? 0);

export interface Extracted {
  pages: string[];
  pageLabel: 'page' | 'sheet' | 'slide' | 'part';
  method: string;
  /** office files with macros (vbaProject.bin) or embedded executables */
  warnings: string[];
}

function officeWarnings(z: Map<string, Uint8Array>) {
  const w: string[] = [];
  for (const k of z.keys()) {
    if (/vbaProject\.bin$/i.test(k)) w.push('Contains macros (vbaProject.bin)');
    if (/\.(exe|dll|bat|cmd|js|vbs|scr)$/i.test(k)) w.push(`Embedded executable: ${k}`);
    if (/oleObject/i.test(k)) w.push('Contains embedded OLE objects');
  }
  return [...new Set(w)];
}

/** Split long text into ~3,000-character parts on paragraph boundaries (Word has no reliable page numbers). */
function parts(text: string, size = 3000) {
  const out: string[] = [];
  let cur = '';
  for (const para of text.split(/\n/)) {
    if (cur.length + para.length > size && cur) {
      out.push(cur.trim());
      cur = '';
    }
    cur += `${para}\n`;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.length ? out : [''];
}

export function extractDocx(buf: Uint8Array): Extracted {
  const z = unzip(buf);
  const xml = dec(z.get('word/document.xml'));
  if (!xml) throw new Error('word/document.xml missing');
  // page breaks Word recorded at last render (manual and automatic) split pages; else ~3,000-char parts
  const hasBreaks = /<w:lastRenderedPageBreak\/>|<w:br [^>]*w:type="page"/.test(xml);
  const PAGE = '\u000c';
  const body = xml
    .replace(/<w:lastRenderedPageBreak\/>|<w:br [^>]*w:type="page"[^>]*\/>/g, PAGE)
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g, (_, t) => `\u0001${t}\u0002`)
    .replace(/<[^>]+>/g, '')
    .replace(/\u0001([^\u0002]*)\u0002/g, (_, t) => xmlText(t));
  const text = body.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  const pages = hasBreaks ? text.split(PAGE).map((p) => p.trim()) : parts(text.replace(new RegExp(PAGE, 'g'), ''));
  return { pages: pages.length ? pages : [''], pageLabel: hasBreaks ? 'page' : 'part', method: 'docx-xml', warnings: officeWarnings(z) };
}

export function extractPptx(buf: Uint8Array): Extracted {
  const z = unzip(buf);
  const slides = [...z.keys()].filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k)).sort(byNumber);
  const pages = slides.map((k) =>
    dec(z.get(k))
      .replace(/<\/a:p>/g, '\n')
      .replace(/<a:t>([^<]*)<\/a:t>/g, (_, t) => `\u0001${t}\u0002`)
      .replace(/<[^>]+>/g, '')
      .replace(/\u0001([^\u0002]*)\u0002/g, (_, t) => xmlText(t))
      .replace(/\n{2,}/g, '\n')
      .trim(),
  );
  return { pages: pages.length ? pages : [''], pageLabel: 'slide', method: 'pptx-xml', warnings: officeWarnings(z) };
}

export function extractXlsx(buf: Uint8Array): Extracted {
  const z = unzip(buf);
  const shared = [...dec(z.get('xl/sharedStrings.xml')).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => xmlText([...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => t[1]).join('')));
  const names = [...dec(z.get('xl/workbook.xml')).matchAll(/<sheet [^>]*name="([^"]*)"/g)].map((m) => xmlText(m[1]));
  const sheets = [...z.keys()].filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort(byNumber);
  const pages = sheets.map((k, i) => {
    const rows: string[] = [];
    for (const r of dec(z.get(k)).matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: string[] = [];
      for (const c of r[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1];
        const inner = c[2] ?? '';
        const v = inner.match(/<v>([^<]*)<\/v>/)?.[1];
        const t = attrs.match(/t="([^"]+)"/)?.[1];
        if (t === 's' && v !== undefined) cells.push(shared[Number(v)] ?? '');
        else if (t === 'inlineStr') cells.push(xmlText([...inner.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((x) => x[1]).join('')));
        else cells.push(v !== undefined ? xmlText(v) : '');
      }
      if (cells.some((x) => x.trim())) rows.push(cells.join('\t'));
      if (rows.length >= 5000) break;
    }
    return `${names[i] ? `Sheet: ${names[i]}\n` : ''}${rows.join('\n')}`.trim();
  });
  return { pages: pages.length ? pages : [''], pageLabel: 'sheet', method: 'xlsx-xml', warnings: officeWarnings(z) };
}

export function extractCsv(buf: Uint8Array, kind: 'csv' | 'text'): Extracted {
  let text = new TextDecoder('utf-8').decode(buf).replace(/^﻿/, '');
  if (kind === 'csv') text = text.replace(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/g, '\t').replace(/"/g, '');
  const lines = text.split(/\r?\n/);
  const pages: string[] = [];
  // ~200 rows per "part" so a big sheet gives usable citations
  for (let i = 0; i < lines.length; i += 200) pages.push(lines.slice(i, i + 200).join('\n').trim());
  return { pages: pages.length ? pages : [''], pageLabel: kind === 'csv' ? 'part' : 'part', method: kind, warnings: [] };
}

export async function extractPdf(buf: Uint8Array): Promise<Extracted> {
  const head = new TextDecoder('latin1').decode(buf.subarray(0, Math.min(buf.length, 2_000_000)));
  const warnings: string[] = [];
  if (/\/JavaScript|\/JS\s*[(<]/.test(head)) warnings.push('PDF contains JavaScript');
  if (/\/Launch/.test(head)) warnings.push('PDF contains a Launch action');
  if (/\/EmbeddedFile/.test(head)) warnings.push('PDF contains embedded files');
  const { extractText } = await import('unpdf');
  const r = await extractText(new Uint8Array(buf), { mergePages: false });
  const pages = (r.text as string[]).map((t) => t.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim());
  return { pages, pageLabel: 'page', method: 'pdfjs', warnings };
}

export async function extract(kind: FileKind, buf: Uint8Array): Promise<Extracted> {
  switch (kind) {
    case 'pdf':
      return extractPdf(buf);
    case 'word':
      return extractDocx(buf);
    case 'powerpoint':
      return extractPptx(buf);
    case 'excel':
      return extractXlsx(buf);
    case 'csv':
    case 'text':
      return extractCsv(buf, kind);
    case 'image':
      return { pages: [''], pageLabel: 'page', method: 'none', warnings: [] };
  }
}

/** A text layer this thin means a scan: OCR it. */
export function needsOcr(kind: FileKind, pages: string[]) {
  if (kind === 'image') return true;
  if (kind !== 'pdf') return false;
  const chars = pages.reduce((t, p) => t + p.replace(/\s/g, '').length, 0);
  return chars < Math.max(40, pages.length * 25);
}

export function detectScripts(text: string) {
  const langs: string[] = [];
  if (/[a-z]{3,}/i.test(text)) langs.push('en');
  if (/[ఀ-౿]/.test(text)) langs.push('te');
  if (/[ऀ-ॿ]/.test(text)) langs.push('hi');
  return langs;
}

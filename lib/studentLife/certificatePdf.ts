import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { college } from '@/content/college';
import { formatDate } from '../dates';

/** Sports achievement certificate: A4 landscape, college logo, from the recorded achievement only. */
const MEDAL: Record<string, string> = { gold: 'First place (Gold)', silver: 'Second place (Silver)', bronze: 'Third place (Bronze)', certificate: 'Certificate of merit', participation: 'Certificate of participation' };
const ascii = (s: string) => s.normalize('NFKD').replace(/[^\x20-\x7E]/g, '').trim() || '-';

export async function sportsCertificatePdf(a: { name: string; collegeId: string | null; title: string; medal: string; event: string; date: string }) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Certificate - ${ascii(a.name)}`);
  const page = doc.addPage([842, 595]);
  const [serif, bold, sans] = await Promise.all([doc.embedFont(StandardFonts.TimesRoman), doc.embedFont(StandardFonts.TimesRomanBold), doc.embedFont(StandardFonts.Helvetica)]);
  const navy = rgb(0.11, 0.16, 0.37);
  const gold = rgb(0.79, 0.64, 0.29);
  page.drawRectangle({ x: 20, y: 20, width: 802, height: 555, borderColor: gold, borderWidth: 4 });
  page.drawRectangle({ x: 32, y: 32, width: 778, height: 531, borderColor: navy, borderWidth: 1 });
  const png = await readFile(path.join(process.cwd(), 'public', 'logo-192.png')).then((b) => new Uint8Array(b)).catch(() => null);
  if (png) page.drawImage(await doc.embedPng(png), { x: 386, y: 470, width: 70, height: 70 });
  const center = (t: string, y: number, size: number, font = serif, color = navy) => { const s = ascii(t); page.drawText(s, { x: (842 - font.widthOfTextAtSize(s, size)) / 2, y, size, font, color }); };
  center(college.name.toUpperCase(), 440, 24, bold);
  center(college.motto, 418, 12, serif, gold);
  center('CERTIFICATE OF ACHIEVEMENT', 370, 30, bold, gold);
  center('This is to certify that', 330, 15);
  center(a.name, 290, 30, bold);
  if (a.collegeId) center(`College ID ${a.collegeId}`, 266, 11, sans);
  center(`has been awarded ${MEDAL[a.medal] ?? a.medal}`, 228, 16);
  center(`${a.title} - ${a.event}`, 200, 16, bold);
  center(`on ${formatDate(a.date, { day: 'numeric', month: 'long', year: 'numeric' })}`, 174, 14);
  for (const [x, label] of [[150, 'Sports Coach'], [560, 'Principal']] as const) {
    page.drawLine({ start: { x, y: 100 }, end: { x: x + 140, y: 100 }, thickness: 0.8, color: navy });
    page.drawText(label, { x: x + (140 - sans.widthOfTextAtSize(label, 11)) / 2, y: 84, size: 11, font: sans, color: navy });
  }
  page.drawText('Generated from the college sports records.', { x: 40, y: 40, size: 8, font: sans, color: rgb(0.45, 0.45, 0.5) });
  return doc.save();
}

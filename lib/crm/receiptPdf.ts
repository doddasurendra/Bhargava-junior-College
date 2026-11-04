import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { college } from '@/content/college';
import { getProgram } from '@/content/programs';
import { PAYMENT_MODES } from '@/content/sample';
import { formatDate, formatDateTime } from '../dates';
import type { CrmLead } from './types';
import { rupeesInWords, type PaymentRow, type StudentRow } from './verification';

/**
 * The official fee receipt as a downloadable A5 PDF on the letterhead, with the college logo
 * (same content as the on-screen ReceiptDoc). Standard PDF fonts can't draw "₹", so amounts read "Rs.".
 */
const NAVY = rgb(0x1d / 255, 0x2a / 255, 0x5e / 255);
const MAROON = rgb(0x7d / 255, 0x1f / 255, 0x2c / 255);
const GOLD = rgb(0xc9 / 255, 0xa2 / 255, 0x4a / 255);
const INK = rgb(0x15 / 255, 0x1c / 255, 0x36 / 255);
const MUTED = rgb(0.34, 0.37, 0.48);
const safe = (s: string) => s.replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/₹/g, 'Rs.').replace(/·/g, '-').replace(/[^\x20-\x7E\xA0-\xFF]/g, '');

let logoBytes: Uint8Array | null | undefined;
async function logo() {
  if (logoBytes === undefined) logoBytes = await readFile(path.join(process.cwd(), 'public', 'logo-192.png')).then((b) => new Uint8Array(b)).catch(() => null);
  return logoBytes;
}

export async function receiptPdf(payment: PaymentRow, student: StudentRow | null, lead: Pick<CrmLead, 'parentName' | 'contactName' | 'studentName' | 'program'> | null): Promise<Uint8Array> {
  if (!payment.receiptNo) throw new Error('No receipt has been issued for this payment yet.');
  const doc = await PDFDocument.create();
  doc.setTitle(`Receipt ${payment.receiptNo}`);
  doc.setAuthor(college.name);
  const page = doc.addPage([420, 595]); // A5 portrait
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const text = (s: string, x: number, y: number, size = 9, f = font, color = INK) => page.drawText(safe(s), { x, y, size, font: f, color });

  // letterhead
  const png = await logo();
  if (png) page.drawImage(await doc.embedPng(png), { x: 28, y: 515, width: 56, height: 56 });
  text(college.name.toUpperCase(), 94, 555, 13, bold, NAVY);
  text(college.motto, 94, 541, 8, font, MAROON);
  // address on two lines so the PIN code always fits the A5 width
  text(`${college.address.line1}, ${college.address.line2}`, 94, 529, 6.5, font, MUTED);
  text(`${college.address.locality}, ${college.address.city} - ${college.address.pin}`, 94, 520, 6.5, font, MUTED);
  text(`${college.phones.map((p) => p.display).join('  |  ')}  |  ${college.email}`, 94, 511, 6.5, font, MUTED);
  page.drawLine({ start: { x: 28, y: 501 }, end: { x: 392, y: 501 }, thickness: 1.5, color: GOLD });

  text('Official fee receipt', 28, 478, 14, bold, NAVY);
  const no = safe(payment.receiptNo);
  page.drawText(no, { x: 392 - bold.widthOfTextAtSize(no, 11), y: 479, size: 11, font: bold, color: INK });

  const program = getProgram(student?.program ?? lead?.program ?? '')?.name ?? '-';
  const rows: [string, string][] = [
    ['Received from', student?.guardianName ?? lead?.parentName ?? lead?.contactName ?? '-'],
    ['Student', student?.fullName ?? lead?.studentName ?? '-'],
    ['Program', program],
    ['College ID', student?.collegeId ?? 'To be issued'],
    ['Payment date', formatDate(payment.paidOn, { day: 'numeric', month: 'long', year: 'numeric' })],
    ['Mode', `${PAYMENT_MODES.find((m) => m.value === payment.mode)?.label ?? payment.mode}${payment.reference ? ` - ${payment.reference}` : ''}`],
  ];
  let y = 448;
  for (const [k, v] of rows) {
    text(k.toUpperCase(), 28, y, 6.5, font, MUTED);
    text(v, 28, y - 11, 9.5, bold);
    page.drawLine({ start: { x: 28, y: y - 16 }, end: { x: 392, y: y - 16 }, thickness: 0.5, color: rgb(0.87, 0.88, 0.92) });
    y -= 30;
  }

  page.drawRectangle({ x: 28, y: y - 52, width: 364, height: 58, color: rgb(0.96, 0.96, 0.98) });
  text('AMOUNT RECEIVED', 40, y - 8, 6.5, font, MUTED);
  text(`Rs. ${payment.amount.toLocaleString('en-IN')}`, 40, y - 28, 18, bold, NAVY);
  text(rupeesInWords(payment.amount), 40, y - 42, 8);

  text(`Issued ${payment.receiptAt ? formatDateTime(payment.receiptAt) : ''}`, 28, 50, 7, font, MUTED);
  text(college.society, 28, 40, 7, font, MUTED);
  const r1 = 'Computer-generated receipt';
  const r2 = `Accounts, ${college.name}`;
  page.drawText(r1, { x: 392 - font.widthOfTextAtSize(r1, 7), y: 50, size: 7, font, color: MUTED });
  page.drawText(safe(r2), { x: 392 - font.widthOfTextAtSize(safe(r2), 7), y: 40, size: 7, font, color: MUTED });
  return doc.save();
}

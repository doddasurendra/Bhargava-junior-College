import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import { college, fullAddress } from '@/content/college';
import { formatDate } from '../dates';
import type { DailyParameter, Metrics } from './metrics';

/**
 * The 7 PM report as a one-page PDF on the college letterhead (brief §8), and the matching email body.
 * Standard PDF fonts can't draw "₹", so amounts read "Rs." in the PDF.
 */
export interface ReportLike {
  date: string;
  generatedAt: string;
  today: Metrics;
  mtd: Metrics;
  season: Metrics;
}

const NAVY = rgb(0x1d / 255, 0x2a / 255, 0x5e / 255);
const MAROON = rgb(0x7d / 255, 0x1f / 255, 0x2c / 255);
const GOLD = rgb(0xc9 / 255, 0xa2 / 255, 0x4a / 255);
const INK = rgb(0x15 / 255, 0x1c / 255, 0x36 / 255);
const MUTED = rgb(0.42, 0.45, 0.52);

const rs = (n: number) => `Rs. ${n.toLocaleString('en-IN')}`;
const val = (p: DailyParameter | undefined) => (p ? (p.money ? rs(p.value) : p.value.toLocaleString('en-IN')) : '-');
/** keep to WinAnsi so the standard fonts can draw it */
const safe = (s: string) => s.replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/₹/g, 'Rs.').replace(/[^\x20-\x7E\xA0-\xFF]/g, '');

export async function reportPdf(r: ReportLike): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Daily admissions report ${r.date}`);
  doc.setAuthor(college.name);
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const text = (p: PDFPage, s: string, x: number, y: number, size = 10, f: PDFFont = font, color = INK) => p.drawText(safe(s), { x, y, size, font: f, color });

  // letterhead
  page.drawRectangle({ x: 0, y: 772, width: 595, height: 70, color: NAVY });
  page.drawCircle({ x: 58, y: 807, size: 22, borderColor: GOLD, borderWidth: 2, color: NAVY });
  text(page, 'BJC', 46, 803, 11, bold, GOLD);
  text(page, college.name.toUpperCase(), 92, 815, 15, bold, rgb(1, 1, 1));
  text(page, college.motto, 92, 799, 9, font, GOLD);
  text(page, fullAddress, 92, 785, 7.5, font, rgb(0.85, 0.87, 0.93));
  page.drawRectangle({ x: 0, y: 768, width: 595, height: 4, color: GOLD });

  text(page, '7 PM daily admissions report', 40, 735, 16, bold, MAROON);
  text(page, `${formatDate(r.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · generated ${new Date(r.generatedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })} IST`, 40, 719, 9, font, MUTED);

  // the 10 parameters × today / MTD / season
  let y = 690;
  const cols = [40, 300, 390, 480];
  text(page, 'Parameter', cols[0], y, 9, bold, MUTED);
  text(page, 'Today', cols[1], y, 9, bold, MUTED);
  text(page, 'Month to date', cols[2], y, 9, bold, MUTED);
  text(page, 'Season', cols[3], y, 9, bold, MUTED);
  y -= 8;
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.6, color: GOLD });
  for (const p of r.today.daily) {
    y -= 18;
    text(page, p.label, cols[0], y, 10.5, bold);
    text(page, val(p), cols[1], y, 10.5);
    text(page, val(r.mtd.daily.find((x) => x.key === p.key)), cols[2], y, 10.5);
    text(page, val(r.season.daily.find((x) => x.key === p.key)), cols[3], y, 10.5);
  }

  // funnel (season)
  y -= 34;
  text(page, 'Season funnel', 40, y, 12, bold, NAVY);
  const max = Math.max(1, ...r.season.funnel.map((f) => f.value));
  for (const f of r.season.funnel) {
    y -= 18;
    text(page, f.label, 40, y, 9.5);
    page.drawRectangle({ x: 200, y: y - 2, width: Math.max(2, (f.value / max) * 280), height: 11, color: NAVY });
    text(page, f.value.toLocaleString('en-IN'), 490, y, 9.5, bold);
  }

  // accountability
  y -= 34;
  text(page, 'Needs attention now', 40, y, 12, bold, NAVY);
  const b = r.today.backlog;
  for (const [label, n] of [
    ['Follow-ups overdue', b.overdue],
    ['Overdue 48h+ (flagged to management)', b.escalated48],
    ['Visits without an outcome', b.visitsNeedingOutcome],
    ['Unassigned open leads', b.unassigned],
    ['Decisions pending', b.pendingDecisions],
  ] as const) {
    y -= 16;
    text(page, label, 40, y, 10);
    text(page, String(n), 300, y, 10, bold, n > 0 ? MAROON : INK);
  }
  const flagged = r.today.flagged.slice(0, 8);
  if (flagged.length) {
    y -= 22;
    text(page, 'Overdue 48h+ by owner', 40, y, 10, bold);
    for (const f of flagged) {
      y -= 14;
      text(page, `${f.owner}: ${f.name} (${f.overdueHours} h overdue)`, 48, y, 9, font, MUTED);
    }
  }

  page.drawLine({ start: { x: 40, y: 50 }, end: { x: 555, y: 50 }, thickness: 0.5, color: GOLD });
  text(page, 'Definitions of every figure are on the live dashboard. Confidential: for college management only.', 40, 36, 8, font, MUTED);
  return doc.save();
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const money = (p: DailyParameter | undefined) => (p ? (p.money ? `₹${p.value.toLocaleString('en-IN')}` : p.value.toLocaleString('en-IN')) : '–');

export function reportEmailHtml(r: ReportLike, link: string): string {
  const rows = r.today.daily
    .map((p) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #e5e7ef">${esc(p.label)}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7ef;text-align:right;font-family:monospace">${money(p)}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7ef;text-align:right;font-family:monospace">${money(r.mtd.daily.find((x) => x.key === p.key))}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7ef;text-align:right;font-family:monospace">${money(r.season.daily.find((x) => x.key === p.key))}</td></tr>`)
    .join('');
  return `<!doctype html><html><body style="margin:0;background:#F4F5F9;font-family:Arial,sans-serif;color:#151C36">
<div style="max-width:640px;margin:0 auto;background:#fff">
<div style="background:#1D2A5E;color:#fff;padding:18px 24px;border-bottom:4px solid #C9A24A"><div style="font-size:18px;font-weight:bold">${esc(college.name)}</div><div style="color:#C9A24A;font-size:12px">${esc(college.motto)}</div></div>
<div style="padding:20px 24px"><h1 style="font-size:18px;color:#7D1F2C;margin:0 0 4px">7 PM admissions report</h1><p style="margin:0 0 16px;color:#6b7280;font-size:13px">${esc(formatDate(r.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</p>
<table style="border-collapse:collapse;width:100%;font-size:13px"><thead><tr style="color:#6b7280;text-align:left"><th style="padding:6px 10px">Parameter</th><th style="padding:6px 10px;text-align:right">Today</th><th style="padding:6px 10px;text-align:right">MTD</th><th style="padding:6px 10px;text-align:right">Season</th></tr></thead><tbody>${rows}</tbody></table>
<p style="margin:16px 0 0;font-size:13px">Overdue 48h+: <b>${r.today.backlog.escalated48}</b> · Visits without an outcome: <b>${r.today.backlog.visitsNeedingOutcome}</b></p>
<p style="margin:20px 0"><a href="${esc(link)}" style="background:#7D1F2C;color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;font-size:14px">Open the live dashboard</a></p>
<p style="font-size:11px;color:#6b7280">The PDF on letterhead is attached. Confidential: for college management only.</p></div></div></body></html>`;
}

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { college } from '@/content/college';
import { getStaffSession } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { toCsv } from '@/lib/crm/csv';
import { todayIST } from '@/lib/dates';
import { attendanceAnalytics } from '@/lib/school/attendanceTools';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Attendance report for the range and filters on the dashboard: Excel (CSV) or PDF. Only batches the user may see. */
export async function GET(req: Request) {
  const user = await getStaffSession();
  if (!user) return new Response('Sign in first.', { status: 401 });
  if (!(can(user, 'academics.view') || can(user, 'attendance.mark'))) return new Response('Not allowed.', { status: 403 });
  const u = new URL(req.url);
  const iso = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(u.searchParams.get(k) ?? '') ? u.searchParams.get(k)! : null);
  const to = iso('to') ?? todayIST();
  const from = iso('from') ?? to;
  const a = await attendanceAnalytics(user, { from, to, batchId: u.searchParams.get('batch') || null, subject: u.searchParams.get('subject') || null, threshold: Number(u.searchParams.get('threshold')) || 75 });
  const scope = `${from}_to_${to}${u.searchParams.get('subject') ? `_${u.searchParams.get('subject')}` : ''}`.replace(/[^\w-]+/g, '-');
  const rows = a.students.map((s) => ({ 'Student': s.name, 'College ID': s.collegeId, 'Section': s.batch, 'Days marked': s.days, 'Present': s.present, 'Late': s.late, 'Absent': s.absent, 'Leave': s.leave, 'Attendance %': s.pct ?? '', [`Below ${a.threshold}%`]: s.pct !== null && s.pct < a.threshold ? 'yes' : '' }));
  if (u.searchParams.get('format') !== 'pdf') {
    const head = Object.keys(rows[0] ?? { Student: '' });
    const csv = '﻿' + toCsv([head, ...rows.map((r) => head.map((h) => String((r as Record<string, string | number>)[h] ?? '')))]);
    return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="attendance-${scope}.csv"`, 'Cache-Control': 'no-store' } });
  }
  // PDF: summary, section table, monthly table, then every student
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const clean = (t: string) => t.replace(/[^\x20-\x7E]/g, '?'); // standard PDF fonts are Latin-only
  let page = doc.addPage([595, 842]);
  let y = 800;
  const line = (t: string, size = 10, f = font, x = 40) => { if (y < 50) { page = doc.addPage([595, 842]); y = 800; } page.drawText(clean(t), { x, y, size, font: f, color: rgb(0.1, 0.12, 0.25) }); y -= size + 6; };
  const row = (cells: string[], widths: number[], f = font) => { if (y < 50) { page = doc.addPage([595, 842]); y = 800; } let x = 40; cells.forEach((c, i) => { page.drawText(clean(c).slice(0, Math.floor(widths[i] / 5)), { x, y, size: 9, font: f }); x += widths[i]; }); y -= 14; };
  line(`${college.name}: attendance report`, 15, bold);
  line(`${from} to ${to}${u.searchParams.get('subject') ? ` · subject ${u.searchParams.get('subject')}` : ' · whole-day registers'} · generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC by ${user.fullName}`, 9);
  line(`Students ${a.totalStudents} · registers ${a.registers} · overall ${a.overall.pct ?? '-'}% · present ${a.overall.present} · late ${a.overall.late} · absent ${a.overall.absent} · leave ${a.overall.leave}`, 10);
  line(`Below ${a.threshold}%: ${a.below.length} student(s). Late counts as present; approved leave is left out of the percentage.`, 9);
  y -= 6; line('By section', 12, bold);
  row(['Section', 'Students', 'Present', 'Late', 'Absent', 'Leave', '%'], [150, 60, 60, 50, 60, 50, 60], bold);
  for (const b of a.byBatch) row([b.name, String(b.students), String(b.present), String(b.late), String(b.absent), String(b.leave), b.pct === null ? '-' : `${b.pct}`], [150, 60, 60, 50, 60, 50, 60]);
  y -= 6; line('By month', 12, bold);
  row(['Month', 'Present', 'Late', 'Absent', 'Leave', '%'], [110, 70, 60, 70, 60, 60], bold);
  for (const m of a.monthly) row([m.month, String(m.present), String(m.late), String(m.absent), String(m.leave), m.pct === null ? '-' : `${m.pct}`], [110, 70, 60, 70, 60, 60]);
  y -= 6; line('Students (lowest first)', 12, bold);
  row(['Student', 'College ID', 'Section', 'Days', 'P', 'L', 'A', 'Lv', '%'], [140, 100, 80, 35, 30, 30, 30, 30, 40], bold);
  for (const s of a.students) row([s.name, s.collegeId, s.batch, String(s.days), String(s.present), String(s.late), String(s.absent), String(s.leave), s.pct === null ? '-' : `${s.pct}`], [140, 100, 80, 35, 30, 30, 30, 30, 40], s.pct !== null && s.pct < a.threshold ? bold : font);
  const bytes = await doc.save();
  return new Response(Buffer.from(bytes), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="attendance-${scope}.pdf"`, 'Cache-Control': 'no-store' } });
}

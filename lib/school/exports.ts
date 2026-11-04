import 'server-only';
import { listLeads } from '../crm/service';
import { phoneFor } from '../crm/mask';
import { can } from '../crm/permissions';
import type { Permission } from '../crm/permissions';
import type { Staff } from '../crm/types';
import { toCsv } from '../crm/csv';
import { duesList } from './accounts';
import { exportableStudents, libraryOverview } from './backoffice';
import { batchOf } from './common';
import { studentSignals } from './mentoring';

/** Excel-ready exports (CSV with a BOM so Excel opens Telugu/Hindi text correctly). Each kind has its own permission. */
export const EXPORTS: { kind: string; label: string; perm: Permission }[] = [
  { kind: 'students', label: 'Students (College ID, program, batch, guardian)', perm: 'students.view' },
  { kind: 'attendance', label: 'Attendance, last 30 days, per student', perm: 'students.view' },
  { kind: 'leads', label: 'Leads (category, status, stage, owner, source)', perm: 'lead.call' },
  { kind: 'dues', label: 'Fee dues and overdue amounts', perm: 'fees.dues' },
  { kind: 'library', label: 'Library loans', perm: 'library.manage' },
];

export const exportsFor = (user: Staff) => EXPORTS.filter((e) => can(user, e.perm));

export async function buildExport(user: Staff, kind: string): Promise<string | null> {
  const def = EXPORTS.find((e) => e.kind === kind);
  if (!def || !can(user, def.perm)) return null;
  switch (kind) {
    case 'students': {
      const rows = [['College ID', 'Name', 'Program', 'Batch', 'Stay', 'Date of birth', 'Gender', 'Guardian', 'Guardian phone']];
      for (const s of await exportableStudents(user)) rows.push([s.collegeId ?? '', s.fullName, s.program, (await batchOf(s.id))?.data.name ?? '', s.stay, s.dob, s.gender, s.guardianName, phoneFor(user, s.guardianPhone)]);
      return toCsv(rows);
    }
    case 'attendance': {
      const rows = [['College ID', 'Name', 'Batch', 'Attendance %', 'Present', 'Absent', 'Late', 'Leave']];
      for (const s of await exportableStudents(user)) {
        const sig = await studentSignals(s.id);
        rows.push([s.collegeId ?? '', s.fullName, sig.batch ?? '', sig.attendance.pct === null ? '' : String(sig.attendance.pct), String(sig.attendance.present), String(sig.attendance.absent), String(sig.attendance.late), String(sig.attendance.leave)]);
      }
      return toCsv(rows);
    }
    case 'leads': {
      const rows = [['Created', 'Student', 'Parent / contact', 'Phone', 'Program', 'Category', 'Status', 'Stage', 'Owner', 'First source', 'Next follow-up', 'Lost reason']];
      for (const r of await listLeads(user, {})) {
        const l = r.lead;
        rows.push([l.createdAt.slice(0, 10), l.studentName ?? '', l.contactName ?? l.parentName ?? '', phoneFor(user, l.phone), l.program ?? '', l.category ?? 'unqualified', l.status, l.stage, r.owner?.fullName ?? '', l.firstSource, l.nextFollowUpAt?.slice(0, 10) ?? '', l.lostReason ?? '']);
      }
      return toCsv(rows);
    }
    case 'dues': {
      const rows = [['College ID', 'Name', 'Outstanding (₹)', 'Overdue (₹)', 'Next instalment', 'Next due']];
      for (const d of await duesList(user)) rows.push([d.student.collegeId ?? '', d.student.fullName, String(d.outstanding), String(d.overdue), d.next?.label ?? '', d.next?.due ?? '']);
      return toCsv(rows);
    }
    case 'library': {
      const { out } = await libraryOverview(user);
      const rows = [['Book', 'Student', 'College ID', 'Issued', 'Due', 'Days overdue']];
      for (const l of out) rows.push([l.book, l.student?.fullName ?? '', l.student?.collegeId ?? '', l.issuedOn, l.dueOn, String(l.late)]);
      return toCsv(rows);
    }
  }
  return null;
}

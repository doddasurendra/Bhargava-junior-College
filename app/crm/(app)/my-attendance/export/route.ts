import { NextResponse } from 'next/server';
import { getStaffSession } from '@/lib/crm/auth';
import { todayIST } from '@/lib/dates';
import { attendanceCsv, myAttendance } from '@/lib/school/staffAttendance';

/** The signed-in person's own month as CSV. There is no staff id parameter: it can only ever be your own. */
export async function GET(req: Request) {
  const user = await getStaffSession();
  if (!user) return new NextResponse('Sign in first.', { status: 401 });
  const q = new URL(req.url).searchParams.get('month') ?? '';
  const month = /^\d{4}-\d{2}$/.test(q) ? q : todayIST().slice(0, 7);
  const csv = attendanceCsv(user.fullName, month, await myAttendance(user, month));
  return new NextResponse('﻿' + csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="my-attendance-${month}.csv"`, 'Cache-Control': 'no-store' } });
}

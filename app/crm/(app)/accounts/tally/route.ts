import { getStaffSession } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { isIsoDate } from '@/lib/dates';
import { tallyCsv } from '@/lib/school/accounts';

export const dynamic = 'force-dynamic';

/** Approved fee receipts for a date range as CSV for import into Tally (§9A.2 row 9). */
export async function GET(req: Request) {
  const user = await getStaffSession();
  if (!user || !can(user, 'fees.export')) return new Response('Not found', { status: 404 });
  const u = new URL(req.url);
  const from = u.searchParams.get('from');
  const to = u.searchParams.get('to');
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) return new Response('Give from and to dates (YYYY-MM-DD).', { status: 400 });
  const csv = await tallyCsv(user, from, to);
  return new Response(`﻿${csv}`, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="bjc-fees-${from}-to-${to}.csv"`, 'Cache-Control': 'private, no-store' } });
}

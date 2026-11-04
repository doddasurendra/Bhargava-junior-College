import { getStaffSession } from '@/lib/crm/auth';
import { todayIST } from '@/lib/dates';
import { buildExport } from '@/lib/school/exports';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { kind: string } }) {
  const user = await getStaffSession();
  if (!user) return new Response('Not found', { status: 404 });
  const csv = await buildExport(user, params.kind);
  if (csv === null) return new Response('Not found', { status: 404 });
  return new Response(`﻿${csv}`, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="bjc-${params.kind}-${todayIST()}.csv"`, 'Cache-Control': 'private, no-store' },
  });
}

import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { generateDailyReport } from '@/lib/crm/reports';

export const dynamic = 'force-dynamic';

function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV === 'development';
  const given = Buffer.from(req.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** The 7 PM report. Schedule daily at 13:30 UTC (19:00 IST) with `Authorization: Bearer $CRON_SECRET`. */
async function handle(req: Request) {
  if (!authorised(req)) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await generateDailyReport()) });
  } catch (e) {
    console.error('[cron] daily report failed', (e as Error).message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;

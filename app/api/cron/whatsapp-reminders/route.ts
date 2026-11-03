import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { runVisitReminders } from '@/lib/whatsapp/service';

export const dynamic = 'force-dynamic';

function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV === 'development';
  const given = Buffer.from(req.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Campus-visit reminders, 1 day and 2 hours before. Call every 15 minutes, e.g. Vercel Cron
 * (`Authorization: Bearer $CRON_SECRET` is sent automatically) or pg_cron/net.http_get. Safe to repeat.
 */
async function handle(req: Request) {
  if (!authorised(req)) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await runVisitReminders()) });
  } catch (e) {
    console.error('[cron] reminders failed', (e as Error).message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;

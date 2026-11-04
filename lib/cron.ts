import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

/** Scheduled jobs call with `Authorization: Bearer $CRON_SECRET` (development allows no secret). */
export function cronAuthorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV === 'development';
  const given = Buffer.from(req.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function cronHandler(name: string, job: () => Promise<Record<string, unknown>>) {
  return async (req: Request) => {
    if (!cronAuthorised(req)) return NextResponse.json({ ok: false }, { status: 401 });
    try {
      return NextResponse.json({ ok: true, ...(await job()) });
    } catch (e) {
      console.error(`[cron] ${name} failed`, (e as Error).message);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  };
}

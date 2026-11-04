import { cronHandler } from '@/lib/cron';
import { sendWeeklyReports } from '@/lib/school/mentoring';

export const dynamic = 'force-dynamic';

/** §6.9 Sunday parent report on WhatsApp. Schedule Sundays at 12:30 UTC (18:00 IST). Safe to re-run. */
const handle = cronHandler('weekly report', async () => sendWeeklyReports());
export const GET = handle;
export const POST = handle;

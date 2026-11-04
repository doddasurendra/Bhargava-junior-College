import { cronHandler } from '@/lib/cron';
import { sendFeeReminders } from '@/lib/school/accounts';

export const dynamic = 'force-dynamic';

/** Instalment reminders (3 days before and while overdue). Schedule daily at 04:30 UTC (10:00 IST). */
const handle = cronHandler('fee reminders', async () => ({ sent: await sendFeeReminders(null) }));
export const GET = handle;
export const POST = handle;

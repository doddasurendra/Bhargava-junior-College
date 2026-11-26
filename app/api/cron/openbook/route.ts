import { cronHandler } from '@/lib/cron';
import { announceWeeklyWinners } from '@/lib/openbook/challenge';
import { seedSources } from '@/lib/openbook/sources';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Open Book weekly app job (Vercel cron, Sundays 03:30 UTC = 9 AM IST): posts each batch's Daily Challenge
 * winners to Notices (with the admin's reward and bonus XP) and adds any new official sources.
 * The weekly official-link check runs separately as the Supabase Edge Function `openbook-link-check`,
 * scheduled by pg_cron (Sundays 03:00 UTC); admins can also run it any time from Open Book → Official sources.
 */
const handle = cronHandler('open book weekly', async () => {
  const added = await seedSources(null);
  const winners = await announceWeeklyWinners();
  return { sourcesAdded: added, winnersPosted: winners.posted };
});

export const GET = handle;
export const POST = handle;
import { cronHandler } from '@/lib/cron';
import { audit } from '@/lib/openbook/core';
import { checkSources, seedSources } from '@/lib/openbook/sources';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Open Book weekly job (Sundays 03:30 UTC): checks every official source link and flags broken or moved ones
 * for admins (Open Book → Official sources shows the status; the activity log records the run).
 * Runs as a Vercel cron instead of a Supabase Edge Function + pg_cron, like the rest of this project's jobs.
 */
const handle = cronHandler('open book link checker', async () => {
  await seedSources(null);
  const r = await checkSources(null);
  await audit({ kind: 'system', id: 'cron', name: 'Weekly link check' }, 'sources.check', 'all', `${r.checked} checked, ${r.problems.length} problems: ${r.problems.map((p) => `${p.name} (${p.status})`).join('; ').slice(0, 450)}`);
  return { checked: r.checked, problems: r.problems.length };
});

export const GET = handle;
export const POST = handle;

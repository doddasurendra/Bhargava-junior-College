import { buildBackup } from '@/lib/admin/backup';
import { getStaffSession } from '@/lib/crm/auth';
import { todayIST } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getStaffSession();
  if (!user) return new Response('Not found', { status: 404 });
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const data = await buildBackup(user, { ip, userAgent: req.headers.get('user-agent') });
  if (!data) return new Response('Not found', { status: 404 });
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="bjc-backup-${todayIST()}.json"`, 'Cache-Control': 'private, no-store' },
  });
}

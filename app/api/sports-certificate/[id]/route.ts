import { getAppUser } from '@/lib/app/service';
import { getStaffSession } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { sportsCertificatePdf } from '@/lib/studentLife/certificatePdf';
import { achievementById } from '@/lib/studentLife/sports';

export const dynamic = 'force-dynamic';

/** Certificate for one recorded achievement: sports staff, or the student / parent it belongs to. */
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const a = await achievementById(params.id);
  const staff = await getStaffSession();
  let allowed = !!staff && (can(staff, 'sports.view') || can(staff, 'sports.manage'));
  if (!allowed) {
    const u = await getAppUser();
    const p = u?.active;
    if (!staff && !u) return new Response('Sign in first.', { status: 401 });
    allowed = !!a && !!p && (p.kind === 'student' || p.kind === 'parent') && p.studentId === a.studentId;
  }
  if (!allowed) return new Response('Not allowed.', { status: 403 });
  if (!a) return new Response('Not found.', { status: 404 });
  const pdf = await sportsCertificatePdf(a);
  return new Response(Buffer.from(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="certificate-${params.id.slice(0, 8)}.pdf"`, 'Cache-Control': 'private, no-store' } });
}

import { NextResponse } from 'next/server';
import { getAuthStore } from '@/lib/auth/store';
import { getRealStaff, getStaffSession, requestCtx, stopViewAs } from '@/lib/crm/auth';

export const dynamic = 'force-dynamic';

/** Ends "view as" (a GET, because every POST is blocked while viewing as someone). */
export async function GET(req: Request) {
  const [me, viewed] = await Promise.all([getRealStaff(), getStaffSession()]);
  if (me && viewed?.viewedBy) {
    const ctx = requestCtx();
    await getAuthStore().logEvent({ staffId: viewed.id, actorId: me.id, email: null, success: true, method: 'admin', reason: 'view-as ended', ip: ctx.ip, userAgent: ctx.userAgent?.slice(0, 300) ?? null });
  }
  stopViewAs();
  return NextResponse.redirect(new URL('/crm/staff', req.url));
}

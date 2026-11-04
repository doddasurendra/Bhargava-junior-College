import { NextResponse, type NextRequest } from 'next/server';

/**
 * Cheap gates. The cookie's signature, expiry, server-side session record and roles are verified on every
 * page and action (lib/crm/auth.ts, lib/app/service.ts); this only redirects obvious signed-out requests and
 * enforces that "view as" is read-only.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === '/app' || pathname.startsWith('/app/')) {
    if (pathname.startsWith('/app/login')) return withNoIndex(NextResponse.next());
    if (!req.cookies.get('bjc_app')) return NextResponse.redirect(new URL('/app/login', req.url));
    return withNoIndex(NextResponse.next());
  }
  if (pathname.startsWith('/crm/login')) return withNoIndex(NextResponse.next());
  if (!req.cookies.get('bjc_staff')) return NextResponse.redirect(new URL('/crm/login', req.url));
  // §9A.4 "view as" is for support: a Super Admin sees what the person sees but cannot change anything.
  // Server actions are POSTs; ending "view as" is a GET to /crm/view-as/stop.
  if (req.cookies.get('bjc_viewas') && req.method !== 'GET' && req.method !== 'HEAD') {
    return withNoIndex(new NextResponse('Read-only while viewing as another user. Stop “view as” to make changes.', { status: 403 }));
  }
  return withNoIndex(NextResponse.next());
}

function withNoIndex(res: NextResponse) {
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return res;
}

export const config = { matcher: ['/crm', '/crm/:path*', '/app', '/app/:path*'] };

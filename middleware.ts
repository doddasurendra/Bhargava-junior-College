import { NextResponse, type NextRequest } from 'next/server';

/**
 * Cheap gates. The cookie's signature, expiry, server-side session record and roles are verified on every
 * page and action (lib/crm/auth.ts, lib/app/service.ts); this only redirects obvious signed-out requests and
 * enforces that "view as" is read-only.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === '/app' || pathname.startsWith('/app/')) {
    if (pathname.startsWith('/app/login') || pathname.startsWith('/app/register') || pathname.startsWith('/app/verify-email') || pathname.startsWith('/app/forgot-password')) return withNoIndex(NextResponse.next());
    if (!req.cookies.get('bjc_app')) return NextResponse.redirect(new URL('/app/login', req.url));
    // the app layout checks per-page access (e.g. pending sign-ups) on the server; it needs the path
    const h = new Headers(req.headers);
    h.set('x-bjc-path', pathname);
    return withNoIndex(NextResponse.next({ request: { headers: h } }));
  }
  if (pathname.startsWith('/crm/login')) return withNoIndex(NextResponse.next());
  if (!req.cookies.get('bjc_staff')) {
    // remember the page they asked for (e.g. /crm/summary) so sign-in returns them there, not to a generic home
    const to = new URL('/crm/login', req.url);
    if (pathname !== '/crm' && pathname !== '/crm/') to.searchParams.set('next', pathname + req.nextUrl.search);
    return NextResponse.redirect(to);
  }
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

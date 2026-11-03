import { NextResponse, type NextRequest } from 'next/server';

/**
 * Cheap gate for the staff CRM: no session cookie → login page. The cookie's signature, expiry and the
 * user's roles are verified server-side on every page and action (lib/crm/auth.ts).
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
  return withNoIndex(NextResponse.next());
}

function withNoIndex(res: NextResponse) {
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return res;
}

export const config = { matcher: ['/crm', '/crm/:path*', '/app', '/app/:path*'] };

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const ADMIN_COOKIE = 'admin_token';

const WEB_PROTECTED_ROUTES = ['/home', '/review', '/commandview'];
const API_PROTECTED_PREFIXES = ['/api/review'];

function hasAdminSession(request: NextRequest) {
  return Boolean(request.cookies.get(ADMIN_COOKIE)?.value);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdmin = hasAdminSession(request);

  const matchRoute = (route: string) =>
    pathname === route || pathname.startsWith(`${route}/`);

  const needsWebGuard = WEB_PROTECTED_ROUTES.some(matchRoute);
  if (needsWebGuard && !isAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = '/analytics';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  const needsApiGuard = API_PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
  if (needsApiGuard && !isAdmin) {
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: 'अनधिकृत अनुरोध (Unauthorized)',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/home/:path*', '/review/:path*', '/commandview/:path*', '/api/review/:path*'],
};

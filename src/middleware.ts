import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Allow login page, static assets, and api routes
  if (
    path.startsWith('/login') ||
    path.startsWith('/_next') ||
    path.startsWith('/api') ||
    path.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check for session cookies
  const devCookie = request.cookies.get('hr_dev_session_user')?.value;
  const supabaseAuthCookie = request.cookies.getAll().some((c) => c.name.includes('auth-token'));

  // If no session cookie exists, redirect cleanly to /login at the HTTP level
  if (!devCookie && !supabaseAuthCookie) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

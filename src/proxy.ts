// Edge proxy (Next.js 16; replaces the old `middleware` convention). TSNAP-037.
// Cheap cookie-presence gate at the edge; the actual session validation happens in
// the pages via getCurrentUser() (defense in depth). We deliberately do NOT import
// lib/auth here — it pulls node-only `crypto`/Supabase into the edge runtime — so the
// cookie name is inlined.
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED = ['/dashboard', '/receipts'];
const SESSION_COOKIE = 'session';

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!isProtected) return NextResponse.next();

  if (!req.cookies.get(SESSION_COOKIE)?.value) {
    const url = new URL('/login', req.url);
    url.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/dashboard/:path*', '/receipts/:path*'] };

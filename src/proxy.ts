// Edge proxy (Next.js 16; replaces the old `middleware` convention). TSNAP-037.
// Two jobs:
//  1. Cheap cookie-presence gate on protected routes (actual session validation happens
//     in the pages via getCurrentUser() — defense in depth). We deliberately do NOT import
//     lib/auth here — it pulls node-only `crypto`/Supabase into the edge runtime — so the
//     cookie name is inlined.
//  2. Assign a sticky 50/50 hero-copy A/B variant on the landing page so the server can
//     render the chosen copy on first paint (flash-free). See lib/ab.ts.
import { NextResponse, type NextRequest } from 'next/server';
import { AB_HERO_COOKIE, isHeroVariant } from '@/lib/ab';

const PROTECTED = ['/dashboard', '/receipts'];
const SESSION_COOKIE = 'session';

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Landing page: ensure a hero A/B variant cookie exists.
  if (pathname === '/') {
    const existing = req.cookies.get(AB_HERO_COOKIE)?.value;
    if (isHeroVariant(existing)) return NextResponse.next();

    // Copy A/B is OFF (DEC-079): with effectively zero traffic a split can't reach significance,
    // so everyone gets the champion copy (A — the problem-framed "what / why" hero). The B/C
    // arms still render via a forced `ab_hero=B|C` cookie for demos/user-testing, and the split
    // re-enables by restoring `Math.random() < 0.5 ? 'A' : 'B'` here once traffic justifies it.
    const variant = 'A';
    req.cookies.set(AB_HERO_COOKIE, variant); // visible to this request's RSC render
    const res = NextResponse.next({ request: { headers: req.headers } });
    res.cookies.set(AB_HERO_COOKIE, variant, {
      path: '/',
      maxAge: 60 * 60 * 24 * 180, // 180 days
      sameSite: 'lax',
    });
    return res;
  }

  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!isProtected) return NextResponse.next();

  if (!req.cookies.get(SESSION_COOKIE)?.value) {
    const url = new URL('/login', req.url);
    url.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/', '/dashboard/:path*', '/receipts/:path*'] };

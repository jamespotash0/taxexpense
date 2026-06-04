// POST /api/auth/logout — destroy the session + clear the cookie, then redirect to /login.
// POST (not GET) so a cross-site <img>/link can't force-logout a user: SameSite=lax means the
// session cookie isn't sent on a cross-site POST, so forged logout requests can't authenticate.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { destroySession, clearSessionCookie, SESSION_COOKIE } from '@/lib/auth';

export async function POST(req: Request): Promise<NextResponse> {
  const store = await cookies();
  await destroySession(store.get(SESSION_COOKIE)?.value);
  // 303 See Other → the browser follows with a GET, so /login renders normally.
  const res = NextResponse.redirect(new URL('/login', req.url), 303);
  clearSessionCookie(res);
  return res;
}

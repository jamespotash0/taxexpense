// GET /api/auth/logout — destroy the session + clear the cookie, then redirect to /login.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { destroySession, clearSessionCookie, SESSION_COOKIE } from '@/lib/auth';

export async function GET(req: Request): Promise<NextResponse> {
  const store = await cookies();
  await destroySession(store.get(SESSION_COOKIE)?.value);
  const res = NextResponse.redirect(new URL('/login', req.url));
  clearSessionCookie(res);
  return res;
}

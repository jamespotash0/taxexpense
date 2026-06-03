// Phone-OTP auth + sessions (TSNAP-035/036/037, DEC-006 hardening).
// OWNER: Emma + Jordan.
//
// Security posture (Jordan / EPIC-7):
//  - Codes: crypto.randomInt, 10-min expiry, max 5 attempts, constant-time compare.
//  - Request rate limit: 3 per phone per 15 min.
//  - Sessions: 256-bit opaque random token (not a guessable id). Only the SHA-256 HASH
//    of the token is stored server-side (DEC-030) — a DB read can't replay live sessions.
//    The raw token lives only in an HTTP-only/secure/sameSite=lax cookie.
//  - Login requires an EXISTING user (SMS-first) — we never create accounts here.

import { randomInt, randomBytes, timingSafeEqual, createHash } from 'crypto';
import { getSupabaseAdmin } from './supabase';
import { getUserByPhone, type AppUser } from './users';

export const SESSION_COOKIE = 'session';
const OTP_TTL_MIN = 10;
const OTP_WINDOW_MIN = 15;
const OTP_MAX_PER_WINDOW = 3;
const OTP_MAX_ATTEMPTS = 5;
const SESSION_DAYS = 30;
export const SESSION_MAX_AGE_SECONDS = SESSION_DAYS * 24 * 60 * 60;

export type RequestCodeResult =
  | { ok: true; code: string } // code returned ONLY to the route, to send via SMS — never to the client
  | { ok: false; reason: 'rate_limited' };

/** Generate + store a 6-digit code for a phone, enforcing the request rate limit. */
export async function requestCode(phoneE164: string): Promise<RequestCodeResult> {
  const admin = getSupabaseAdmin();
  const windowStart = new Date(Date.now() - OTP_WINDOW_MIN * 60 * 1000).toISOString();

  const { count, error: countErr } = await admin
    .from('auth_codes')
    .select('id', { count: 'exact', head: true })
    .eq('phone_number', phoneE164)
    .gte('created_at', windowStart);
  if (countErr) throw countErr;
  if ((count ?? 0) >= OTP_MAX_PER_WINDOW) return { ok: false, reason: 'rate_limited' };

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const expires_at = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000).toISOString();
  const { error } = await admin
    .from('auth_codes')
    .insert({ phone_number: phoneE164, code, expires_at, used: false, attempts: 0 });
  if (error) throw error;

  return { ok: true, code };
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export type VerifyResult =
  | { ok: true; token: string; user: AppUser }
  | { ok: false; reason: 'no_code' | 'expired' | 'too_many_attempts' | 'mismatch' | 'no_account' };

/** Verify a submitted code, and on success create a session. */
export async function verifyCode(phoneE164: string, submitted: string): Promise<VerifyResult> {
  const admin = getSupabaseAdmin();

  const { data: row, error } = await admin
    .from('auth_codes')
    .select('id, code, expires_at, used, attempts')
    .eq('phone_number', phoneE164)
    .eq('used', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!row) return { ok: false, reason: 'no_code' };

  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: 'expired' };
  if ((row.attempts ?? 0) >= OTP_MAX_ATTEMPTS) {
    await admin.from('auth_codes').update({ used: true }).eq('id', row.id);
    return { ok: false, reason: 'too_many_attempts' };
  }

  if (!safeEqual(String(row.code), submitted.trim())) {
    await admin.from('auth_codes').update({ attempts: (row.attempts ?? 0) + 1 }).eq('id', row.id);
    return { ok: false, reason: 'mismatch' };
  }

  // Correct code — require an existing (SMS-created) account.
  const user = await getUserByPhone(phoneE164);
  if (!user) {
    await admin.from('auth_codes').update({ used: true }).eq('id', row.id);
    return { ok: false, reason: 'no_account' };
  }

  await admin.from('auth_codes').update({ used: true }).eq('id', row.id);
  const token = await createSession(user.id);
  return { ok: true, token, user };
}

/** SHA-256 of a session token (base64url). The token is 256-bit random, so an unsalted
 *  fast hash is appropriate — it's a high-entropy secret, not a password. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

/** Create a session row, return the opaque RAW token to set as a cookie (only its hash is stored). */
export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const expires_at = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
  const { error } = await getSupabaseAdmin()
    .from('sessions')
    .insert({ user_id: userId, token_hash: hashToken(token), expires_at });
  if (error) throw error;
  return token;
}

/** Resolve a session token to its user, or null if missing/expired. */
export async function getSessionUser(token: string | undefined | null): Promise<AppUser | null> {
  if (!token) return null;
  const admin = getSupabaseAdmin();
  const { data: session, error } = await admin
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token_hash', hashToken(token))
    .maybeSingle();
  if (error) throw error;
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) return null;

  const { data: user, error: uErr } = await admin
    .from('users')
    .select('*')
    .eq('id', session.user_id)
    .maybeSingle();
  if (uErr) throw uErr;
  return (user as AppUser | null) ?? null;
}

/** Invalidate a session (logout). */
export async function destroySession(token: string | undefined | null): Promise<void> {
  if (!token) return;
  await getSupabaseAdmin().from('sessions').delete().eq('token_hash', hashToken(token));
}

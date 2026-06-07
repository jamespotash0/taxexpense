// One-tap subscribe magic link (DEC-062). An SMS user we've already verified (we're texting their
// number) shouldn't have to log in via OTP before they can pay. We mint a SIGNED token encoding
// their org id + an expiry; the /api/billing/subscribe-link route verifies it and drops them
// straight into Stripe Checkout — no session required.
//
// Security (Jordan): HMAC-SHA256 over org+exp with a server secret; the org id ONLY ever comes
// from the verified token, never from the URL. Worst case for a leaked link is that someone opens
// Checkout for that org and pays with their own card (i.e. subscribes the owner) — negligible. We
// keep a bounded expiry anyway. If SUBSCRIBE_LINK_SECRET isn't configured, link generation falls
// back to /pricing so nothing breaks.

import crypto from 'crypto';
import { optionalEnv, PUBLIC_ENV } from './env';

// Long enough to act on a trial-ending nudge and the follow-up "ended" message.
const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function secret(): string | null {
  return optionalEnv('SUBSCRIBE_LINK_SECRET') || null;
}

function sign(payload: string, key: string): string {
  return crypto.createHmac('sha256', key).update(payload).digest('base64url');
}

/** Mint a signed token for an org, or null if no signing secret is configured.
 *  The expiry is bucketed to the start of the UTC day so the SAME org yields the SAME token (and
 *  thus the same subscribe URL / paywall message) for every call that day, instead of a new token
 *  per message — a blocked user who keeps texting sees an identical, cacheable response. The token
 *  is still bounded (≤ TOKEN_TTL_MS) and rotates daily. */
export function makeSubscribeToken(orgId: string, now: number = Date.now()): string | null {
  const key = secret();
  if (!key) return null;
  const exp = Math.floor(now / DAY_MS) * DAY_MS + TOKEN_TTL_MS; // deterministic within the UTC day
  const payload = `${orgId}.${exp}`; // orgId is a UUID (no dots) → safe to split on "."
  return Buffer.from(`${payload}.${sign(payload, key)}`).toString('base64url');
}

/** Verify a token → org id, or null if missing-secret / malformed / tampered / expired. */
export function verifySubscribeToken(token: string, now: number = Date.now()): string | null {
  const key = secret();
  if (!key || !token) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const parts = decoded.split('.');
  if (parts.length !== 3) return null;
  const [orgId, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < now) return null;
  const expected = sign(`${orgId}.${expStr}`, key);
  // Constant-time compare (and guard equal length, which timingSafeEqual requires).
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  return orgId;
}

/**
 * A one-tap subscribe URL for an org. Returns the magic link when SUBSCRIBE_LINK_SECRET is set,
 * else gracefully falls back to the /pricing page (which still works, just with a login step).
 */
export function subscribeUrl(orgId: string): string {
  const base = PUBLIC_ENV.appUrl || 'https://tallywhy.com';
  const token = makeSubscribeToken(orgId);
  return token ? `${base}/api/billing/subscribe-link?t=${token}` : `${base}/pricing`;
}

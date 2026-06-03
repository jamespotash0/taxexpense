// Shared helpers for API route handlers (src/app/api/**). Collapses the auth/parse/
// error/cron boilerplate that was copy-pasted across ~10 routes into one place so the
// error contracts ({ error, status }) stay consistent. Server-only.
import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';
import { getCurrentUser, type AppUser } from './session';
import { optionalEnv, PUBLIC_ENV } from './env';
import { log } from './log';

/** Uniform JSON error response: { error } with the given status (plus optional extra fields). */
export function jsonError(error: string, status: number, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ error, ...extra }, { status });
}

/**
 * Resolve the current user or a 401 response. Usage:
 *   const user = await requireUser();
 *   if (user instanceof NextResponse) return user;
 */
export async function requireUser(): Promise<AppUser | NextResponse> {
  const user = await getCurrentUser();
  return user ?? jsonError('unauthorized', 401);
}

/**
 * Parse + validate a JSON body, or return a 400 response. Usage:
 *   const body = await parseBody(req, Schema);
 *   if (body instanceof NextResponse) return body;
 */
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T | NextResponse> {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  return parsed.success ? parsed.data : jsonError('invalid_request', 400);
}

/**
 * Guard a cron route with CRON_SECRET. Returns a 403 response if unauthorized, else null.
 * Usage:
 *   const denied = requireCron(req);
 *   if (denied) return denied;
 */
export function requireCron(req: Request): NextResponse | null {
  const secret = optionalEnv('CRON_SECRET');
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return jsonError('forbidden', 403);
  }
  return null;
}

/** Log an error (PII-safe message only) and return a uniform 500. */
export function serverError(event: string, err: unknown, fields?: Record<string, unknown>): NextResponse {
  log.error(event, { ...fields, message: err instanceof Error ? err.message : 'unknown' });
  return jsonError('server_error', 500);
}

/** Public base URL for building redirect/return links: configured app URL, else request origin. */
export function getAppBase(req: Request): string {
  return PUBLIC_ENV.appUrl || new URL(req.url).origin;
}

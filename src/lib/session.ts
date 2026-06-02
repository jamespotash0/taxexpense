// Server-side current-user helper for Server Components / route handlers / proxy.
// Reads the session cookie via next/headers and resolves it to a user.
import { cookies } from 'next/headers';
import { getSessionUser, SESSION_COOKIE } from './auth';
import type { AppUser } from './users';

/** The logged-in user for the current request, or null. */
export async function getCurrentUser(): Promise<AppUser | null> {
  const store = await cookies();
  return getSessionUser(store.get(SESSION_COOKIE)?.value);
}

export type { AppUser };

// Edge proxy (Next.js 16 renamed the old `middleware` convention to `proxy`).
// Pass-through for EPIC-1.
// OWNER: Emma + Jordan. EPIC-4/EPIC-7, Day 6: gate /dashboard and /receipts behind
// a valid session cookie and redirect to /login otherwise.
import { NextResponse } from 'next/server';

export function proxy() {
  // TODO(EPIC-4): session gating for protected routes.
  return NextResponse.next();
}

// No matcher yet — proxy is a no-op until auth lands.
export const config = { matcher: [] };

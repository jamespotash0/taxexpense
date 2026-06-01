// GET /api/receipts — list the authed user's receipts (filter/sort/paginate).
// OWNER: Emma. EPIC-4 (claude_files/specs/04-web-app.md), Day 6-7.
// Must be session-authed and org-scoped via lib/db.orgTable().
import { NextResponse } from 'next/server';

export async function GET() {
  // TODO(EPIC-4): auth -> orgTable('receipts').select() with query-param filters.
  return NextResponse.json({ error: 'not_implemented' }, { status: 501 });
}

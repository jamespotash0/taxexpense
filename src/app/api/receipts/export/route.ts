// GET /api/receipts/export?format=csv|quickbooks — export receipts as CSV.
// OWNER: Emma. EPIC-4, Day 7.
import { NextResponse } from 'next/server';

export async function GET() {
  // TODO(EPIC-4): auth -> org-scoped query -> stream CSV (standard + QBO-compatible).
  return NextResponse.json({ error: 'not_implemented' }, { status: 501 });
}

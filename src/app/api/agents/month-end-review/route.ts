// POST /api/agents/month-end-review — run the month-end review agent on demand and return
// a DRAFT accountant email for the user to review (Phase 2 — AGENTS-VS-WORKFLOWS.md).
// "Run when the user explicitly requests them. They have well-defined goals." (the doc)
// Auth-required; org-scoped. Produces a draft only — never sends. The user sends via
// the existing /api/email-accountant path after reviewing.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, parseBody, serverError } from '@/lib/api';
import { runMonthEndReview } from '@/lib/agents/month-end-review';

// Agent loops over several model calls + image fetches — give it more room than a single call.
export const maxDuration = 60;

// 'YYYY-MM'; defaults to the current month when omitted.
const BodySchema = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional() });

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export async function POST(req: Request): Promise<NextResponse> {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const body = await parseBody(req, BodySchema);
  if (body instanceof NextResponse) return body;

  try {
    const draft = await runMonthEndReview(user, body.month ?? currentMonth());
    return NextResponse.json({ ok: true, draft });
  } catch (err) {
    return serverError('month_end_review_failed', err, { user: user.id });
  }
}

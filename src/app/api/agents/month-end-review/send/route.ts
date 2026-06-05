// POST /api/agents/month-end-review/send — email the user's (possibly edited) review draft to
// their configured accountant. This is the human-in-the-loop step: the agent only ever produced
// a DRAFT; nothing leaves Tally until the user reviews it and hits send here.
// Jordan (SEC): only ever send to the configured accountant_email, never an arbitrary address.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, parseBody, jsonError, serverError } from '@/lib/api';
import { sendEmail } from '@/lib/email';

const BodySchema = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20_000),
});

// Render the user's plain-text draft as a simple HTML email (preserve line breaks; escape markup).
function toHtml(text: string): string {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<div style="font-family:system-ui,sans-serif;max-width:560px;white-space:pre-wrap;font-size:14px;line-height:1.5">${esc}
    <p style="color:#999;font-size:12px;margin-top:16px">Prepared with Tally — a recordkeeping export, not tax advice.</p>
  </div>`;
}

export async function POST(req: Request): Promise<NextResponse> {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (!user.accountant_email) {
    return jsonError('no_accountant_email', 400, { message: 'Add your accountant’s email in Settings first.' });
  }

  const body = await parseBody(req, BodySchema);
  if (body instanceof NextResponse) return body;

  try {
    await sendEmail({ to: user.accountant_email, subject: body.subject, html: toHtml(body.body) });
    return NextResponse.json({ ok: true, sent_to: user.accountant_email });
  } catch (err) {
    return serverError('send_review_draft_failed', err, { user: user.id });
  }
}

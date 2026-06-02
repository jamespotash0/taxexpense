// Transactional email via Resend (TSNAP-046). OWNER: Emma.
import { Resend } from 'resend';
import { requireEnv, optionalEnv } from './env';

let _resend: Resend | null = null;
function client(): Resend {
  if (!_resend) _resend = new Resend(requireEnv('RESEND_API_KEY'));
  return _resend;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string; // Buffer or base64 string
}

/** Send an email. From address comes from RESEND_FROM (must be a verified domain). */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}): Promise<void> {
  const from = optionalEnv('RESEND_FROM') ?? 'Tally <onboarding@resend.dev>';
  const { error } = await client().emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    attachments: opts.attachments,
  });
  if (error) throw new Error(typeof error === 'string' ? error : (error.message ?? 'email_send_failed'));
}

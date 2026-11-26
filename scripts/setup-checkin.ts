// One-time "we've made some changes" check-in for users who onboarded before the work-location and
// driving questions existed (DEC-098). Texts each one the intro + location question and marks
// users.setup_checkin_at; their replies are handled by handleSetupCheckin (src/lib/onboarding.ts).
//
//   npm run setup-checkin            # dry run: lists who would be texted, sends nothing
//   npm run setup-checkin -- --send  # actually texts them
//
// Skips: anyone still in onboarding, opted out (STOP), already answered, or already checked in.
// Requires migration 0034 and the messaging env (.env.local).

import { getSupabaseAdmin } from '../src/lib/supabase';
import { sendMessage } from '../src/lib/twilio';
import { logConversation } from '../src/lib/conversations';
import { setupCheckinIntro, DEFAULT_AGENT_NAME } from '../src/lib/prompts';
import type { AppUser } from '../src/lib/users';

const send = process.argv.includes('--send');

async function main() {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('users')
    .select('*')
    .eq('onboarding_completed', true)
    .is('sms_opted_out_at', null)
    .is('work_location', null)
    .is('setup_checkin_at', null);
  if (error) throw error;
  const users = (data ?? []) as AppUser[];

  console.log(`${users.length} user(s) to check in${send ? '' : ' (dry run, nothing sent)'}:`);
  for (const u of users) {
    const first = (u.full_name ?? '').trim().split(/\s+/)[0] || undefined;
    const text = setupCheckinIntro(first, u.agent_name ?? DEFAULT_AGENT_NAME);
    console.log(`\n→ ***${u.phone_number.slice(-4)}\n${text}`);
    if (!send) continue;
    await sendMessage(u.phone_number, text);
    await admin.from('users').update({ setup_checkin_at: new Date().toISOString() }).eq('id', u.id);
    await logConversation({ userId: u.id, organizationId: u.organization_id, direction: 'outbound', messageText: text });
    console.log('  sent');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

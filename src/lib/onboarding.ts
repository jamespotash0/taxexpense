// Onboarding (TSNAP-017, DEC-013/DEC-014). Config-driven + deterministic — NOT
// LLM-generated (reliability at the highest-drop-off moment). OWNER: Raj + Sofia.
//
// 4 questions: name → work type → entity type → default payment account. Name is
// captured over SMS (warm, easy); email + org name are collected later at the
// dashboard, not over SMS (DEC-014). Adaptivity lives at EXPENSE time, not here.
//
// Step semantics (onboarding_step):
//   0          → brand new; first inbound is the trigger → send Q[0] (name), step→1
//   N (1..len) → message answers Q[N-1]; store it, send Q[N] (with {{name}}) or complete
// Re-ask: empty/whitespace answer (e.g. a photo with no text) → re-ask, no advance.

import {
  ONBOARDING_Q_NAME,
  ONBOARDING_Q_WORK,
  ONBOARDING_Q_ENTITY,
  ONBOARDING_Q_PAYMENT,
  onboardingComplete,
} from './prompts';
import { updateUser, type AppUser } from './users';
import { PUBLIC_ENV } from './env';

type OnboardingKey = 'full_name' | 'business_type' | 'entity_type' | 'default_payment_account';

interface OnboardingQuestion {
  key: OnboardingKey;
  prompt: string; // may contain {{name}}, filled at send time
  parse: (text: string) => string;
}

/** Strip common lead-ins ("I'm", "my name is") and keep a clean display name. */
export function parseName(text: string): string {
  return text
    .trim()
    .replace(/^(hi[, ]+|hey[, ]+)?(i'?m|it'?s|my name is|this is|call me)\s+/i, '')
    .replace(/[.!]+$/, '')
    .trim()
    .slice(0, 80);
}

/** Map free text to an entity_type enum value (TSNAP-017 keyword rules). */
export function parseEntityType(text: string): 'sole_prop' | 'smllc' | 's_corp' | 'c_corp' | 'unknown' {
  const t = text.toLowerCase();
  // Check S/C-corp first — an "LLC taxed as an S-corp" is an S-corp for tax purposes.
  if (/\bs[-\s]?corp/.test(t) || t.includes('s corporation')) return 's_corp';
  if (/\bc[-\s]?corp/.test(t) || t.includes('c corporation')) return 'c_corp';
  if (t.includes('llc') || t.includes('single-member') || t.includes('single member')) return 'smllc';
  if (t.includes('sole') || t.includes('prop')) return 'sole_prop';
  return 'unknown'; // "not sure" is a valid answer, not an error
}

/** Map free text to a default_payment_account enum value. */
export function parsePaymentAccount(text: string): 'business' | 'personal' | 'unknown' {
  const t = text.toLowerCase();
  if (t.includes('business')) return 'business';
  if (t.includes('personal')) return 'personal';
  return 'unknown'; // "mixed"/"both"/unclear is valid
}

// The tunable onboarding script. Reorder / reword / add a question here.
// NOTE (DEC-013 follow-up): entity_type does not change Schedule C treatment in V1
// (sole prop ≈ single-member LLC). Instrument per-step completion before deciding
// whether to keep it. email + org name are collected at the dashboard (DEC-014).
export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  { key: 'full_name', prompt: ONBOARDING_Q_NAME, parse: parseName },
  { key: 'business_type', prompt: ONBOARDING_Q_WORK, parse: (t) => t.trim().slice(0, 100) },
  { key: 'entity_type', prompt: ONBOARDING_Q_ENTITY, parse: parseEntityType },
  { key: 'default_payment_account', prompt: ONBOARDING_Q_PAYMENT, parse: parsePaymentAccount },
];

/** First name for friendly interpolation; falls back to "there". */
function firstName(fullName: string | null | undefined): string {
  const n = (fullName ?? '').trim().split(/\s+/)[0];
  return n || 'there';
}

function render(prompt: string, name: string): string {
  return prompt.replace(/\{\{name\}\}/g, name);
}

/** An answer is unusable only if it's empty (e.g. a photo with no caption). */
function isUsableAnswer(text: string): boolean {
  return text.trim().length > 0;
}

/**
 * Advance onboarding by one step given the user's latest message. Returns the SMS reply.
 * Caller only invokes this while user.onboarding_completed === false.
 */
export async function handleOnboarding(user: AppUser, messageText: string): Promise<string> {
  const step = user.onboarding_step;

  // Step 0: first contact. Normally this greets + asks for the name. But a user can be
  // pre-seeded from the WEB funnel (preseedUserByPhone) with name/work already known — in
  // that case jump straight to the first question they HAVEN'T answered. The triggering
  // message is only a trigger, never an answer, so step 0 always just SENDS a question and
  // advances; we set onboarding_step so the NEXT inbound answers that same question.
  if (step <= 0) {
    const firstUnanswered = ONBOARDING_QUESTIONS.findIndex((q) => !user[q.key]);
    if (firstUnanswered === -1) {
      // Everything was pre-seeded → nothing left to ask; complete immediately.
      const name = firstName(user.full_name);
      await updateUser(user.id, {
        onboarding_completed: true,
        onboarding_step: ONBOARDING_QUESTIONS.length + 1,
      });
      return onboardingComplete(PUBLIC_ENV.appUrl || 'https://tallywhy.com', name === 'there' ? undefined : name);
    }
    await updateUser(user.id, { onboarding_step: firstUnanswered + 1 });
    return render(ONBOARDING_QUESTIONS[firstUnanswered].prompt, firstName(user.full_name));
  }

  const answeredIndex = Math.min(step - 1, ONBOARDING_QUESTIONS.length - 1);
  const current = ONBOARDING_QUESTIONS[answeredIndex];

  // Light validation: re-ask the same question if the answer is empty (no advance).
  if (!isUsableAnswer(messageText)) {
    return `Sorry, I didn't catch that.\n\n${render(current.prompt, firstName(user.full_name))}`;
  }

  const value = current.parse(messageText);
  const patch: Partial<AppUser> = { [current.key]: value } as Partial<AppUser>;

  // Name for interpolating the NEXT prompt: the value we just parsed if this was the
  // name step, otherwise whatever's already stored.
  const name = firstName(current.key === 'full_name' ? value : user.full_name);
  const nextIndex = answeredIndex + 1;

  if (nextIndex < ONBOARDING_QUESTIONS.length) {
    patch.onboarding_step = nextIndex + 1;
    await updateUser(user.id, patch);
    return render(ONBOARDING_QUESTIONS[nextIndex].prompt, name);
  }

  // All questions answered → complete.
  patch.onboarding_completed = true;
  patch.onboarding_step = ONBOARDING_QUESTIONS.length + 1;
  await updateUser(user.id, patch);
  return onboardingComplete(PUBLIC_ENV.appUrl || 'https://tallywhy.com', name === 'there' ? undefined : name);
}

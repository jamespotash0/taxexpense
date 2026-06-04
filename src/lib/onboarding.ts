// Onboarding (TSNAP-017, DEC-013/014/058). Config-driven + deterministic — NOT
// LLM-generated (reliability at the highest-drop-off moment). OWNER: Raj + Sofia.
//
// Setup questions: name → work type → entity type → [business name] → default payment account,
// then one OPTIONAL pain-research question ("worst part of tax time?", DEC-057) that lands in the
// leads table. Business name (DEC-058) is asked ONLY for users who named a real entity
// (sole-prop / LLC / S- or C-corp) and persists to organizations.name; a "not sure"/1099 user who
// likely operates under their own name is skipped. Name is captured over SMS (warm, easy); email
// is still collected at the dashboard. Per-question adaptivity uses `when`; richer adaptivity
// lives at EXPENSE time.
//
// Step semantics (onboarding_step), len = ONBOARDING_QUESTIONS.length:
//   0          → brand new; first inbound is the trigger → send first askable question, step→idx+1
//   N (1..len) → message answers Q[N-1]; store it, send the next askable question or the pain Q
//   len+1      → message is the (optional) pain answer; log to leads, complete (step→len+2)
// Skipped questions (gated by `when`) advance the step past them. Re-ask: empty/whitespace answer
// to a SETUP question (e.g. a photo) → re-ask, no advance. An empty/"skip" pain answer completes.

import {
  ONBOARDING_Q_NAME,
  ONBOARDING_Q_WORK,
  ONBOARDING_Q_ENTITY,
  ONBOARDING_Q_BUSINESS,
  ONBOARDING_Q_PAYMENT,
  ONBOARDING_Q_PAIN,
  onboardingComplete,
  onboardingJoinGreeting,
} from './prompts';
import { updateUser, getOrgOwner, getOrganizationName, updateOrganizationName, type AppUser } from './users';
import { insertLead } from './leads';
import { PUBLIC_ENV } from './env';

type UserKey = 'full_name' | 'business_type' | 'entity_type' | 'default_payment_account';
type OnboardingKey = UserKey | 'organization_name';

interface OnboardingQuestion {
  key: OnboardingKey;
  /** Where the answer persists: a user column, or the org's name. */
  target: 'user' | 'org';
  prompt: string; // may contain {{name}}, filled at send time
  /** Parse the answer; null means "no value" (e.g. a skipped optional question). */
  parse: (text: string) => string | null;
  /** Optional gate — the question is only asked when this returns true given answers so far. */
  when?: (user: AppUser) => boolean;
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

/** Clean a business name; null for an explicit skip / "no business name" answer. */
export function parseBusinessName(text: string): string | null {
  const t = text.trim();
  if (!t || /^(skip|none|no|nope|nah|n\/?a|just me|myself|i don'?t|own name)\.?$/i.test(t)) return null;
  return t.slice(0, 120);
}

/** True when the user named a real entity — sole-prop / LLC / S- or C-corp (DEC-058). A
 *  "not sure" / 1099 contractor (entity_type unknown or unset) often has no business name, so
 *  we skip the business-name question for them rather than force a blank field. */
export function hasNamedEntity(user: AppUser): boolean {
  return !!user.entity_type && user.entity_type !== 'unknown';
}

// The tunable onboarding script. Reorder / reword / add a question here.
// NOTE (DEC-013 follow-up): entity_type does not change Schedule C treatment in V1
// (sole prop ≈ single-member LLC). Instrument per-step completion before deciding
// whether to keep it. Business name is captured here for entity-having users (DEC-058);
// email is still collected at the dashboard (DEC-014).
export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  { key: 'full_name', target: 'user', prompt: ONBOARDING_Q_NAME, parse: parseName },
  { key: 'business_type', target: 'user', prompt: ONBOARDING_Q_WORK, parse: (t) => t.trim().slice(0, 100) },
  { key: 'entity_type', target: 'user', prompt: ONBOARDING_Q_ENTITY, parse: parseEntityType },
  // Business name — org-level, asked only after entity type and only for real entities (DEC-058).
  { key: 'organization_name', target: 'org', prompt: ONBOARDING_Q_BUSINESS, parse: parseBusinessName, when: hasNamedEntity },
  { key: 'default_payment_account', target: 'user', prompt: ONBOARDING_Q_PAYMENT, parse: parsePaymentAccount },
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

/** The stored value backing a question — a user column, or the org name for the org question. */
function answeredValueFor(q: OnboardingQuestion, user: AppUser, orgName: string | null): unknown {
  return q.target === 'org' ? orgName : (user as unknown as Record<string, unknown>)[q.key];
}

/** Ask a question now only if its `when` gate passes AND it isn't already answered. */
function shouldAsk(q: OnboardingQuestion, user: AppUser, orgName: string | null): boolean {
  if (q.when && !q.when(user)) return false;
  return !answeredValueFor(q, user, orgName);
}

/**
 * Advance onboarding by one step given the user's latest message. Returns the SMS reply.
 * Caller only invokes this while user.onboarding_completed === false.
 */
export async function handleOnboarding(user: AppUser, messageText: string): Promise<string> {
  const step = user.onboarding_step;
  // The business-name question lives on the org, so we need its current value to know whether it's
  // already answered (and to honor the co-owner pre-fill skip). One read per onboarding message.
  const orgName = await getOrganizationName(user.organization_id);

  // Step 0: first contact. Normally this greets + asks for the name. But an invited co-owner
  // (inviteToOrg) arrives with the org's business fields already filled — in that case jump
  // straight to the first question they HAVEN'T answered (just their name). The triggering
  // message is only a trigger, never an answer, so step 0 always just SENDS a question and
  // advances; we set onboarding_step so the NEXT inbound answers that same question.
  if (step <= 0) {
    const firstUnanswered = ONBOARDING_QUESTIONS.findIndex((q) => shouldAsk(q, user, orgName));
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

    // Join-aware greeting (DEC-045): an invited co-owner isn't the org owner and arrives with
    // the business fields pre-filled, so step 0 asks only their name. Greet them warmly and name
    // who added them, instead of the generic first-run greeting. (Solo owners fall through.)
    if (firstUnanswered === 0) {
      const owner = await getOrgOwner(user.organization_id);
      if (owner && owner.id !== user.id) {
        return onboardingJoinGreeting(owner.full_name ? firstName(owner.full_name) : undefined);
      }
    }
    return render(ONBOARDING_QUESTIONS[firstUnanswered].prompt, firstName(user.full_name));
  }

  // Final step (DEC-057): the optional pain-research question. Setup is functionally done; this
  // message is the answer to "worst part of tax time?". We log it to the leads table (best-effort,
  // never blocking) and complete. Empty (e.g. a photo) or "skip"/"no" just completes silently —
  // research never traps the user. Intercepted here because this step is past ONBOARDING_QUESTIONS.
  if (step >= ONBOARDING_QUESTIONS.length + 1) {
    const name = firstName(user.full_name);
    const answer = messageText.trim();
    const skipped = answer.length === 0 || /^(skip|no|nope|nah|pass|n\/?a)\.?$/i.test(answer);
    if (!skipped) {
      await insertLead({
        phone_number: user.phone_number,
        full_name: user.full_name,
        business_type: user.business_type,
        pain: answer.slice(0, 500),
        source: 'sms_onboarding',
      }).catch(() => { /* best-effort; never block completion on research capture */ });
    }
    await updateUser(user.id, {
      onboarding_completed: true,
      onboarding_step: ONBOARDING_QUESTIONS.length + 2,
    });
    return onboardingComplete(PUBLIC_ENV.appUrl || 'https://tallywhy.com', name === 'there' ? undefined : name);
  }

  const answeredIndex = Math.min(step - 1, ONBOARDING_QUESTIONS.length - 1);
  const current = ONBOARDING_QUESTIONS[answeredIndex];

  // Light validation: re-ask the same question if the answer is empty (no advance).
  if (!isUsableAnswer(messageText)) {
    return `Sorry, I didn't catch that.\n\n${render(current.prompt, firstName(user.full_name))}`;
  }

  const value = current.parse(messageText);

  // Persist to the right place: the org's name for the business-name question, else a user column.
  const patch: Partial<AppUser> = {};
  let answeredOrgName = orgName;
  if (current.target === 'org') {
    await updateOrganizationName(user.organization_id, value);
    answeredOrgName = value;
  } else {
    (patch as Record<string, unknown>)[current.key] = value;
  }

  // Name for interpolating the NEXT prompt: the value we just parsed if this was the
  // name step, otherwise whatever's already stored.
  const name = firstName(current.key === 'full_name' ? value : user.full_name);

  // Advance to the next question we should ask: skip ones already answered OR gated out by `when`
  // (e.g. the business-name question for a "not sure"/1099 user, DEC-058). A co-owner invited to
  // an existing org (DEC-045) likewise has business fields pre-filled, so this skips straight to
  // completion after their name. A brand-new user has nothing pre-filled, so it advances in order.
  const answeredUser = (current.target === 'user' ? { ...user, [current.key]: value } : user) as AppUser;
  let nextIndex = answeredIndex + 1;
  while (
    nextIndex < ONBOARDING_QUESTIONS.length &&
    !shouldAsk(ONBOARDING_QUESTIONS[nextIndex], answeredUser, answeredOrgName)
  ) {
    nextIndex++;
  }

  if (nextIndex < ONBOARDING_QUESTIONS.length) {
    patch.onboarding_step = nextIndex + 1;
    await updateUser(user.id, patch);
    return render(ONBOARDING_QUESTIONS[nextIndex].prompt, name);
  }

  // All setup questions answered → ask the one optional research question, then complete on the
  // next inbound (handled by the step >= length+1 branch above). DEC-057.
  patch.onboarding_step = ONBOARDING_QUESTIONS.length + 1;
  await updateUser(user.id, patch);
  return render(ONBOARDING_Q_PAIN, name);
}

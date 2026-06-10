// Business profile (Spec 09, Piece 1): turn a user's free-text "what do you do?" answer into a
// structured PRIOR that makes categorization profession-aware. Generated once, lazily, at the
// first expense — onboarding stays deterministic + fast (the onboarding header's rule: "richer
// adaptivity lives at EXPENSE time"). Reused on every categorization call via userContextLine.
// Best-effort throughout: any failure leaves business_profile null and the categorizer falls back
// to the bare business_type line (today's behavior), retrying on the next message. OWNER: Raj + Priya.

import { claudeJSON } from './llm';
import { SONNET_MODEL } from './claude';
import { BUSINESS_PROFILE_BUILDER_PROMPT } from './prompts';
import { isValidCategory } from './categories';
import { updateUser, type AppUser } from './users';
import { log } from './log';

export interface BusinessProfile {
  /** Short industry label derived from the user's description, e.g. "real estate agent". */
  industry: string;
  /** Whether the business sells/makes physical products vs. a pure service. Informational prior. */
  sells_product: boolean;
  /** Category keys (from the closed taxonomy) this profession commonly uses. */
  common_categories: string[];
  /** Profession-specific term/vendor → category hints, e.g. { "MLS": "professional_services" }. */
  synonyms: Record<string, string>;
  /** 1–3 plain sentences of categorization guidance for this profession (suggest-not-advise). */
  notes_for_categorizer: string;
}

/** Drop any synonym/common_category that isn't a real category key so a hallucinated label can
 *  never reach a categorization prompt as if it were valid — mirrors canonicalizeCategory's
 *  closed-taxonomy guarantee (DEC-065). Also clamps free-text lengths. Pure + testable. */
export function sanitizeProfile(raw: Partial<BusinessProfile> | null | undefined): BusinessProfile {
  const synonyms: Record<string, string> = {};
  for (const [term, cat] of Object.entries(raw?.synonyms ?? {})) {
    if (typeof cat === 'string' && isValidCategory(cat)) synonyms[term.slice(0, 40)] = cat;
  }
  return {
    industry: String(raw?.industry ?? '').slice(0, 80),
    sells_product: !!raw?.sells_product,
    common_categories: (raw?.common_categories ?? []).filter((c): c is string => typeof c === 'string' && isValidCategory(c)),
    synonyms,
    notes_for_categorizer: String(raw?.notes_for_categorizer ?? '').slice(0, 600),
  };
}

/** True when a profile carries no usable signal (vague description → empty everything). We skip
 *  storing these so we don't pin an empty prior and never retry. */
function isEmptyProfile(p: BusinessProfile): boolean {
  return !p.common_categories.length && !Object.keys(p.synonyms).length && !p.notes_for_categorizer.trim();
}

/** Build a structured profile from the user's free-text work description. Returns null when there's
 *  nothing usable to build from, the model call fails, or the result is empty — callers treat null
 *  as "no profile" and fall back to the bare business_type line. */
export async function generateBusinessProfile(
  businessType: string | null,
  entityType: string | null,
): Promise<BusinessProfile | null> {
  const desc = (businessType ?? '').trim();
  if (!desc) return null;
  try {
    const raw = await claudeJSON<Partial<BusinessProfile>>({
      model: SONNET_MODEL,
      system: BUSINESS_PROFILE_BUILDER_PROMPT,
      userText: `Work description: ${desc}\nEntity: ${entityType ?? 'unknown'}`,
      cacheSystem: true,
      maxTokens: 512,
    });
    const profile = sanitizeProfile(raw);
    return isEmptyProfile(profile) ? null : profile;
  } catch (err) {
    log.warn('business_profile_generate_failed', { message: err instanceof Error ? err.message : 'unknown' });
    return null;
  }
}

/** Render the profile as a compact PRIOR block for injection into categorization prompts. Small +
 *  pure so it stays cache-friendly and testable. */
export function renderProfileForPrompt(profile: BusinessProfile): string {
  const lines = [
    `Business profile (a PRIOR — the expense's own details still decide):`,
    `- Industry: ${profile.industry || 'unknown'}`,
  ];
  if (profile.common_categories.length) {
    lines.push(`- Common categories for this work: ${profile.common_categories.join(', ')}`);
  }
  const hints = Object.entries(profile.synonyms);
  if (hints.length) {
    lines.push(`- Term/vendor hints: ${hints.map(([t, c]) => `"${t}" → ${c}`).join('; ')}`);
  }
  if (profile.notes_for_categorizer) {
    lines.push(`- Notes: ${profile.notes_for_categorizer}`);
  }
  return lines.join('\n');
}

/** Lazily ensure the user has a business_profile, generating + persisting it once. Best-effort:
 *  on any failure the original user is returned unchanged (retried on the next message). Called at
 *  the top of the expense flow so the user's FIRST logged expense is already profession-aware. */
export async function ensureBusinessProfile(user: AppUser): Promise<AppUser> {
  if (user.business_profile || !user.business_type) return user;
  const profile = await generateBusinessProfile(user.business_type, user.entity_type);
  if (!profile) return user;
  try {
    await updateUser(user.id, { business_profile: profile });
  } catch (err) {
    log.warn('business_profile_persist_failed', {
      user: user.id,
      message: err instanceof Error ? err.message : 'unknown',
    });
    return user;
  }
  log.info('business_profile_created', { user: user.id, industry: profile.industry });
  return { ...user, business_profile: profile };
}

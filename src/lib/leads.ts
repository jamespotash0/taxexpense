// Web onboarding leads (EPIC-9 funnel). Every /start completion lands here — including
// visitors who SKIP the phone step — so we can measure funnel drop-off + web→SMS conversion,
// see the real distribution of work types and "tax pain" in users' own words, and feed both
// back into onboarding/categorization. Service-role only (not org-scoped; this is pre-user).
// PII note: `pain` is free text — it lives in the leads row but is NEVER written to logs.
import { getSupabaseAdmin } from './supabase';
import { log } from './log';

export interface LeadInput {
  phone_number?: string | null;
  full_name?: string | null;
  business_type?: string | null;
  pain?: string | null;
  locale?: string | null;
  source?: string;
}

/** Insert a funnel lead. Throws on DB error; callers treat it as best-effort (never block the funnel). */
export async function insertLead(lead: LeadInput): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('leads')
    .insert({
      phone_number: lead.phone_number ?? null,
      full_name: lead.full_name ?? null,
      business_type: lead.business_type ?? null,
      pain: lead.pain ?? null,
      locale: lead.locale ?? null,
      source: lead.source ?? 'web_onboarding',
    });
  if (error) {
    log.warn('lead_insert_failed', { message: error.message });
    throw error;
  }
}

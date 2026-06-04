// Lead / pain-research capture. The "worst part of tax time?" question — the old web funnel's
// one unique signal (DEC-049) — now lives at the END of SMS onboarding (DEC-057) and lands here,
// so we keep a queryable corpus of user pain in their own words for content + categorization work.
// Service-role only (not org-scoped; this is a research log keyed by phone).
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

/** Insert a lead/research row. Callers treat it as best-effort (never block onboarding on it). */
export async function insertLead(lead: LeadInput): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('leads')
    .insert({
      phone_number: lead.phone_number ?? null,
      full_name: lead.full_name ?? null,
      business_type: lead.business_type ?? null,
      pain: lead.pain ?? null,
      locale: lead.locale ?? null,
      source: lead.source ?? 'sms_onboarding',
    });
  if (error) {
    log.warn('lead_insert_failed', { message: error.message });
    throw error;
  }
}

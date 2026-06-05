// IRC summary lookup (reference data; global, not org-scoped).
// Loaded into Prompt 2 so the SMS can cite the right section in plain language.
import { getSupabaseAdmin } from './supabase';

export interface IrcSummary {
  section_id: string;
  title: string;
  short_summary: string;
  deduction_percentage: number | null;
  common_practice: string | null;
  worth_noting: string | null;
  source_url: string | null;
}

const IRC_COLUMNS = 'section_id, title, short_summary, deduction_percentage, common_practice, worth_noting, source_url';

export async function getIrcSummary(sectionId: string | null): Promise<IrcSummary | null> {
  if (!sectionId) return null;
  const { data, error } = await getSupabaseAdmin()
    .from('irc_summaries')
    .select(IRC_COLUMNS)
    .eq('section_id', sectionId)
    .maybeSingle();
  if (error) throw error;
  return (data as IrcSummary | null) ?? null;
}

/**
 * Look up an IRC summary tolerant of how the section is written. Receipts store sections
 * like "§274(n)" / "§274(b)" / "§162", but section_id keys are bare ("274", "274b", "162",
 * "280F"). Tries the alphanumeric form first (so §274(b) → "274b", the more specific match),
 * then the digits-only form (so §274(n) → "274"). For the month-end review agent's lookup tool.
 */
export async function lookupIrcSectionFlexible(query: string): Promise<IrcSummary | null> {
  const cleaned = query.replace(/§/g, '').trim();
  const alnum = cleaned.replace(/[^0-9A-Za-z]/g, ''); // "274(b)" → "274b", "280F" → "280F"
  const digits = cleaned.match(/\d+/)?.[0] ?? '';     // "274(n)" → "274"
  const candidates = [...new Set([alnum, digits])].filter(Boolean);
  for (const c of candidates) {
    const hit = await getIrcSummary(c);
    if (hit) return hit;
  }
  return null;
}

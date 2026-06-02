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
}

export async function getIrcSummary(sectionId: string | null): Promise<IrcSummary | null> {
  if (!sectionId) return null;
  const { data, error } = await getSupabaseAdmin()
    .from('irc_summaries')
    .select('section_id, title, short_summary, deduction_percentage, common_practice, worth_noting')
    .eq('section_id', sectionId)
    .maybeSingle();
  if (error) throw error;
  return (data as IrcSummary | null) ?? null;
}

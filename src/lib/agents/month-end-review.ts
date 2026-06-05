// Month-end review agent orchestrator (Phase 2 — AGENTS-VS-WORKFLOWS.md). OWNER: Raj.
//
// Assembles the agent's context, runs the bounded tool-use loop (lib/agent.ts) over
// the month-end toolset (lib/agent-tools.ts), and persists the run + draft to
// agent_runs for observability and human approval. It produces a DRAFT only — the
// user reviews and sends via the existing /api/email-accountant path. Nothing here
// takes an outward action.

import { runAgent, type AgentStep } from '../agent';
import { buildMonthEndTools, FINISH_REVIEW_TOOL } from '../agent-tools';
import { MONTH_END_REVIEW_AGENT_PROMPT } from '../prompts';
import { SONNET_MODEL } from '../claude';
import { userContextLine } from '../categorize';
import { getSupabaseAdmin } from '../supabase';
import { log } from '../log';
import type { AppUser } from '../users';

const MAX_STEPS = 8;

export interface FlaggedItem {
  id: string;
  reason: string;
}

export interface MonthEndDraft {
  runId: string;
  month: string;
  status: 'completed' | 'max_steps' | 'incomplete';
  summary: string;
  subject: string;
  body: string;
  flagged: FlaggedItem[];
  steps: number;
  usage: { input_tokens: number; output_tokens: number };
  /** The tool-call sequence the agent chose — surfaced in the UI as "how it reviewed". */
  trace: AgentStep[];
}

function toFlagged(value: unknown): FlaggedItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null)
    .map((v) => ({ id: String(v.id ?? ''), reason: String(v.reason ?? '') }))
    .filter((v) => v.id);
}

/**
 * Run the month-end review agent for one user + month ('YYYY-MM') and persist the result.
 * Returns the draft accountant email for the user to review, edit, and send.
 */
export async function runMonthEndReview(user: AppUser, month: string): Promise<MonthEndDraft> {
  const userText =
    `Review month: ${month}\n\n` +
    `## About the user\n${userContextLine(user)}\n\n` +
    `Review this month's logged expenses and prepare the draft accountant email.`;

  const result = await runAgent({
    model: SONNET_MODEL,
    system: MONTH_END_REVIEW_AGENT_PROMPT,
    userText,
    tools: buildMonthEndTools(user.organization_id, month),
    stopTool: FINISH_REVIEW_TOOL,
    maxSteps: MAX_STEPS,
    maxTokens: 2000,
  });

  const out = result.stopToolInput ?? {};
  const status: MonthEndDraft['status'] =
    result.stopReason === 'stop_tool' ? 'completed' : result.stopReason === 'max_steps' ? 'max_steps' : 'incomplete';
  const summary = String(out.summary ?? '');
  const subject = String(out.subject ?? `Tally — expense review for ${month}`);
  const body = String(out.body ?? '');
  const flagged = toFlagged(out.flagged_expense_ids);

  const { data, error } = await getSupabaseAdmin()
    .from('agent_runs')
    .insert({
      organization_id: user.organization_id,
      agent_type: 'month_end_review',
      period: month,
      status,
      steps: result.steps,
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
      trace: result.trace,
      summary,
      draft_subject: subject,
      draft_body: body,
      flagged,
      error: status === 'completed' ? null : `stop_reason:${result.stopReason}`,
    })
    .select('id')
    .single();
  if (error) throw error;

  log.info('month_end_review_done', {
    org: user.organization_id,
    month,
    status,
    steps: result.steps,
    flagged: flagged.length,
    ...result.usage,
  });

  return {
    runId: (data as { id: string }).id,
    month,
    status,
    summary,
    subject,
    body,
    flagged,
    steps: result.steps,
    usage: result.usage,
    trace: result.trace,
  };
}

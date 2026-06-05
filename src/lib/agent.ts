// Generic tool-use loop — Tally's first real AGENT (not a workflow). See
// claude_files/docs/AGENTS-VS-WORKFLOWS.md "Phase 2: Workflow + Limited Agent".
// OWNER: Raj.
//
// Everything else in the codebase is a workflow: OUR code decides each step and
// calls Claude as a subroutine (lib/llm.ts). This file inverts that — we hand
// Claude a goal + tools and let IT drive: call a tool, read the result, decide the
// next call, repeat, until it invokes the terminating `stopTool` or hits maxSteps.
//
// Raj's guardrails are baked in, because an agent's whole risk is unbounded
// behaviour (see the doc — predictability/cost/liability):
//   - hard step cap (no "loop until done")
//   - tool allowlist (it can only touch what we hand it)
//   - a single terminating tool whose input IS the structured final answer
//   - full per-step trace + token usage returned, so every run is auditable
// We never let the agent take an outward action (send email/SMS); tools are
// read-only + a terminator that returns a DRAFT for a human to approve.

import { getClaude } from './claude';
import { log } from './log';

const DEFAULT_MAX_STEPS = 8;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_TOKENS = 1500;

/** A content block we can hand back to Claude as a tool result (text or an image for vision). */
export type ToolResultBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

export interface AgentTool {
  name: string;
  description: string;
  /** JSON Schema for the tool input (Anthropic `input_schema`). */
  input_schema: Record<string, unknown>;
  /** Execute the tool. Throw to surface an error block to the model; it may recover. */
  handler: (input: Record<string, unknown>) => Promise<ToolResultBlock[]>;
}

/** One executed tool call, kept for the audit trace. */
export interface AgentStep {
  tool: string;
  input: unknown;
  ok: boolean;
}

export type AgentStopReason = 'stop_tool' | 'end_turn' | 'max_steps';

export interface AgentResult {
  /** The input the agent passed to `stopTool` — its structured final answer. null if it never called it. */
  stopToolInput: Record<string, unknown> | null;
  /** Any free-text the model emitted on its final turn (fallback when no stopTool). */
  finalText: string;
  stopReason: AgentStopReason;
  steps: number;
  trace: AgentStep[];
  usage: { input_tokens: number; output_tokens: number };
}

export interface RunAgentOpts {
  model: string;
  system: string;
  /** The opening user turn — the goal + context the agent works from. */
  userText: string;
  tools: AgentTool[];
  /** Name of the tool that ends the run; its input is captured as the final answer. */
  stopTool?: string;
  maxSteps?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

interface AnthropicBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

function extractText(content: AnthropicBlock[]): string {
  return content.map((b) => (b.type === 'text' && b.text ? b.text : '')).join('').trim();
}

/**
 * Run an agentic tool-use loop and return its structured result + full trace.
 *
 * The loop is deliberately bounded: it makes at most `maxSteps` model calls. On each
 * turn we execute every tool the model requested, feed the results back, and continue.
 * The run ends when the model calls `stopTool` (preferred), stops asking for tools
 * (end_turn), or we hit the step cap.
 */
export async function runAgent(opts: RunAgentOpts): Promise<AgentResult> {
  const maxSteps = opts.maxSteps ?? DEFAULT_MAX_STEPS;
  const byName = new Map(opts.tools.map((t) => [t.name, t]));
  const apiTools = opts.tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
  // Cache the system prompt (Anthropic prompt caching) — it's re-sent on every loop turn.
  const system = [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }];

  const messages: Array<{ role: 'user' | 'assistant'; content: unknown }> = [
    { role: 'user', content: [{ type: 'text', text: opts.userText }] },
  ];

  const trace: AgentStep[] = [];
  const usage = { input_tokens: 0, output_tokens: 0 };
  let stopToolInput: Record<string, unknown> | null = null;
  let finalText = '';

  for (let step = 1; step <= maxSteps; step++) {
    const res = await getClaude().messages.create(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { model: opts.model, max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS, system, tools: apiTools, messages } as any,
      { timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS },
    );
    usage.input_tokens += res.usage?.input_tokens ?? 0;
    usage.output_tokens += res.usage?.output_tokens ?? 0;

    const content = res.content as AnthropicBlock[];
    messages.push({ role: 'assistant', content });
    finalText = extractText(content);

    const toolUses = content.filter((b) => b.type === 'tool_use');
    if (res.stop_reason !== 'tool_use' || toolUses.length === 0) {
      return { stopToolInput, finalText, stopReason: 'end_turn', steps: step, trace, usage };
    }

    // Execute every requested tool and collect the results for the next turn.
    const results: Array<Record<string, unknown>> = [];
    for (const block of toolUses) {
      const tool = byName.get(block.name ?? '');
      let resultContent: ToolResultBlock[];
      let isError = false;
      if (!tool) {
        resultContent = [{ type: 'text', text: `Unknown tool: ${block.name}` }];
        isError = true;
      } else {
        try {
          resultContent = await tool.handler(block.input ?? {});
        } catch (err) {
          resultContent = [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : 'tool_failed'}` }];
          isError = true;
        }
      }
      trace.push({ tool: block.name ?? 'unknown', input: block.input, ok: !isError });
      results.push({ type: 'tool_result', tool_use_id: block.id, content: resultContent, is_error: isError });
      if (block.name === opts.stopTool && !isError) {
        stopToolInput = (block.input ?? {}) as Record<string, unknown>;
      }
    }
    messages.push({ role: 'user', content: results });

    // The terminating tool was called — record its result for a well-formed transcript, then stop.
    if (stopToolInput !== null) {
      log.info('agent_finished', { tool: opts.stopTool, steps: step, ...usage });
      return { stopToolInput, finalText, stopReason: 'stop_tool', steps: step, trace, usage };
    }
  }

  log.warn('agent_max_steps', { maxSteps, ...usage });
  return { stopToolInput, finalText, stopReason: 'max_steps', steps: maxSteps, trace, usage };
}

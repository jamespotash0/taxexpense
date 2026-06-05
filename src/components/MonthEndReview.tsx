'use client';

// Phase C surface for the month-end review AGENT (AGENTS-VS-WORKFLOWS.md Phase 2).
// Runs POST /api/agents/month-end-review (the agent), shows the draft it produced, lets the
// user edit it, and sends it to their accountant via .../send — the human-in-the-loop step.
// Also exposes the agent's tool-call trace ("how it reviewed") — the visible proof of autonomy.
//
// Copy is kept in one COPY object below rather than the i18n dictionaries: this is a beta
// feature and the agent's own output is English-only for now. Lift into src/i18n when it ships.
import { useState } from 'react';
import { useFormSubmit } from '@/lib/use-form-submit';

interface FlaggedItem { id: string; reason: string }
interface TraceStep { tool: string; input: unknown; ok: boolean }
interface Draft {
  month: string;
  status: 'completed' | 'max_steps' | 'incomplete';
  summary: string;
  subject: string;
  body: string;
  flagged: FlaggedItem[];
  steps: number;
  usage: { input_tokens: number; output_tokens: number };
  trace: TraceStep[];
}

const COPY = {
  title: 'Month-end review',
  blurb: 'Tally’s review agent reads this month’s expenses, checks the IRS rules, and drafts a note to your accountant. You approve before anything sends.',
  run: 'Review my month',
  running: 'Reviewing your month… (~30s)',
  rerun: 'Re-run review',
  addEmailFirst: 'Add an accountant email in Settings first',
  flaggedTitle: 'Items the agent flagged',
  noFlags: 'Nothing needed flagging — the month looks documented.',
  subjectLabel: 'Subject',
  bodyLabel: 'Draft to your accountant (editable)',
  send: 'Send to accountant',
  sending: 'Sending…',
  sentTo: 'Sent to',
  traceTitle: 'How the agent reviewed',
  draftOnly: 'This is a draft. Nothing is sent until you click “Send”.',
};

function describeStep(s: TraceStep): string {
  const arg = s.input && typeof s.input === 'object' ? Object.values(s.input as Record<string, unknown>)[0] : undefined;
  return arg != null ? `${s.tool}(${String(arg)})` : s.tool;
}

export function MonthEndReview({ hasAccountantEmail }: { hasAccountantEmail: boolean }) {
  const run = useFormSubmit();
  const send = useFormSubmit();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function review() {
    setSentTo(null);
    const { ok, data } = await run.submit<{ draft: Draft }>('/api/agents/month-end-review', {
      errorMessage: 'The review could not run. Try again.',
    });
    if (ok && data?.draft) {
      setDraft(data.draft);
      setSubject(data.draft.subject);
      setBodyText(data.draft.body);
    }
  }

  async function sendDraft() {
    setSentTo(null);
    const { ok, data } = await send.submit<{ sent_to: string }>('/api/agents/month-end-review/send', {
      body: { subject, body: bodyText },
      errorMessage: 'Could not send the draft.',
    });
    if (ok) setSentTo(data?.sent_to ?? '');
  }

  return (
    <section className="mt-6 rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{COPY.title}</h2>
          <p className="mt-1 max-w-prose text-sm text-muted">{COPY.blurb}</p>
        </div>
        <button
          onClick={review}
          disabled={run.busy}
          className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {run.busy ? COPY.running : draft ? COPY.rerun : COPY.run}
        </button>
      </div>

      {run.error && <p className="mt-3 text-sm text-error-600">{run.error}</p>}

      {draft && (
        <div className="mt-5 space-y-5 border-t border-border pt-5">
          {/* Summary + run stats */}
          <div>
            <p className="text-sm">{draft.summary}</p>
            <p className="mt-1 text-xs text-muted">
              {draft.month} · {draft.steps} steps · {draft.trace.length} tool calls ·{' '}
              {(draft.usage.input_tokens + draft.usage.output_tokens).toLocaleString()} tokens
            </p>
          </div>

          {/* Flagged items */}
          <div>
            <p className="text-sm font-medium">{COPY.flaggedTitle}</p>
            {draft.flagged.length === 0 ? (
              <p className="mt-1 text-sm text-muted">{COPY.noFlags}</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {draft.flagged.map((f) => (
                  <li key={f.id} className="rounded-md border border-warning-600/30 bg-warning-50 p-2 text-sm">
                    <a href={`/receipts/${f.id}`} className="font-medium text-warning-700 underline">
                      View expense
                    </a>
                    <span className="text-muted"> — {f.reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Editable draft */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              {COPY.subjectLabel}
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm font-medium">
              {COPY.bodyLabel}
              <textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                rows={12}
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs leading-relaxed"
              />
            </label>
            <p className="text-xs text-muted">{COPY.draftOnly}</p>
          </div>

          {/* Send */}
          <div className="flex items-center gap-3">
            <button
              onClick={sendDraft}
              disabled={send.busy || !hasAccountantEmail}
              title={hasAccountantEmail ? '' : COPY.addEmailFirst}
              className="rounded-md border border-border bg-surface px-4 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50"
            >
              {send.busy ? COPY.sending : COPY.send}
            </button>
            {send.error && <p className="text-sm text-error-600">{send.error}</p>}
            {sentTo !== null && !send.error && (
              <p className="text-sm text-muted">{COPY.sentTo} {sentTo}</p>
            )}
          </div>

          {/* Reasoning trace — the visible proof of autonomy */}
          <details className="text-sm">
            <summary className="cursor-pointer text-muted hover:text-foreground">{COPY.traceTitle}</summary>
            <ol className="mt-2 space-y-1 border-l border-border pl-4 text-xs text-muted">
              {draft.trace.map((s, i) => (
                <li key={i} className="font-mono">
                  {i + 1}. {describeStep(s)} {s.ok ? '' : '⚠️'}
                </li>
              ))}
            </ol>
          </details>
        </div>
      )}
    </section>
  );
}

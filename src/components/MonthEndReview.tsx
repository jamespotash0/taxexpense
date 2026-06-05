'use client';

// Phase C surface for the month-end review AGENT (AGENTS-VS-WORKFLOWS.md Phase 2).
// Runs POST /api/agents/month-end-review (the agent), shows the draft it produced, lets the
// user edit it, and sends it to their accountant via .../send — the human-in-the-loop step.
// Also lists past runs (GET) so the user can revisit earlier reviews.
//
// Copy is kept in one COPY object below rather than the i18n dictionaries: this is a beta
// feature and the agent's own output is English-only for now. Lift into src/i18n when it ships.
import { useCallback, useEffect, useState } from 'react';
import { useFormSubmit } from '@/lib/use-form-submit';

interface FlaggedItem { id: string; reason: string }
interface Draft {
  month: string;
  status: 'completed' | 'max_steps' | 'incomplete';
  summary: string;
  subject: string;
  body: string;
  flagged: FlaggedItem[];
}
interface PastRun extends Draft {
  runId: string;
  createdAt: string;
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
  draftOnly: 'This is a draft. Nothing is sent until you click “Send”.',
  historyTitle: 'Past reviews',
  noHistory: 'No past reviews yet — run one above.',
  viewing: 'Viewing',
};

const STATUS_LABEL: Record<Draft['status'], string> = {
  completed: 'completed',
  max_steps: 'stopped early',
  incomplete: 'incomplete',
};

// 'YYYY-MM' → 'March 2026'. Falls back to the raw value if it isn't a recognizable month.
function monthLabel(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return month;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function runDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function MonthEndReview({ hasAccountantEmail }: { hasAccountantEmail: boolean }) {
  const run = useFormSubmit();
  const send = useFormSubmit();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [history, setHistory] = useState<PastRun[]>([]);
  const [viewingRunId, setViewingRunId] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/agents/month-end-review');
      const data = await res.json();
      if (data?.ok && Array.isArray(data.runs)) setHistory(data.runs as PastRun[]);
    } catch {
      // History is supplementary — a failed fetch shouldn't break the run surface.
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  // Load a draft (a fresh run or a past run) into the editable view.
  function showDraft(d: Draft, runId: string | null) {
    setDraft(d);
    setSubject(d.subject);
    setBodyText(d.body);
    setViewingRunId(runId);
    setSentTo(null);
  }

  async function review() {
    setSentTo(null);
    const { ok, data } = await run.submit<{ draft: Draft }>('/api/agents/month-end-review', {
      body: {}, // current month; a month selector would pass { month } here
      errorMessage: 'The review could not run. Try again.',
    });
    if (ok && data?.draft) {
      showDraft(data.draft, null);
      void loadHistory(); // the new run is now part of history
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
          className="w-[15rem] shrink-0 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-center text-sm text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {run.busy ? COPY.running : draft ? COPY.rerun : COPY.run}
        </button>
      </div>

      {run.error && <p className="mt-3 text-sm text-error-600">{run.error}</p>}

      {draft && (
        <div className="mt-5 space-y-5 border-t border-border pt-5">
          {/* Summary */}
          <div>
            {viewingRunId && (
              <p className="mb-1 text-xs font-medium text-muted">{COPY.viewing} {monthLabel(draft.month)}</p>
            )}
            <p className="text-sm">{draft.summary}</p>
            <p className="mt-1 text-xs text-muted">{monthLabel(draft.month)}</p>
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
        </div>
      )}

      {/* Past runs — click one to reopen its draft */}
      <div className="mt-5 border-t border-border pt-5">
        <p className="text-sm font-medium">{COPY.historyTitle}</p>
        {history.length === 0 ? (
          <p className="mt-1 text-sm text-muted">{COPY.noHistory}</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {history.map((r) => {
              const active = r.runId === viewingRunId;
              return (
                <li key={r.runId}>
                  <button
                    onClick={() => showDraft(r, r.runId)}
                    className={`flex w-full items-center justify-between gap-3 py-2 text-left text-sm hover:text-foreground ${
                      active ? 'text-foreground' : 'text-muted'
                    }`}
                  >
                    <span className="font-medium">{monthLabel(r.month)}</span>
                    <span className="shrink-0 text-xs text-muted">
                      {r.flagged.length} flagged · {STATUS_LABEL[r.status]} · {runDate(r.createdAt)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

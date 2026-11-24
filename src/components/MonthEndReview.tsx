'use client';

// Phase C surface for the month-end review AGENT (AGENTS-VS-WORKFLOWS.md Phase 2).
// Runs POST /api/agents/month-end-review (the agent), shows the draft it produced, lets the
// user edit it, and sends it to their accountant via .../send — the human-in-the-loop step.
// Also lists past runs (GET); clicking one opens it in a dismissible modal (a separate view),
// so browsing history never disturbs the current draft.
//
// Copy is kept in one COPY object below rather than the i18n dictionaries: this is a beta
// feature and the agent's own output is English-only for now. Lift into src/i18n when it ships.
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/AppIcons';
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
export interface PastRun extends Draft {
  runId: string;
  createdAt: string;
}

const COPY = {
  title: 'Month-end review',
  blurb: 'Tally’s review agent reads this month’s expenses, checks the IRS rules, and drafts a note to your accountant. Last month’s review is drafted for you on the 2nd. You approve before anything sends.',
  run: 'Review my month',
  running: 'Reviewing your month… (~30s)',
  rerun: 'Re-run review',
  addEmailFirst: 'Add an accountant email in Settings first',
  flaggedTitle: 'Items the agent flagged',
  noFlags: 'Nothing needed flagging. The month looks documented.',
  subjectLabel: 'Subject',
  bodyLabel: 'Draft to your accountant (editable)',
  send: 'Send to accountant',
  sending: 'Sending…',
  sentTo: 'Sent to',
  draftOnly: 'This is a draft. Nothing is sent until you click “Send”.',
  historyTitle: 'Past reviews',
  noHistory: 'No past reviews yet.',
  close: 'Close',
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

/** The summary + flagged list + editable draft + send control. Shared by the inline current-month
 *  view and the past-run modal so both stay identical. */
function DraftEditor({
  draft,
  subject,
  onSubject,
  body,
  onBody,
  onSend,
  sending,
  sendError,
  sentTo,
  hasAccountantEmail,
}: {
  draft: Draft;
  subject: string;
  onSubject: (v: string) => void;
  body: string;
  onBody: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  sendError: string | null;
  sentTo: string | null;
  hasAccountantEmail: boolean;
}) {
  return (
    <div className="space-y-5">
      {/* Summary */}
      <div>
        <p className="text-[0.9375rem] leading-relaxed">{draft.summary}</p>
        <p className="mt-1 text-xs text-muted">{monthLabel(draft.month)}</p>
      </div>

      {/* Flagged items */}
      <div>
        <p className="text-sm font-semibold">{COPY.flaggedTitle}</p>
        {draft.flagged.length === 0 ? (
          <p className="mt-1 text-sm text-muted">{COPY.noFlags}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {draft.flagged.map((f) => (
              <li key={f.id} className="rounded-2xl bg-warning-50 px-4 py-3 text-sm">
                <a href={`/receipts/${f.id}`} className="font-semibold text-warning-700 underline">
                  View expense
                </a>
                <span className="text-warning-700/85"> · {f.reason}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Editable draft */}
      <div className="space-y-3">
        <label className="label">
          {COPY.subjectLabel}
          <input
            value={subject}
            onChange={(e) => onSubject(e.target.value)}
            className="field mt-1.5 font-normal"
          />
        </label>
        <label className="label">
          {COPY.bodyLabel}
          <textarea
            value={body}
            onChange={(e) => onBody(e.target.value)}
            rows={12}
            className="field mt-1.5 text-sm font-normal leading-relaxed"
          />
        </label>
        <p className="text-xs text-muted">{COPY.draftOnly}</p>
      </div>

      {/* Send */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onSend}
          disabled={sending || !hasAccountantEmail}
          title={hasAccountantEmail ? '' : COPY.addEmailFirst}
          className="btn btn-primary btn-sm"
        >
          {sending ? COPY.sending : COPY.send}
        </button>
        {sendError && <p className="text-sm text-error-600">{sendError}</p>}
        {sentTo !== null && !sendError && (
          <p className="text-sm text-muted">{COPY.sentTo} {sentTo}</p>
        )}
      </div>
    </div>
  );
}

// `linkedRun`: the draft opened by the auto-draft text's link (/dashboard?review=<runId>), shown for approval.
export function MonthEndReview({ hasAccountantEmail, linkedRun }: { hasAccountantEmail: boolean; linkedRun?: PastRun }) {
  const run = useFormSubmit();
  const send = useFormSubmit();
  const sendModal = useFormSubmit();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [history, setHistory] = useState<PastRun[]>([]);
  const [open, setOpen] = useState(false);

  // Past-run modal ("a new view"): its own editable copy + send state, so opening one never
  // touches the current-month draft above.
  const [viewing, setViewing] = useState<PastRun | null>(linkedRun ?? null);
  const [viewSubject, setViewSubject] = useState(linkedRun?.subject ?? '');
  const [viewBody, setViewBody] = useState(linkedRun?.body ?? '');
  const [viewSentTo, setViewSentTo] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/agents/month-end-review');
      const data = await res.json();
      if (data?.ok && Array.isArray(data.runs)) setHistory(data.runs as PastRun[]);
    } catch {
      // History is supplementary — a failed fetch shouldn't break the run surface.
    }
  }, []);


  // Escape closes the top-most layer: the past-run view first, then the sheet.
  useEffect(() => {
    if (!open && !viewing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (viewing) setViewing(null);
      else setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, viewing]);

  function openSheet() {
    setOpen(true);
    void loadHistory();
  }

  function openRun(r: PastRun) {
    setViewing(r);
    setViewSubject(r.subject);
    setViewBody(r.body);
    setViewSentTo(null);
  }

  async function review() {
    setSentTo(null);
    const { ok, data } = await run.submit<{ draft: Draft }>('/api/agents/month-end-review', {
      body: {}, // current month; a month selector would pass { month } here
      errorMessage: 'The review could not run. Try again.',
    });
    if (ok && data?.draft) {
      setDraft(data.draft);
      setSubject(data.draft.subject);
      setBodyText(data.draft.body);
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

  async function sendViewing() {
    setViewSentTo(null);
    const { ok, data } = await sendModal.submit<{ sent_to: string }>('/api/agents/month-end-review/send', {
      body: { subject: viewSubject, body: viewBody },
      errorMessage: 'Could not send the draft.',
    });
    if (ok) setViewSentTo(data?.sent_to ?? '');
  }

  const closeBtn = (onClick: () => void) => (
    <button
      onClick={onClick}
      aria-label={COPY.close}
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-fill text-muted hover:text-foreground"
    >
      <Icon name="close" size={18} />
    </button>
  );

  return (
    <>
      <button onClick={openSheet} className="btn btn-secondary btn-sm">
        <Icon name="sparkle" size={16} />
        {COPY.title}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-[#0b0b12]/45 sm:items-start sm:p-8"
          onClick={() => setOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={COPY.title}
            className="rise-in mt-16 w-full max-w-2xl rounded-t-[28px] bg-white p-5 shadow-[0_24px_64px_-16px_rgba(11,11,18,0.35)] sm:my-8 sm:rounded-[28px] sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-[-0.02em]">{COPY.title}</h2>
          <p className="mt-1 max-w-prose text-sm text-muted">{COPY.blurb}</p>
        </div>
        {closeBtn(() => setOpen(false))}
      </div>
      <button onClick={review} disabled={run.busy} className="btn btn-primary mt-4 w-full sm:w-auto">
        {run.busy ? COPY.running : draft ? COPY.rerun : COPY.run}
      </button>

      {run.error && <p className="mt-3 text-sm text-error-600">{run.error}</p>}

      {draft && (
        <div className="mt-5 rounded-3xl bg-fill p-5">
          <DraftEditor
            draft={draft}
            subject={subject}
            onSubject={setSubject}
            body={bodyText}
            onBody={setBodyText}
            onSend={sendDraft}
            sending={send.busy}
            sendError={send.error}
            sentTo={sentTo}
            hasAccountantEmail={hasAccountantEmail}
          />
        </div>
      )}

      {/* Past runs — click one to open it in the modal below */}
      <div className="mt-5 border-t border-border pt-4">
        <p className="text-sm font-semibold">{COPY.historyTitle}</p>
        {history.length === 0 ? (
          <p className="mt-1 text-sm text-muted">{COPY.noHistory}</p>
        ) : (
          <ul className="mt-1 divide-y divide-border">
            {history.map((r) => (
              <li key={r.runId}>
                <button
                  onClick={() => openRun(r)}
                  className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left text-sm text-foreground hover:text-primary"
                >
                  <span className="font-semibold">{monthLabel(r.month)}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {r.flagged.length} flagged · {STATUS_LABEL[r.status]} · {runDate(r.createdAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

          </section>
        </div>
      )}

      {/* Past-run view, layered over the sheet: backdrop, close button, or Escape dismisses */}
      {viewing && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center overflow-y-auto bg-[#0b0b12]/45 sm:items-start sm:p-8"
          onClick={() => setViewing(null)}
        >
          <div
            className="rise-in mt-16 w-full max-w-2xl rounded-t-[28px] bg-white p-5 shadow-[0_24px_64px_-16px_rgba(11,11,18,0.35)] sm:my-8 sm:rounded-[28px] sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 pb-2">
              <div>
                <h3 className="text-lg font-bold tracking-[-0.02em]">{monthLabel(viewing.month)} review</h3>
                <p className="mt-0.5 text-xs text-muted">
                  {STATUS_LABEL[viewing.status]} · {runDate(viewing.createdAt)}
                </p>
              </div>
              {closeBtn(() => setViewing(null))}
            </div>
            <div className="mt-4">
              <DraftEditor
                draft={viewing}
                subject={viewSubject}
                onSubject={setViewSubject}
                body={viewBody}
                onBody={setViewBody}
                onSend={sendViewing}
                sending={sendModal.busy}
                sendError={sendModal.error}
                sentTo={viewSentTo}
                hasAccountantEmail={hasAccountantEmail}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

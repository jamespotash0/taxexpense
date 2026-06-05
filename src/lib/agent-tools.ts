// Tool definitions for the month-end review agent (Phase 2 — AGENTS-VS-WORKFLOWS.md).
// OWNER: Raj. Every tool is org-scoped via the closure over `orgId`, READ-ONLY, and
// thin — it wraps an existing lib function so the agent can only do what the workflow
// already can. The one non-read tool, `finish_review`, takes no action: it just carries
// the agent's structured DRAFT back out for a human to approve (no auto-send — Jordan).

import type { AgentTool, ToolResultBlock } from './agent';
import { getReceiptsForMonth, getReceipt, type ReceiptRow } from './receipts';
import { getSignedReceiptUrl } from './ocr';
import { formatMoney } from './format';

/** Compact one receipt to the fields the agent triages on (keeps tokens + noise down). */
function summarize(r: ReceiptRow) {
  return {
    id: r.id,
    date: r.transaction_date,
    vendor: r.vendor,
    amount: formatMoney(r.amount_cents),
    category: r.category,
    irc_section: r.irc_section,
    has_photo: Boolean(r.photo_url),
    needs_receipt: r.needs_receipt,
    needs_review: r.needs_review,
    review_reason: r.review_reason,
    substantiation_complete: r.substantiation_complete,
    missing_fields: r.substantiation_missing_fields ?? [],
    flagged_for_cpa: r.flagged_for_cpa,
  };
}

/** Full detail for a single receipt — everything the §274(d) substantiation check looks at. */
function detail(r: ReceiptRow) {
  return {
    ...summarize(r),
    payment_account: r.payment_account,
    deduction_percentage: r.deduction_percentage,
    deductible_amount: formatMoney(r.deductible_amount_cents),
    business_purpose: r.business_purpose,
    attendees: r.attendees,
    business_relationship: r.business_relationship,
    location_city: r.location_city,
    business_miles: r.business_miles,
    receipt_reason: r.receipt_reason,
    notes: r.notes,
  };
}

const IMAGE_TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

/** Fetch a stored receipt photo as a base64 image block so the agent can visually inspect it. */
async function fetchPhotoBlock(path: string): Promise<ToolResultBlock[]> {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const mediaType = IMAGE_TYPES[ext];
  if (!mediaType) {
    // PDFs / unknown types aren't vision-inspectable here — tell the agent it exists.
    return [{ type: 'text', text: `A receipt document is on file (type: ${ext || 'unknown'}), but it can't be visually inspected.` }];
  }
  const url = await getSignedReceiptUrl(path); // re-signed at call time; valid for the run's lifetime
  const res = await fetch(url);
  if (!res.ok) return [{ type: 'text', text: `Could not load the receipt image (status ${res.status}).` }];
  const data = Buffer.from(await res.arrayBuffer()).toString('base64');
  return [
    { type: 'text', text: 'Receipt photo on file:' },
    { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
  ];
}

function asText(value: unknown): ToolResultBlock[] {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }];
}

/** The terminating tool's name — also referenced by the orchestrator as runAgent's `stopTool`. */
export const FINISH_REVIEW_TOOL = 'finish_review';

/**
 * Build the agent's toolset for one org + month. Returns read-only inspectors plus the
 * `finish_review` terminator. All queries are scoped to `orgId`.
 */
export function buildMonthEndTools(orgId: string, month: string): AgentTool[] {
  return [
    {
      name: 'list_month_expenses',
      description:
        `List every expense logged in the review month (${month}) with its category, IRC section, ` +
        `and substantiation flags (missing receipt, missing context, low-confidence categorization, ` +
        `already flagged for CPA). Call this first to see the full picture.`,
      input_schema: { type: 'object', properties: {}, additionalProperties: false },
      handler: async () => {
        const rows = await getReceiptsForMonth(orgId, month);
        return asText({ month, count: rows.length, expenses: rows.map(summarize) });
      },
    },
    {
      name: 'get_expense',
      description:
        'Get full detail for one expense by id — including business purpose, attendees, ' +
        'business relationship, location, mileage, and deductible amount. Use when an expense ' +
        'from the list looks incomplete or worth a closer look.',
      input_schema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'The expense id from list_month_expenses.' } },
        required: ['id'],
        additionalProperties: false,
      },
      handler: async (input) => {
        const r = await getReceipt(orgId, String(input.id));
        return r ? asText(detail(r)) : [{ type: 'text', text: 'No expense found with that id.' }];
      },
    },
    {
      name: 'view_receipt_photo',
      description:
        'Visually inspect the receipt photo attached to an expense (by id), if any. Use to verify ' +
        'an amount/vendor looks right, or to confirm documentation actually supports the deduction.',
      input_schema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'The expense id.' } },
        required: ['id'],
        additionalProperties: false,
      },
      handler: async (input) => {
        const r = await getReceipt(orgId, String(input.id));
        if (!r) return [{ type: 'text', text: 'No expense found with that id.' }];
        if (!r.photo_url) return [{ type: 'text', text: 'No receipt photo is on file for this expense.' }];
        return fetchPhotoBlock(r.photo_url);
      },
    },
    {
      name: FINISH_REVIEW_TOOL,
      description:
        'Submit your finished review. Call this exactly once, when done. It produces a DRAFT email ' +
        'for the user to read, edit, and send to their accountant — it does NOT send anything.',
      input_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'One or two sentences summarizing the month for the user.' },
          subject: { type: 'string', description: 'Subject line for the draft accountant email.' },
          body: {
            type: 'string',
            description:
              'Body of the draft accountant email: a clear, professional plain-text summary plus a ' +
              'short list of the specific expenses the CPA should look at and why. No tax advice.',
          },
          flagged_expense_ids: {
            type: 'array',
            description: 'The expenses worth the CPA’s attention.',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                reason: { type: 'string', description: 'Why this one needs attention (e.g. missing receipt over $75).' },
              },
              required: ['id', 'reason'],
              additionalProperties: false,
            },
          },
        },
        required: ['summary', 'subject', 'body', 'flagged_expense_ids'],
        additionalProperties: false,
      },
      // No-op terminator: the orchestrator reads this input from runAgent's result.
      handler: async () => [{ type: 'text', text: 'Review recorded as a draft for the user to approve.' }],
    },
  ];
}

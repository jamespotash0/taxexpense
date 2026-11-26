// Intent eval cases (data only). Shared by intent.ts and the turn-interpreter replay eval (turns.ts).
import type { Intent } from '../../src/lib/router';

/** Conversation state a case runs with (receipts still missing a photo; one was just asked for). */
export interface ReplyContext {
  flaggedCount: number;
  awaitingReceipt?: boolean;
}

export type Check = (i: Intent) => boolean;

export interface IntentCase {
  id: string;
  text: string;
  expect: string; // human-readable, for the report
  tags: Array<'easy' | 'edge' | 'ambiguous'>;
  check: Check;
  ctx?: ReplyContext; // conversation context the classifier reasons with (e.g. flagged-receipt count)
  note?: string;
}

const isKind = (k: Intent['kind']): Check => (i) => i.kind === k;
const isResolution = (r: 'none' | 'later'): Check => (i) => i.kind === 'receipt_resolution' && i.resolution === r;
const isQuery = (tool?: string, period?: string): Check => (i) =>
  i.kind === 'query' && (tool == null || i.tool === tool) && (period == null || i.period === period);

export const CASES: IntentCase[] = [
  // ---- capture vs context_statement (no amount; a detail about a logged expense) ----
  { id: 'ctx-client-meal', text: 'that lunch was with a client about the Q3 deal', expect: 'context_statement',
    tags: ['edge'], check: isKind('context_statement'), note: 'Adds who/why to a logged meal, no amount.' },
  { id: 'ctx-team', text: 'the dinner was for my own team', expect: 'context_statement',
    tags: ['edge'], check: isKind('context_statement') },
  { id: 'ctx-personal', text: 'that one was actually personal', expect: 'context_statement',
    tags: ['edge'], check: isKind('context_statement') },
  { id: 'ctx-vendor', text: 'Tabernacle is a restaurant', expect: 'context_statement',
    tags: ['edge'], check: isKind('context_statement'), note: 'Vendor clarification, no amount.' },
  // Real texts (2026-11-25): "Log as business expense" right after Netflix logged personal → was "help".
  { id: 'ctx-log-as-business', text: 'Log as business expense', expect: 'context_statement',
    tags: ['edge'], check: isKind('context_statement'), note: 'Imperative recategorize of the last expense.' },
  { id: 'ctx-bare-business', text: 'business', expect: 'context_statement',
    tags: ['edge'], check: isKind('context_statement'), note: 'One-word reply meaning "that was business".' },
  { id: 'ctx-its-for-work', text: 'its for work', expect: 'context_statement',
    tags: ['edge'], check: isKind('context_statement') },
  { id: 'ctx-make-it-software', text: 'make it software', expect: 'context_statement',
    tags: ['edge'], check: isKind('context_statement'), note: 'Imperative category change.' },

  // ---- capture (records a NEW expense; phrased without an obvious $ the fast-path catches) ----
  { id: 'cap-no-symbol', text: 'spent forty bucks on gas to the client site', expect: 'capture',
    tags: ['edge'], check: isKind('capture'), note: '"forty bucks" — no $-digit, fast-path may miss; must still capture.' },
  { id: 'cap-coffee-detail', text: 'bought printer paper at staples for the office', expect: 'capture',
    tags: ['edge'], check: isKind('capture'), note: 'New expense, no amount stated → still a capture.' },

  // ---- receipt_resolution: a reply about expenses still missing a receipt (needs context) ----
  // The whole point of the reasoning approach: the SAME words mean different things with vs without
  // receipt context, so these must be classified WITH the flagged-receipt count.
  { id: 'rr-skip-verbose', text: "Don't have a receipt for it so you can skip it", expect: 'receipt_resolution/none',
    tags: ['edge'], ctx: { flaggedCount: 3 }, check: isResolution('none'),
    note: 'The exact reply that previously fell through to the generic help line.' },
  { id: 'rr-lost', text: 'lost it', expect: 'receipt_resolution/none',
    tags: ['edge'], ctx: { flaggedCount: 1, awaitingReceipt: true }, check: isResolution('none') },
  { id: 'rr-bare-no', text: 'no', expect: 'receipt_resolution/none',
    tags: ['edge'], ctx: { flaggedCount: 1, awaitingReceipt: true }, check: isResolution('none'),
    note: 'A bare "no" right after being asked to send a receipt means "I don\'t have one".' },
  { id: 'rr-later', text: "I'll send it tonight", expect: 'receipt_resolution/later',
    tags: ['edge'], ctx: { flaggedCount: 2 }, check: isResolution('later') },
  // Context-gating: the same "no receipt" words with NO flagged receipts must NOT waive anything.
  { id: 'rr-no-context', text: "don't have a receipt for it", expect: 'NOT receipt_resolution',
    tags: ['edge'], check: (i) => i.kind !== 'receipt_resolution',
    note: 'No receipt context → must not classify as receipt_resolution (nothing to waive).' },

  // ---- query: tool + period/category extraction ----
  { id: 'q-meals-year', text: 'how much have I spent on meals this year?', expect: 'query/aggregate/this_year',
    tags: ['easy'], check: isQuery('aggregate', 'this_year') },
  { id: 'q-recent', text: 'what are my last 3 charges?', expect: 'query/recent',
    tags: ['easy'], check: isQuery('recent') },
  { id: 'q-breakdown', text: 'show me my spending by category', expect: 'query/breakdown',
    tags: ['easy'], check: isQuery('breakdown') },
  { id: 'q-review', text: 'review my year', expect: 'query/review_year',
    tags: ['easy'], check: isQuery('review_year') },
  { id: 'q-total-software', text: 'total software spend last month', expect: 'query/aggregate/last_month',
    tags: ['edge'], check: isQuery('aggregate', 'last_month') },

  // ---- advice (must deflect to CPA, not answer) ----
  { id: 'adv-owe', text: 'how much will I owe in taxes this year?', expect: 'advice',
    tags: ['edge'], check: isKind('advice') },
  { id: 'adv-deductible', text: 'is my home office deductible?', expect: 'advice',
    tags: ['edge'], check: isKind('advice'), note: 'Deductibility question = advice, NOT a query about logged data.' },
  { id: 'adv-should', text: 'should I buy the camera before year end for the writeoff?', expect: 'advice',
    tags: ['ambiguous'], check: isKind('advice') },

  // ---- command ----
  { id: 'cmd-export', text: 'export my data', expect: 'command/export',
    tags: ['easy'], check: (i) => i.kind === 'command' && i.command === 'export' },
  { id: 'cmd-email', text: 'email my accountant', expect: 'command/email_accountant',
    tags: ['easy'], check: (i) => i.kind === 'command' && i.command === 'email_accountant' },

  // ---- help / greeting ----
  { id: 'help-hi', text: 'hey', expect: 'help', tags: ['easy'], check: isKind('help') },
  { id: 'help-what', text: 'what can you do?', expect: 'help', tags: ['easy'], check: isKind('help') },
  { id: 'help-thanks', text: 'thanks!', expect: 'help', tags: ['ambiguous'], check: isKind('help') },

  // ---- capability (how Tally works / "can it do X" — answered, not the generic help block) ----
  { id: 'cap-date-specific', text: 'can you log an expense and date it to a certain day?', expect: 'capability',
    tags: ['edge'], check: isKind('capability'), note: 'Product-feature question (dates), not their data or advice.' },
  { id: 'cap-only-today', text: 'when you log something does it only do it for that day?', expect: 'capability',
    tags: ['edge'], check: isKind('capability') },
  { id: 'cap-receipts', text: 'can you read receipt photos?', expect: 'capability',
    tags: ['edge'], check: isKind('capability') },
  { id: 'cap-quickbooks', text: 'can I export to QuickBooks?', expect: 'capability',
    tags: ['ambiguous'], check: isKind('capability'), note: 'How-it-works phrasing; "export my data" (imperative) is a command.' },

  // ---- other (off-topic; must NOT be captured as a phantom expense) ----
  { id: 'other-weather', text: "what's the weather tomorrow?", expect: 'other', tags: ['edge'], check: isKind('other') },
  { id: 'other-flight', text: 'book me a flight to Denver', expect: 'other',
    tags: ['edge'], check: isKind('other'), note: 'Action we can\'t do — not a travel EXPENSE.' },
  { id: 'other-poem', text: 'write me a poem about taxes', expect: 'other', tags: ['easy'], check: isKind('other') },
];

// ---------------------------------------------------------------------------
// Adversarial round — deliberately messy/realistic SMS the clean cases don't cover:
// mixed-intent, typos/shorthand, terse fragments, advice disguised as a
// query, and off-topic messages that USE expense vocabulary. Many are genuinely ambiguous
// (a human could justify >1 label) and are tagged so — they're observed, not scored. The
// point is to find where the classifier actually cracks, which is the real basis for few-shot.
// ---------------------------------------------------------------------------
const oneOfKind = (...ks: Intent['kind'][]): Check => (i) => ks.includes(i.kind);

export const ADVERSARIAL: IntentCase[] = [
  // ---- mixed-intent: logs AND asks in one message ----
  { id: 'mix-log-and-ask', text: 'logged $40 gas to the client, also how much on meals this year?',
    expect: 'capture|query (mixed)', tags: ['ambiguous'], check: oneOfKind('capture', 'query'),
    note: 'Two intents in one SMS; classifier must pick one — either is defensible.' },
  { id: 'mix-greeting-query', text: 'hey! how much did I spend on software?',
    expect: 'query (greeting prefix must not win)', tags: ['edge'], check: isQuery('aggregate') },

  // ---- typos / SMS shorthand ----
  { id: 'typo-meals-year', text: 'hw mch on meals ths yr', expect: 'query/aggregate', tags: ['edge'], check: isQuery('aggregate') },
  { id: 'typo-recent', text: 'wat wer my lst 3 chrgs', expect: 'query/recent', tags: ['edge'], check: isQuery('recent') },


  // ---- terse fragments ----
  { id: 'terse-meals', text: 'meals this year?', expect: 'query/aggregate', tags: ['ambiguous'], check: isQuery() },
  { id: 'terse-my-year', text: 'my year', expect: 'query/review_year', tags: ['ambiguous'], check: oneOfKind('query', 'help') },

  // ---- advice disguised as a query about their data ----
  { id: 'adv-writeoff-car', text: 'what can I write off for my car?', expect: 'advice', tags: ['edge'], check: isKind('advice') },
  { id: 'adv-categorize', text: 'should I categorize my home internet as office?', expect: 'advice', tags: ['ambiguous'], check: oneOfKind('advice') },
  { id: 'adv-1099', text: "what's a 1099?", expect: 'advice|help|other', tags: ['ambiguous'], check: oneOfKind('advice', 'help', 'other') },

  // ---- query vs capture: references an existing charge (no NEW expense) ----
  { id: 'q-already-logged', text: 'did I already log the $200 adobe charge?', expect: 'query (asks about logged data)', tags: ['edge'], check: isKind('query') },

  // ---- commands phrased indirectly ----
  { id: 'cmd-send-records', text: 'can you send my records to my accountant?', expect: 'command/email_accountant', tags: ['edge'], check: (i) => i.kind === 'command' && i.command === 'email_accountant' },
  { id: 'cmd-need-csv', text: 'i need a csv of everything', expect: 'command/export', tags: ['edge'], check: (i) => i.kind === 'command' && i.command === 'export' },

  // ---- off-topic that USES expense vocabulary (must NOT phantom-capture) ----
  { id: 'other-lend', text: 'can you lend me $20 for lunch?', expect: 'other (request, not an expense log)', tags: ['edge'], check: oneOfKind('other', 'help') },
  { id: 'other-best-app', text: "what's the best expense tracking app?", expect: 'other|help', tags: ['ambiguous'], check: oneOfKind('other', 'help', 'advice') },
];

// Receipt extraction via Claude Haiku 4.5 (vision).
// OWNER: Raj. EPIC-2 (claude_files/specs/02-sms-pipeline.md), Day 4.
//
// Stub during EPIC-1. Wraps: download Twilio media -> upload to Supabase Storage
// -> Haiku vision call -> parse structured JSON (vendor, total, date, items,
// confidence) -> graceful fallbacks for not_a_receipt / unreadable / low
// confidence (SPEC.md "OCR Implementation").

export interface ExtractedReceipt {
  vendor: string | null;
  total_amount: number | null;
  transaction_date: string | null;
  items: string[];
  payment_method: string | null;
  confidence: number;
}

// TODO(EPIC-2): implement extractReceipt(imageUrl) -> ExtractedReceipt | error.
export {};

// Substantiation decision tree — the heart of the product.
// OWNER: Priya + Raj. EPIC-3 (claude_files/specs/03-substantiation.md), Days 4-5.
//
// This file is intentionally a typed stub during EPIC-1 (Foundation). The full
// decision tree is specced in claude_files/docs/SPEC.md "The Substantiation
// Decision Tree" and driven entirely by the substantiation_rules table (never
// hardcode category logic elsewhere).
//
// Outline of what lands here in EPIC-3:
//   - load the rule for a category from substantiation_rules
//   - given (rule, amount_cents, hasPhoto, capturedFields) -> a SubstantiationResult
//     describing: needs_receipt, missing_context_fields, substantiation_complete

export interface SubstantiationRule {
  category: string;
  irc_section: string | null;
  substantiation_level: 'strict' | 'general';
  receipt_threshold_cents: number | null;
  always_receipt: boolean;
  required_context_fields: string[];
  deduction_percentage: number;
  deduction_cap_cents: number | null;
}

export interface SubstantiationResult {
  needs_receipt: boolean;
  receipt_reason: string | null;
  missing_context_fields: string[];
  substantiation_complete: boolean;
}

// TODO(EPIC-3): implement evaluateSubstantiation(rule, input) per the decision tree.
export {};

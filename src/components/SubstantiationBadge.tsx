// Substantiation status pill (TSNAP-039). Green complete / amber needs-something / gray pending.
// Wording uses "Documentation complete" not "audit-ready" (Jordan/Marcus liability).
// Labels are passed in localized (DEC-026).
import { Icon } from '@/components/AppIcons';

interface BadgeLabels {
  complete: string;
  needsReceipt: string;
  needsContext: string;
  pending: string;
}

interface Props {
  substantiationComplete: boolean;
  needsReceipt: boolean;
  missingFields?: string[] | null;
  labels: BadgeLabels;
}

export function SubstantiationBadge({ substantiationComplete, needsReceipt, missingFields, labels }: Props) {
  if (substantiationComplete) return <span className="chip chip-done h-8 px-3 text-[0.8125rem]"><Icon name="checkCircle" size={16} />{labels.complete}</span>;
  if (needsReceipt) return <span className="chip chip-need h-8 px-3 text-[0.8125rem]"><Icon name="receipt" size={16} />{labels.needsReceipt}</span>;
  if (missingFields && missingFields.length > 0) return <span className="chip chip-need h-8 px-3 text-[0.8125rem]"><Icon name="pen" size={16} />{labels.needsContext}</span>;
  return <span className="chip chip-muted h-8 px-3 text-[0.8125rem]"><Icon name="clock" size={16} />{labels.pending}</span>;
}

// Substantiation status badge (TSNAP-039). Green complete / amber needs-something / gray pending.
// Wording uses "Documentation complete" not "audit-ready" (Jordan/Marcus liability).

interface Props {
  substantiationComplete: boolean;
  needsReceipt: boolean;
  missingFields?: string[] | null;
}

export function SubstantiationBadge({ substantiationComplete, needsReceipt, missingFields }: Props) {
  let label: string;
  let cls: string;

  if (substantiationComplete) {
    label = '✓ Documentation complete';
    cls = 'bg-success-50 text-success-700 ring-success-600/20';
  } else if (needsReceipt) {
    label = '⚠ Needs receipt';
    cls = 'bg-warning-50 text-warning-700 ring-warning-600/20';
  } else if (missingFields && missingFields.length > 0) {
    label = '⚠ Needs context';
    cls = 'bg-warning-50 text-warning-700 ring-warning-600/20';
  } else {
    label = 'Pending';
    cls = 'bg-gray-100 text-gray-600 ring-gray-500/20';
  }

  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {label}
    </span>
  );
}

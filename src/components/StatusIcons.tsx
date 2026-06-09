// Compact status icons for the dashboard receipt cards (mobile-friendly alternative to the text
// SubstantiationBadge, which stays on the detail page). Shows an optional "needs review" eye plus
// one substantiation-status icon: complete / needs-receipt / needs-context / pending. Labels are
// passed in already-localized (DEC-026) and used as the title + aria-label so the icons stay
// accessible and hover-explainable. Inline SVGs — no icon-library dependency.

interface Labels {
  complete: string;
  needsReceipt: string;
  needsContext: string;
  pending: string;
  review: string;
}

interface Props {
  substantiationComplete: boolean;
  needsReceipt: boolean;
  missingFields?: string[] | null;
  needsReview?: boolean;
  reviewReason?: string | null;
  labels: Labels;
}

// Wrap an SVG so it carries an accessible name + hover tooltip and a color via text-*.
function Icon({ label, className, children }: { label: string; className: string; children: React.ReactNode }) {
  return (
    <span role="img" aria-label={label} title={label} className={`inline-flex ${className}`}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </span>
  );
}

export function StatusIcons({ substantiationComplete, needsReceipt, missingFields, needsReview, reviewReason, labels }: Props) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {needsReview && (
        <Icon label={reviewReason ? `${labels.review}: ${reviewReason}` : labels.review} className="text-warning-700">
          {/* eye */}
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </Icon>
      )}

      {substantiationComplete ? (
        <Icon label={labels.complete} className="text-success-700">
          {/* check-circle */}
          <circle cx="12" cy="12" r="9" />
          <path d="m8.5 12 2.5 2.5 4.5-5" />
        </Icon>
      ) : needsReceipt ? (
        <Icon label={labels.needsReceipt} className="text-warning-700">
          {/* receipt */}
          <path d="M5 3v18l2-1.2L9 21l2-1.2L13 21l2-1.2L17 21l2-1.2V3l-2 1.2L15 3l-2 1.2L11 3 9 4.2 7 3 5 4.2Z" />
          <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" />
        </Icon>
      ) : missingFields && missingFields.length > 0 ? (
        <Icon label={labels.needsContext} className="text-warning-700">
          {/* alert-triangle */}
          <path d="M12 3 2.5 20h19L12 3Z" />
          <path d="M12 9.5v4.5M12 17.5h.01" />
        </Icon>
      ) : (
        <Icon label={labels.pending} className="text-gray-400">
          {/* clock */}
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5V12l3 1.8" />
        </Icon>
      )}
    </span>
  );
}

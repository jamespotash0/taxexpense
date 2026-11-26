// Terms of Service + Tax Disclaimer (EPIC-5). OWNER: Jordan. V1 draft pending legal review.
// Uses "documentation complete," never "audit-ready"/"audit-proof" (liability).
import { LegalPage } from '@/components/LegalPage';

export const metadata = { title: 'Terms & Tax Disclaimer', alternates: { canonical: '/terms' } };

// Bump when the terms text changes.
const LAST_UPDATED = 'November 26, 2026';

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: 'What Tally is',
    body: <>Tally is a recordkeeping tool that helps self-employed people capture and organize business expenses by text. It is provided &ldquo;as is,&rdquo; without warranties.</>,
  },
  {
    title: 'Not tax advice',
    body: <>Tally is not a tax advisor, accountant, or law firm, and nothing it produces is tax, legal, or financial advice. Categorizations and IRC references are general information that may be incomplete or inapplicable to your situation. The IRS makes the final determination on any deduction. For advice on your circumstances, consult a licensed tax professional.</>,
  },
  {
    title: '“Documentation complete”',
    body: <>When Tally marks an expense &ldquo;documentation complete,&rdquo; it means the records we prompt for have been captured. It is not a guarantee of deductibility or of any audit outcome.</>,
  },
  {
    title: 'Your responsibility',
    body: <>You are responsible for the accuracy of what you submit and for your own tax filings. Review your records before relying on them. You have final say over every categorization.</>,
  },
  {
    title: 'Acceptable use',
    body: <>Use Tally only for your own lawful business recordkeeping. Don&apos;t abuse, overload, or attempt to breach the service.</>,
  },
  {
    title: 'SMS terms',
    body: (
      <>
        Tally is a recurring automated text-messaging program that lets you log business expenses by text and receive expense confirmations, follow-up questions, account notifications, and one-time login passcodes. By submitting your number on our site or texting Tally, you consent to receive these messages. Consent is not a condition of purchase. Message frequency varies based on your activity. Message &amp; data rates may apply. Reply HELP for help. Reply STOP to opt out at any time. Carriers are not liable for delayed or undelivered messages.
      </>
    ),
  },
  {
    title: 'Liability',
    body: <>To the maximum extent permitted by law, Tally is not liable for any indirect or consequential damages, or for tax outcomes, penalties, or disallowed deductions.</>,
  },
  {
    title: 'Changes',
    body: <>We may update these terms. Continued use means you accept the changes.</>,
  },
];

export default function TermsPage() {
  return <LegalPage title="Terms of Service" lastUpdated={LAST_UPDATED} sections={SECTIONS} seeAlso={{ href: '/privacy', label: 'Privacy Policy' }} />;
}

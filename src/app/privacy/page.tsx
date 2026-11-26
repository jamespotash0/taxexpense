// Privacy Policy (EPIC-5: TSNAP). OWNER: Jordan. V1 draft — get a lawyer review before
// charging users (CLAUDE.md Critical Open Item). Plain-language, CCPA disclosure included.
import { LegalPage } from '@/components/LegalPage';

export const metadata = { title: 'Privacy Policy', alternates: { canonical: '/privacy' } };

// Bump when the policy text changes.
const LAST_UPDATED = 'November 26, 2026';

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: 'What we collect',
    body: <>Your phone number; the expense messages and receipt photos you send us; details you add in the dashboard (name, email, business name, accountant email); and basic usage logs. We do not ask for or store full card numbers.</>,
  },
  {
    title: 'How we use it',
    body: <>To categorize and store your expenses, reply over SMS, show your dashboard, send reminders about missing receipts, and (only when you ask) email a summary to your accountant.</>,
  },
  {
    title: 'SMS and TCPA',
    body: <>By submitting your number on our site or texting Tally you consent to receive SMS messages from us. Message &amp; data rates may apply. Reply STOP to opt out; reply HELP for help. We log your consent. We do not share your mobile opt-in information, phone number, or SMS consent with third parties or affiliates for their marketing purposes. No mobile information is shared for promotional or marketing purposes.</>,
  },
  {
    title: 'AI processing',
    body: <>Receipt images and expense text are sent to our AI provider (Anthropic) solely to extract and categorize the expense. We do not sell your data.</>,
  },
  {
    title: 'Storage and security',
    body: <>Data is stored with our infrastructure providers (Supabase, Vercel). Receipt photos are kept in a private store and served only via short-lived signed links. Access is restricted to our application.</>,
  },
  {
    title: 'Retention and deletion',
    body: <>We keep your records until you ask us to delete them. To delete your data, use Delete account in your dashboard settings. Deletion removes your receipts and photos.</>,
  },
  {
    title: 'Your rights (CCPA/CPRA)',
    body: <>If you are a California resident, you may request access to or deletion of your personal information, and we do not sell or share it for cross-context behavioral advertising. You can export or delete everything from your dashboard at any time.</>,
  },
];

export default function PrivacyPage() {
  return <LegalPage title="Privacy Policy" lastUpdated={LAST_UPDATED} sections={SECTIONS} seeAlso={{ href: '/terms', label: 'Terms of Service' }} />;
}

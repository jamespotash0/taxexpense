// Privacy Policy (EPIC-5: TSNAP). OWNER: Jordan. V1 draft — get a lawyer review before
// charging users (CLAUDE.md Critical Open Item). Plain-language, CCPA disclosure included.
import Link from 'next/link';

export const metadata = { title: 'Privacy Policy — Tally' };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-gray-700">
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">← Home</Link>
      <h1 className="mt-4 text-2xl font-semibold">Privacy Policy</h1>
      <p className="mt-1 text-sm text-gray-400">Last updated {new Date().getFullYear()}. This is a V1 draft pending legal review.</p>

      <section className="mt-6 space-y-4 text-sm leading-6">
        <p><b>What we collect.</b> Your phone number; the expense messages and receipt photos you send us; details you add in the dashboard (name, email, business name, accountant email); and basic usage logs. We do not ask for or store full card numbers.</p>
        <p><b>How we use it.</b> To categorize and store your expenses, reply over SMS, show your dashboard, send reminders about missing receipts, and — only when you ask — email a summary to your accountant.</p>
        <p><b>SMS / TCPA.</b> By submitting your number on our site or texting Tally you consent to receive SMS messages from us. Message &amp; data rates may apply. Reply STOP to opt out; reply HELP for help. We log your consent. <b>We do not share your mobile opt-in information, phone number, or SMS consent with third parties or affiliates for their marketing purposes.</b> No mobile information is shared for promotional or marketing purposes.</p>
        <p><b>AI processing.</b> Receipt images and expense text are sent to our AI provider (Anthropic) solely to extract and categorize the expense. We do not sell your data.</p>
        <p><b>Storage &amp; security.</b> Data is stored with our infrastructure providers (Supabase, Vercel). Receipt photos are kept in a private store and served only via short-lived signed links. Access is restricted to our application.</p>
        <p><b>Retention &amp; deletion.</b> We keep your records until you ask us to delete them. To delete your data, text STOP and email us a deletion request, or use the dashboard. Deletion removes your receipts and photos.</p>
        <p><b>Your rights (CCPA/CPRA).</b> If you are a California resident, you may request access to or deletion of your personal information, and we do <b>not</b> sell or share it for cross-context behavioral advertising. Contact us to exercise these rights.</p>
        <p><b>Contact.</b> Questions or requests: reach out via the email on our site.</p>
      </section>
    </main>
  );
}

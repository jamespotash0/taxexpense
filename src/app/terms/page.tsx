// Terms of Service + Tax Disclaimer (EPIC-5). OWNER: Jordan. V1 draft pending legal review.
// Uses "documentation complete," never "audit-ready"/"audit-proof" (liability).
import Link from 'next/link';

export const metadata = { title: 'Terms & Tax Disclaimer — Tally' };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-gray-700">
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">← Home</Link>
      <h1 className="mt-4 text-2xl font-semibold">Terms of Service</h1>
      <p className="mt-1 text-sm text-gray-400">Last updated {new Date().getFullYear()}. This is a V1 draft pending legal review.</p>

      <section className="mt-6 space-y-4 text-sm leading-6">
        <p><b>What Tally is.</b> Tally is a recordkeeping tool that helps self-employed people capture and organize business expenses by text. It is provided &ldquo;as is,&rdquo; without warranties.</p>
        <p><b>Not tax advice.</b> Tally is <b>not</b> a tax advisor, accountant, or law firm, and nothing it produces is tax, legal, or financial advice. Categorizations and IRC references are general information that may be incomplete or inapplicable to your situation. The IRS makes the final determination on any deduction. For advice on your circumstances, consult a licensed tax professional.</p>
        <p><b>&ldquo;Documentation complete.&rdquo;</b> When Tally marks an expense &ldquo;documentation complete,&rdquo; it means the records we prompt for have been captured — it is <b>not</b> a guarantee of deductibility or of any audit outcome.</p>
        <p><b>Your responsibility.</b> You are responsible for the accuracy of what you submit and for your own tax filings. Review your records before relying on them. You have final say over every categorization.</p>
        <p><b>Acceptable use.</b> Use Tally only for your own lawful business recordkeeping. Don&apos;t abuse, overload, or attempt to breach the service.</p>
        <p><b>SMS terms.</b> By texting Tally you agree to receive messages from us; reply STOP to opt out. Message &amp; data rates may apply.</p>
        <p><b>Liability.</b> To the maximum extent permitted by law, Tally is not liable for any indirect or consequential damages, or for tax outcomes, penalties, or disallowed deductions.</p>
        <p><b>Changes.</b> We may update these terms; continued use means you accept the changes.</p>
        <p className="text-gray-500">See also our <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
      </section>
    </main>
  );
}

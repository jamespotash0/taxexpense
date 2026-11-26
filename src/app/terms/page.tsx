// Terms of Service + Tax Disclaimer (EPIC-5). OWNER: Jordan. V1 draft pending legal review.
// Uses "documentation complete," never "audit-ready"/"audit-proof" (liability).
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/AppIcons';

export const metadata = { title: 'Terms & Tax Disclaimer', alternates: { canonical: '/terms' } };

export default function TermsPage() {
  return (
    <AppShell wordmarkHref="/" width="max-w-2xl">
      <article className="pb-6 pt-2 text-foreground/85">
      <Link href="/" className="inline-flex items-center gap-1 rounded-full bg-fill py-2 pl-2.5 pr-4 text-sm font-semibold hover:bg-fill-strong"><Icon name="back" size={18} />Home</Link>
      <h1 className="mt-6 text-[2rem] font-bold leading-tight tracking-[-0.03em] text-foreground">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted">Last updated {new Date().getFullYear()}. This is a V1 draft pending legal review.</p>

      <section className="mt-8 max-w-[68ch] space-y-5 text-[0.9375rem] leading-7 [&_b]:font-semibold [&_b]:text-foreground">
        <p><b>What Tally is.</b> Tally is a recordkeeping tool that helps self-employed people capture and organize business expenses by text. It is provided &ldquo;as is,&rdquo; without warranties.</p>
        <p><b>Not tax advice.</b> Tally is <b>not</b> a tax advisor, accountant, or law firm, and nothing it produces is tax, legal, or financial advice. Categorizations and IRC references are general information that may be incomplete or inapplicable to your situation. The IRS makes the final determination on any deduction. For advice on your circumstances, consult a licensed tax professional.</p>
        <p><b>&ldquo;Documentation complete.&rdquo;</b> When Tally marks an expense &ldquo;documentation complete,&rdquo; it means the records we prompt for have been captured; it is <b>not</b> a guarantee of deductibility or of any audit outcome.</p>
        <p><b>Your responsibility.</b> You are responsible for the accuracy of what you submit and for your own tax filings. Review your records before relying on them. You have final say over every categorization.</p>
        <p><b>Acceptable use.</b> Use Tally only for your own lawful business recordkeeping. Don&apos;t abuse, overload, or attempt to breach the service.</p>
        <p><b>SMS terms.</b> <b>Tally</b> is a recurring automated text-messaging program that lets you log business expenses by text and receive expense confirmations, follow-up questions, account notifications, and one-time login passcodes. By submitting your number on our site or texting Tally, you consent to receive these messages. Message frequency varies based on your activity. Message &amp; data rates may apply. Reply <b>HELP</b> for help or contact <a className="underline" href="mailto:support@tallywhy.com">support@tallywhy.com</a>; reply <b>STOP</b> to opt out at any time. Carriers are not liable for delayed or undelivered messages.</p>
        <p><b>Liability.</b> To the maximum extent permitted by law, Tally is not liable for any indirect or consequential damages, or for tax outcomes, penalties, or disallowed deductions.</p>
        <p><b>Changes.</b> We may update these terms; continued use means you accept the changes.</p>
        <p className="text-muted">See also our <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
      </section>
    </article>
    </AppShell>
  );
}

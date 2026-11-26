// /start — "text us to get started" (DEC-056, supersedes DEC-048/049). Onboarding now happens
// ENTIRELY over SMS; this page's only job is to hand the visitor to the text thread (or, on a
// computer where sms: dead-ends, tell them to text from their phone) and offer a login link for
// returning users. The old multi-step web question funnel was removed — its answers never
// reached the SMS flow (no phone to key on), so users got re-asked. See JOURNAL DEC-056.
// Visual: same world as the landing (pastel-wash panel, iMessage thread, red pill CTA).
import Link from 'next/link';
import { getI18n } from '@/i18n/server';
import { formatUsPhone } from '@/lib/phone';
import { publicSmsNumber, isLinq } from '@/lib/env';
import { StartTextButton } from '@/components/StartTextButton';
import { TallyWordmark } from '@/components/SiteHeader';
import { HeroThread } from '@/components/HeroThread';

export const metadata = { title: 'Get started' };

export default async function StartPage() {
  const { t } = await getI18n();
  const o = t.onboarding;
  // Fall back to a placeholder (reserved 555-01xx fictional range) so the page always shows a
  // number to text even before the real Twilio number is wired. A real env number always wins.
  const rawNumber = publicSmsNumber() || '+1 (415) 555-0134';
  const number = formatUsPhone(rawNumber);
  const smsHref = `sms:${rawNumber.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent('Hi Tally')}`;
  // Linq: the visitor enters their number first, so copy can't say "text this number" yet.
  const register = isLinq();

  return (
    <main className="min-h-screen bg-[#fafafa] px-3 pb-10 pt-4 text-[#101210] sm:px-6">
      <div className="mx-auto flex h-[3.25rem] max-w-[80rem] items-center px-2">
        <TallyWordmark back />
      </div>

      <div className="hero-wash mx-auto mt-3 grid max-w-[80rem] items-center gap-12 overflow-hidden rounded-[32px] px-6 py-12 sm:rounded-[40px] sm:px-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-14 lg:py-16">
        <div>
          <span className="inline-flex rounded-full bg-white px-3.5 py-1.5 text-[0.85rem] font-medium text-[#d92d20] ring-1 ring-black/[0.06]">
            {o.startBadge}
          </span>
          <h1 className="mt-6 text-balance text-[clamp(2.4rem,5vw,3.75rem)] font-medium leading-[1.05] tracking-[-0.04em]">{o.startTitle}</h1>
          <p className="mt-5 max-w-[30rem] text-pretty text-[1.15rem] leading-[1.5] text-[#4a4d48]">{register ? o.startSubRegister : o.startSub}</p>

          <StartTextButton
            register={register}
            number={number}
            smsHref={smsHref}
            t={{ text: o.startText, placeholder: o.startPhonePlaceholder, error: o.startPhoneError, addContact: o.startAddContact }}
          />

          <p className="mt-5 text-[0.88rem] text-[#6f726d]">{register ? o.startDesktopNoteRegister : o.startDesktopNote}</p>
          <p className="mt-1 text-[0.88rem] text-[#6f726d]">{o.startDisclaimer}</p>
          <p className="mt-3 max-w-[34rem] text-[0.8rem] leading-relaxed text-[#8a8d88]">
            {o.startConsent}{' '}
            <Link href="/terms" className="underline decoration-black/20 underline-offset-2 hover:text-[#101210]">{t.footer.terms}</Link>
            {' · '}
            <Link href="/privacy" className="underline decoration-black/20 underline-offset-2 hover:text-[#101210]">{t.footer.privacy}</Link>
          </p>
        </div>

        <div className="hidden sm:block">
          <HeroThread />
        </div>
      </div>

      <p className="mx-auto mt-8 max-w-[80rem] px-2 text-[0.95rem] text-[#6f726d]">
        {o.startHaveAccount}{' '}
        <Link href="/login" className="font-medium text-[#101210] underline decoration-black/20 underline-offset-4 hover:decoration-[#101210]">
          {t.nav.login}
        </Link>
      </p>
    </main>
  );
}

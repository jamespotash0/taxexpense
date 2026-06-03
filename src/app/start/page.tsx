// /start — web onboarding (EPIC-9 funnel), localized (DEC-025).
import { OnboardingFlow } from '@/components/OnboardingFlow';
import { getI18n } from '@/i18n/server';

export const metadata = { title: 'Get started — Tally' };

export default async function StartPage() {
  const { t } = await getI18n();
  // Text-first product: the funnel ends in "text the number," never an app install. Fall back
  // to a placeholder (reserved 555-01xx fictional range) so the final step always shows a number
  // to text even before the real Twilio number is wired. A real env number always takes over.
  const number = process.env.TWILIO_PHONE_NUMBER || '+1 (415) 555-0134';
  const smsHref = `sms:${number.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent('Hi Tally')}`;
  return <OnboardingFlow number={number} smsHref={smsHref} t={t.onboarding} />;
}

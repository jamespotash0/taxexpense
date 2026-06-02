// /start — web onboarding (EPIC-9 funnel), localized (DEC-025).
import { OnboardingFlow } from '@/components/OnboardingFlow';
import { getI18n } from '@/i18n/server';

export const metadata = { title: 'Get started — Tally' };

export default async function StartPage() {
  const { t } = await getI18n();
  const number = process.env.TWILIO_PHONE_NUMBER ?? '';
  const smsHref = number ? `sms:${number.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent('Hi Tally')}` : undefined;
  return <OnboardingFlow number={number} smsHref={smsHref} t={t.onboarding} install={t.install} />;
}

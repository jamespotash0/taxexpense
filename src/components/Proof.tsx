// Honest "why we built it" line (DEC-043). NOT a fabricated testimonial — we have ~0 users,
// so this is framed as the product's founding insight, clearly attributed as such (Jordan).
// Server component (composes Reveal only).
import { Reveal } from '@/components/Reveal';
import type { Dict } from '@/i18n/dictionaries';

export function Proof({ t }: { t: Dict['proof'] }) {
  return (
    <Reveal className="mx-auto max-w-3xl text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-accent">{t.eyebrow}</p>
      <blockquote className="mt-5 text-balance text-2xl font-medium leading-snug tracking-tight text-gray-900 sm:text-3xl">
        “{t.quote}”
      </blockquote>
      <p className="mt-5 text-sm font-medium text-gray-500">{t.attribution}</p>
    </Reveal>
  );
}

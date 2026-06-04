// "Tax time, organized" — back to a simple numbered stepper: three numbers connected by a line,
// each with its step copy. No cinematic cards, no proof artifacts. Server component: it only
// composes the client motion primitives (Reveal/Stagger), so it stays server-rendered.
import { Reveal, Stagger, StaggerItem } from '@/components/Reveal';
import type { Dict } from '@/i18n/dictionaries';

export function HowItWorks({ t }: { t: Dict['bento'] }) {
  return (
    <>
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-accent">{t.eyebrow}</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{t.heading}</h2>
        <p className="mt-4 text-lg text-gray-600">{t.sub}</p>
      </Reveal>

      <Stagger className="mx-auto mt-16 grid max-w-4xl gap-12 md:grid-cols-3 md:gap-10">
        {t.steps.map((step, i) => (
          <StaggerItem key={i} className="relative text-center">
            {/* Connector line running to the next number (desktop only). */}
            {i < t.steps.length - 1 && (
              <span
                aria-hidden
                className="absolute left-1/2 top-6 hidden h-px bg-gray-200 md:block"
                style={{ width: 'calc(100% + 2.5rem)' }}
              />
            )}
            <span className="relative z-10 mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent text-lg font-semibold text-white shadow-lg shadow-accent/25">
              {i + 1}
            </span>
            <h3 className="mt-5 text-lg font-semibold text-gray-900">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">{step.body}</p>
          </StaggerItem>
        ))}
      </Stagger>
    </>
  );
}

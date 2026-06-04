// "Tax season, two ways" — the payoff (DEC-043). Two cinematic tiles instead of flat list
// cards: "Without Tally" is backed by the April-scramble footage (the shoebox of receipts),
// desaturated and cool; "With Tally" is backed by the calm payoff footage, warm and resolved.
// The footage is the custom asset — the lists ride on top of a scrim. Server component: it
// composes the client motion primitive (Reveal) and the lazy video tile (ScrollVideo).
import { Reveal } from '@/components/Reveal';
import { ScrollVideo } from '@/components/ScrollVideo';
import type { Dict } from '@/i18n/dictionaries';

function Tile({
  title,
  items,
  tone,
}: {
  title: string;
  items: readonly string[];
  tone: 'without' | 'with';
}) {
  const isWith = tone === 'with';
  return (
    <div
      className={`lift relative flex min-h-[460px] flex-col justify-end overflow-hidden rounded-3xl p-7 shadow-xl shadow-gray-900/25 ring-1 ${
        isWith ? 'ring-success-600/30' : 'ring-white/10'
      }`}
    >
      {isWith ? (
        <ScrollVideo
          src="/hero/story/payoff.mp4"
          gradient="linear-gradient(150deg, #0f231c 0%, #1f5e49 55%, #4fb38a 100%)"
          kb={{ x: '45%', y: '50%' }}
        />
      ) : (
        <ScrollVideo
          src="/hero/story/april_scramble.mp4"
          gradient="linear-gradient(150deg, #1a1d24 0%, #353b48 55%, #6b7280 100%)"
          kb={{ x: '55%', y: '45%' }}
          videoClassName="grayscale-[0.55] brightness-[0.85]"
        />
      )}

      <div className="relative z-10">
        <p
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur ${
            isWith ? 'bg-success-500/20 text-success-100 ring-1 ring-success-400/30' : 'bg-white/10 text-white/80 ring-1 ring-white/15'
          }`}
        >
          {title}
        </p>
        <ul className="mt-5 space-y-3">
          {items.map((item, i) => {
            const last = isWith && i === items.length - 1;
            return (
              <li
                key={item}
                className={`flex items-start gap-3 text-[15px] ${
                  isWith ? (last ? 'font-semibold text-white' : 'text-white/90') : 'text-white/75'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold backdrop-blur ${
                    isWith ? 'bg-success-400/90 text-success-950' : 'bg-white/15 text-white/70'
                  }`}
                  aria-hidden
                >
                  {isWith ? '✓' : '✕'}
                </span>
                {item}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function TaxSeason({ t }: { t: Dict['taxSeason'] }) {
  return (
    <>
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-accent">{t.eyebrow}</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{t.heading}</h2>
      </Reveal>

      <Reveal className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2" delay={0.06}>
        <Tile title={t.withoutTitle} items={t.withoutItems} tone="without" />
        <Tile title={t.withTitle} items={t.withItems} tone="with" />
      </Reveal>
    </>
  );
}

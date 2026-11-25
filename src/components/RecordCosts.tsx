// Compliance section (drawn for the dark ink band): the heading on top, then what a missing record costs as
// sourced stats side by side (not cards). The numbers tick in on scroll; the $0 row counts down
// from the hero's $92.40 lunch.
import { BlurFade } from './Reveal';
import { NumberTicker } from './NumberTicker';

type Row = { value: number; from: number; prefix: string; suffix: string; text: string; source: string };

export function RecordCosts({ t }: { t: { title: string; costsHeading: string; rows: Row[]; note: string } }) {
  return (
    <div className="mx-auto max-w-[80rem]">
      <BlurFade>
        <h2 className="max-w-[44rem] text-balance text-[clamp(2.1rem,4.4vw,2.9rem)] font-normal leading-[1.1] tracking-[-0.018em] text-white">{t.title}</h2>
      </BlurFade>

      <div className="mt-14 lg:mt-20">
        <BlurFade>
          <h3 className="text-[1.15rem] font-normal tracking-[-0.02em] text-white">{t.costsHeading}</h3>
        </BlurFade>
        {/* Two by two (stacked on phones); each stat sits under its own hairline, with even gutters. */}
        <ul className="mt-10 grid gap-x-16 gap-y-14 sm:grid-cols-2">
          {t.rows.map((r, i) => (
            <li key={r.source} className="border-t border-white/[0.15] pt-7">
              <BlurFade delay={i * 0.08}>
                <p className="text-[clamp(3rem,5vw,4.25rem)] font-normal leading-none tracking-[-0.04em] text-white">
                  {/* A symbol suffix (%) stays display size; a word ("years") drops to label size. */}
                  <NumberTicker value={r.value} from={r.from} prefix={r.prefix} suffix={r.suffix.startsWith(' ') ? '' : r.suffix} />
                  {r.suffix.startsWith(' ') && (
                    <span className="ml-2 text-[1.2rem] font-normal tracking-[-0.02em] text-[#c4c6c1]">{r.suffix.trim()}</span>
                  )}
                </p>
                <p className="mt-5 max-w-[34rem] text-[1.05rem] leading-[1.55] text-[#e6e7e4]">{r.text}</p>
                <p className="mt-3 text-[0.8rem] italic leading-snug text-[#8f928c]">{r.source}</p>
              </BlurFade>
            </li>
          ))}
        </ul>
        <p className="mt-14 text-[0.85rem] text-[#8f928c]">{t.note}</p>
      </div>
    </div>
  );
}

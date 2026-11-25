// Compliance section: the heading on top, then what a missing record costs as three full-width
// sourced rows (not cards). The numbers tick in on scroll; the $0 row counts down
// from the hero's $92.40 lunch.
import { BlurFade } from './Reveal';
import { NumberTicker } from './NumberTicker';

type Row = { value: number; from: number; prefix: string; suffix: string; text: string; source: string };

export function RecordCosts({ t }: { t: { title: string; sub: string; costsHeading: string; rows: Row[]; note: string } }) {
  return (
    <div className="mx-auto max-w-[80rem]">
      <BlurFade>
        <h2 className="text-balance text-[clamp(2.1rem,4.4vw,2.9rem)] font-normal leading-[1.1] tracking-[-0.018em] text-[#101210]">{t.title}</h2>
        <p className="mt-4 max-w-[38rem] text-[1.1rem] leading-[1.5] text-[#6f726d]">{t.sub}</p>
      </BlurFade>

      <div className="mt-16 lg:mt-20">
        <h3 className="mb-2 text-[1.15rem] font-normal tracking-[-0.02em] text-[#101210]">{t.costsHeading}</h3>
        <ul className="divide-y divide-black/[0.08] border-y border-black/[0.08]">
          {t.rows.map((r, i) => (
            <li key={r.source}>
              <BlurFade delay={i * 0.08} className="grid gap-4 py-10 sm:grid-cols-[16rem_1fr] sm:items-center sm:gap-12 lg:py-14">
                <p className="text-[clamp(3.4rem,8vw,5.5rem)] font-normal leading-none tracking-[-0.04em] text-[#101210]">
                  {/* A symbol suffix (%) stays display size; a word ("years") drops to label size. */}
                  <NumberTicker value={r.value} from={r.from} prefix={r.prefix} suffix={r.suffix.startsWith(' ') ? '' : r.suffix} />
                  {r.suffix.startsWith(' ') && (
                    <span className="ml-2 text-[1.3rem] font-normal tracking-[-0.02em] text-[#4a4d48]">{r.suffix.trim()}</span>
                  )}
                </p>
                <div>
                  <p className="max-w-[40rem] text-[1.1rem] leading-[1.55] text-[#2c2e2a]">{r.text}</p>
                  <p className="mt-2 text-[0.82rem] text-[#6f726d]">{r.source}</p>
                </div>
              </BlurFade>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-[0.85rem] text-[#6f726d]">{t.note}</p>
      </div>
    </div>
  );
}

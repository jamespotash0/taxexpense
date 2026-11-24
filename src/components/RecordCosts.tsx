// Compliance section: the heading (left) beside what a missing record costs (right, three sourced
// facts as stacked rows, not cards). The numbers tick in on scroll; the $0 row counts down
// from the hero's $92.40 lunch.
import { BlurFade } from './Reveal';
import { NumberTicker } from './NumberTicker';

type Row = { value: number; from: number; prefix: string; suffix: string; text: string; source: string };

export function RecordCosts({ t }: { t: { title: string; sub: string; costsHeading: string; rows: Row[]; note: string } }) {
  return (
    <div className="mx-auto grid max-w-[80rem] gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
      <BlurFade className="lg:sticky lg:top-28 lg:self-start">
        <h2 className="text-balance text-[clamp(2.1rem,4.4vw,2.9rem)] font-normal leading-[1.1] tracking-[-0.018em] text-[#101210]">{t.title}</h2>
        <p className="mt-3 max-w-[28rem] text-[1.1rem] leading-[1.5] text-[#6f726d]">{t.sub}</p>
      </BlurFade>

      <div>
        <h3 className="mb-2 text-[1.15rem] font-normal tracking-[-0.02em] text-[#101210]">{t.costsHeading}</h3>
        <ul className="divide-y divide-black/[0.08] border-y border-black/[0.08]">
          {t.rows.map((r, i) => (
            <li key={r.source}>
              <BlurFade delay={i * 0.08} className="grid gap-3 py-8 sm:grid-cols-[11rem_1fr] sm:gap-8">
                <p className="text-[clamp(2.8rem,6vw,4rem)] font-normal leading-none tracking-[-0.04em] text-[#101210]">
                  {/* A symbol suffix (%) stays display size; a word ("years") drops to label size. */}
                  <NumberTicker value={r.value} from={r.from} prefix={r.prefix} suffix={r.suffix.startsWith(' ') ? '' : r.suffix} />
                  {r.suffix.startsWith(' ') && (
                    <span className="ml-2 text-[1.3rem] font-normal tracking-[-0.02em] text-[#4a4d48]">{r.suffix.trim()}</span>
                  )}
                </p>
                <div>
                  <p className="max-w-[34rem] text-[1.05rem] leading-[1.55] text-[#2c2e2a]">{r.text}</p>
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

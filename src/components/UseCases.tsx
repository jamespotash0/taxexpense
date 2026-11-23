// Use-case carousel (replaces Missing Piece / How it works / Why Tally / Tax season): real
// moments of spending, each card showing what you text and what Tally says back. Server
// component; ScrollRow adds the prev/next buttons.
// Photos (public/landing/) are from Unsplash under the free Unsplash License, 2026-11-23:
//   business-lunch.jpg  unsplash.com/photos/TMHUqbpkJdo  Vitaly Gariev
//   coffee-to-go.jpg    unsplash.com/photos/4g_M9D0rn8M  Vitaly Gariev
//   fuel-pump.jpg       unsplash.com/photos/4dOr247sHaI  engin akyurt
import Image from 'next/image';
import { ScrollRow } from '@/components/ScrollRow';
import type { Dict } from '@/i18n/dictionaries';

const card = 'relative h-[32rem] shrink-0 snap-start overflow-hidden rounded-[28px]';
const me = 'self-end max-w-[85%] rounded-[18px] rounded-br-[6px] bg-[#0b84ff] px-3.5 py-2 text-[0.92rem] leading-snug text-white';
const them = 'self-start max-w-[88%] rounded-[18px] rounded-bl-[6px] bg-white/95 px-3.5 py-2 text-[0.92rem] leading-snug text-[#101210] backdrop-blur';

function Title({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return <h3 className={`text-[1.35rem] font-medium tracking-[-0.025em] ${light ? 'text-white' : 'text-[#101210]'}`}>{children}</h3>;
}

function PhotoCard({ src, title, className, children }: { src: string; title: string; className: string; children: React.ReactNode }) {
  return (
    <article className={`${card} ${className}`}>
      <Image src={src} alt="" fill sizes="(min-width: 640px) 36rem, 85vw" className="object-cover" />
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.45)_0%,rgba(0,0,0,0)_30%,rgba(0,0,0,0)_50%,rgba(0,0,0,0.55)_100%)]" />
      <div className="relative flex h-full flex-col justify-between p-6">
        <Title light>{title}</Title>
        <div className="flex flex-col gap-1.5">{children}</div>
      </div>
    </article>
  );
}

export function UseCases({ t }: { t: Dict['useCases'] }) {
  return (
    <>
      <div className="mx-auto max-w-[80rem] px-5 text-center sm:px-6">
        <h2 className="text-balance text-[clamp(2.1rem,4.4vw,2.9rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-[#101210]">{t.heading}</h2>
        <p className="mx-auto mt-4 max-w-[34rem] text-pretty text-[1.1rem] leading-relaxed text-[#6f726d]">{t.sub}</p>
      </div>

      <div className="mt-12">
        <ScrollRow label={t.heading}>
          <PhotoCard src="/landing/business-lunch.jpg" title={t.lunch.title} className="w-[85vw] sm:w-[34rem]">
            <p className={me}>{t.lunch.me}</p>
            <p className={them}>{t.lunch.tally}</p>
          </PhotoCard>

          <article className={`${card} flex w-[78vw] flex-col justify-between bg-[linear-gradient(160deg,#fff1e6_0%,#fde3e1_55%,#f9d3d8_100%)] p-6 sm:w-[20rem]`}>
            <Title>{t.rule.title}</Title>
            <div>
              <p className="text-[5.5rem] font-semibold leading-none tracking-[-0.06em] text-[#101210]">
                <span className="text-[#d92d20]">$</span>75
              </p>
              <p className="mt-4 text-[1rem] leading-relaxed text-[#4a4d48]">{t.rule.body}</p>
            </div>
          </article>

          <PhotoCard src="/landing/fuel-pump.jpg" title={t.gas.title} className="w-[78vw] sm:w-[22rem]">
            <p className={me}>{t.gas.me}</p>
            <p className={them}>{t.gas.tally}</p>
          </PhotoCard>

          <article className={`${card} flex w-[78vw] flex-col bg-[linear-gradient(170deg,#eef4ff_0%,#dfe9fb_60%,#d4e6f3_100%)] p-6 sm:w-[20rem]`}>
            <Title>{t.hotel.title}</Title>
            <div className="mt-auto rounded-[20px] bg-white p-4 shadow-[0_12px_30px_-16px_rgba(16,18,16,0.35)]">
              <div className="flex items-center gap-3">
                <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef4ff] text-[#0b84ff]">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18.5v-12M3 15h18v3.5M21 15v-3a3 3 0 0 0-3-3h-7.5v6M6.5 12a1.75 1.75 0 1 0 0-.01" /></svg>
                </span>
                <div>
                  <p className="text-[0.95rem] font-semibold text-[#101210]">{t.hotel.trip}</p>
                  <p className="text-[0.82rem] text-[#6f726d]">{t.hotel.dates}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-1.5" aria-hidden>
                <span className="h-2 rounded-full bg-[#0b84ff]" />
                <span className="h-2 rounded-full bg-[#0b84ff]" />
                <span className="h-2 rounded-full bg-[#0b84ff]/30" />
              </div>
            </div>
            <p className={`${them} mt-3 !bg-white shadow-[0_8px_20px_-12px_rgba(16,18,16,0.3)]`}>{t.hotel.tally}</p>
          </article>

          <PhotoCard src="/landing/coffee-to-go.jpg" title={t.coffee.title} className="w-[85vw] sm:w-[30rem]">
            <p className="mb-2 text-balance text-[1.9rem] font-medium leading-[1.1] tracking-[-0.03em] text-white">“{t.coffee.quote}”</p>
            <p className={them}>{t.coffee.tally}</p>
          </PhotoCard>

          <article className={`${card} flex w-[78vw] flex-col bg-[linear-gradient(165deg,#ecf7f1_0%,#dff1e8_60%,#d3ebe3_100%)] p-6 sm:w-[20rem]`}>
            <Title>{t.april.title}</Title>
            <p className="mt-2 text-[0.98rem] leading-relaxed text-[#4a4d48]">{t.april.body}</p>
            <ul className="mt-auto space-y-2">
              {t.april.files.map((f) => (
                <li key={f} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-[0.92rem] font-medium text-[#101210] shadow-[0_6px_16px_-12px_rgba(16,18,16,0.35)]">
                  {f}
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#0f7a47]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" /></svg>
                </li>
              ))}
            </ul>
          </article>
        </ScrollRow>
      </div>
    </>
  );
}

// "How it works" — cinematic pass (matches the interactive video hero). Three scene tiles,
// each a warm gradient backdrop with a slow Ken Burns drift, a cinematic scrim, a glassy
// "proof" artifact, and the step copy anchored at the bottom. Server component: it only
// composes the client motion primitives (Reveal/Stagger), so it stays server-rendered.
import { Reveal, Stagger, StaggerItem } from '@/components/Reveal';
import type { Dict } from '@/i18n/dictionaries';

// Per-step cinematic palette: a warm "client lunch" amber, the indigo "why/brain", and an
// emerald "ready/done" — variety that still rhymes with the hero's scene gradients.
const SCENES = [
  { bg: 'linear-gradient(150deg, #2a1a10 0%, #7c4a2d 55%, #c98a4b 100%)', kb: { x: '38%', y: '40%' } },
  { bg: 'linear-gradient(150deg, #181530 0%, #3b2f8c 55%, #6f63d6 100%)', kb: { x: '60%', y: '45%' } },
  { bg: 'linear-gradient(150deg, #0f231c 0%, #1f5e49 55%, #4fb38a 100%)', kb: { x: '45%', y: '55%' } },
];

function GlassPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 p-3 shadow-lg shadow-black/20 backdrop-blur-md">
      {children}
    </div>
  );
}

// The proof artifact per step — what the moment actually looks like.
function Artifact({ step, chips }: { step: number; chips: { complete: string; snap: string } }) {
  if (step === 0) {
    // Texting it: an outgoing SMS the second you spend.
    return (
      <div>
        <div className="flex justify-end">
          <div className="rounded-[16px] rounded-br-[5px] bg-[#34C759] px-3 py-2 text-[13px] font-medium text-white shadow-lg shadow-black/20">
            Sweetgreen $92.40 📷
          </div>
        </div>
        <p className="mt-1 text-right text-[10px] font-medium text-white/50">Delivered</p>
      </div>
    );
  }
  if (step === 1) {
    // Capturing the why: asks only when required — complete vs. snap-a-receipt.
    return (
      <GlassPanel>
        <div className="space-y-1.5 text-xs">
          <span className="block rounded-full bg-success-50 px-3 py-1 font-medium text-success-700">{chips.complete}</span>
          <span className="block rounded-full bg-warning-50 px-3 py-1 font-medium text-warning-700">{chips.snap}</span>
        </div>
      </GlassPanel>
    );
  }
  // Ready for tax time: one-tap exports.
  return (
    <GlassPanel>
      <div className="flex flex-wrap gap-1.5">
        {['CSV', 'QuickBooks', 'Email accountant'].map((label) => (
          <span
            key={label}
            className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white"
          >
            <span className="text-emerald-300">✓</span>
            {label}
          </span>
        ))}
      </div>
    </GlassPanel>
  );
}

export function HowItWorks({ t }: { t: Dict['bento'] }) {
  return (
    <>
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-accent">{t.eyebrow}</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{t.heading}</h2>
        <p className="mt-4 text-lg text-gray-600">{t.sub}</p>
      </Reveal>

      <Stagger className="mt-14 grid gap-6 md:grid-cols-3">
        {t.steps.map((step, i) => (
          <StaggerItem key={i}>
            <article className="lift relative flex min-h-[440px] flex-col justify-end overflow-hidden rounded-3xl p-6 shadow-xl shadow-gray-900/25 ring-1 ring-white/10">
              <div
                aria-hidden
                className="ken-burns absolute inset-0"
                style={{ background: SCENES[i].bg, ['--kb-x' as string]: SCENES[i].kb.x, ['--kb-y' as string]: SCENES[i].kb.y }}
              />
              <div aria-hidden className="scene-scrim absolute inset-0" />

              {/* Step number */}
              <div className="absolute left-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-white/15 text-sm font-semibold text-white backdrop-blur">
                {i + 1}
              </div>

              {/* Proof artifact */}
              <div className="absolute inset-x-5 top-[68px] z-10">
                <Artifact step={i} chips={{ complete: t.chipComplete, snap: t.chipSnap }} />
              </div>

              {/* Copy */}
              <div className="relative z-10">
                <h3 className="text-xl font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/75">{step.body}</p>
              </div>
            </article>
          </StaggerItem>
        ))}
      </Stagger>
    </>
  );
}

'use client';

// Language switcher — sets the `locale` cookie and refreshes (DEC-025).
// Flag-based toggle: active flag is full-strength, the other is dimmed (DEC-026).
import { useRouter } from 'next/navigation';
import { LOCALES, type Locale } from '@/i18n/config';

const FLAGS: Record<Locale, { flag: string; name: string }> = {
  en: { flag: '🇺🇸', name: 'English' },
  es: { flag: '🇪🇸', name: 'Español' },
};

export function LocaleSwitcher({ current }: { current: Locale }) {
  const router = useRouter();
  function set(l: Locale) {
    // eslint-disable-next-line react-hooks/immutability -- document.cookie is a browser API, not external state
    document.cookie = `locale=${l}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }
  return (
    <div className="flex items-center gap-0.5">
      {LOCALES.map((l) => (
        <button
          key={l}
          onClick={() => set(l)}
          aria-pressed={current === l}
          aria-label={FLAGS[l].name}
          title={FLAGS[l].name}
          className={`rounded px-1 py-1 text-base leading-none transition-opacity ${
            current === l ? 'opacity-100' : 'opacity-40 grayscale hover:opacity-70 hover:grayscale-0'
          }`}
        >
          {FLAGS[l].flag}
        </button>
      ))}
    </div>
  );
}

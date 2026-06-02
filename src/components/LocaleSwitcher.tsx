'use client';

// Language switcher — sets the `locale` cookie and refreshes (DEC-025).
import { useRouter } from 'next/navigation';
import { LOCALES, type Locale } from '@/i18n/config';

export function LocaleSwitcher({ current }: { current: Locale }) {
  const router = useRouter();
  function set(l: Locale) {
    // eslint-disable-next-line react-hooks/immutability -- document.cookie is a browser API, not external state
    document.cookie = `locale=${l}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }
  return (
    <div className="flex items-center gap-0.5 text-xs">
      {LOCALES.map((l) => (
        <button
          key={l}
          onClick={() => set(l)}
          aria-pressed={current === l}
          className={`rounded px-1.5 py-1 uppercase ${current === l ? 'font-semibold text-gray-900' : 'text-gray-400 hover:text-gray-700'}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

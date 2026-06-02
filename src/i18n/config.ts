// i18n config (DEC-025). Lightweight, dependency-free. Locale lives in a cookie
// (falls back to Accept-Language). Spanish first; English default.
export const LOCALES = ['en', 'es'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'locale';

export function isLocale(v: string | undefined | null): v is Locale {
  return v === 'en' || v === 'es';
}

/** Tiny interpolation: fill {key} placeholders. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

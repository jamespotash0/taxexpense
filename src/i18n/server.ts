// Server-side locale resolution. Spanish is shelved (see getLocale) so this currently always
// resolves to the default; the cookie/Accept-Language inputs are restored when ES is re-enabled.
import { DEFAULT_LOCALE, type Locale } from './config';
import { getDict, type Dict } from './dictionaries';

export async function getLocale(): Promise<Locale> {
  // Spanish locale is SHELVED until the market is validated (CLAUDE.md: V1 is US-only, English,
  // IRC-based — no international users yet). The `es` dictionary + resolution machinery are kept
  // intact so this is a one-line revert when there are paying Spanish-speaking users: restore the
  // cookie/Accept-Language branches below. Until then every request resolves to English.
  return DEFAULT_LOCALE;
}

export async function getI18n(): Promise<{ locale: Locale; t: Dict }> {
  const locale = await getLocale();
  return { locale, t: getDict(locale) };
}

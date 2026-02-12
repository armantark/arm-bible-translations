import type { UILanguage } from '../types';
import type { LocaleDictionary, LocaleStrings } from './types';
import { ENGLISH_LOCALE } from './english';
import { ARMENIAN_LOCALE } from './armenian';
import { CLASSICAL_LOCALE } from './classical';

export type { LocaleStrings, FootnoteDisplayMode } from './types';

export const LOCALES: LocaleDictionary = {
  english: ENGLISH_LOCALE,
  armenian: ARMENIAN_LOCALE,
  classical: CLASSICAL_LOCALE,
};

export function getLocale(lang: UILanguage): LocaleStrings {
  return LOCALES[lang] ?? ENGLISH_LOCALE;
}

import { en } from './en';
import { de } from './de';
import type { SupportedLocale, TranslationSchema, LanguageInfo } from '../types';

export const locales: Record<SupportedLocale, TranslationSchema> = {
    en,
    de,
};

export const languages: Record<SupportedLocale, LanguageInfo> = {
    en: { code: 'en', label: 'English' },
    de: { code: 'de', label: 'Deutsch' },
};

export function getAvailableLanguages(): LanguageInfo[] {
    return Object.values(languages);
}

export { en, de };

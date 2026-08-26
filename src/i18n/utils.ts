import type { SupportedLocale, LanguageOption, TranslationSchema, TranslationKey } from './types';
import { locales } from './locales';

/**
 * Resolves a nested dot-notation key from a translation dictionary.
 */
export function resolveTranslation(dict: any, key: string): string | undefined {
    if (!dict || !key) return undefined;
    const parts = key.split('.');
    let current: any = dict;
    for (const part of parts) {
        if (current === undefined || current === null) return undefined;
        current = current[part];
    }
    return typeof current === 'string' ? current : undefined;
}

/**
 * Interpolates `{param}` placeholders inside a translation template string.
 */
export function interpolate(template: string, params?: Record<string, string | number>): string {
    if (!params || typeof template !== 'string') return template;
    return template.replace(/\{(\w+)\}/g, (match, key) => {
        return params[key] !== undefined ? String(params[key]) : match;
    });
}

/**
 * Detects the system language.
 * If system language starts with 'de' (e.g. de, de-DE, de-AT, de-CH) -> 'de'.
 * Any other language or unknown -> defaults to fallback 'en'.
 */
export function detectSystemLanguage(navLang?: string): SupportedLocale {
    const raw = (navLang !== undefined ? navLang : (typeof navigator !== 'undefined' ? navigator.language : '')) || '';
    const normalized = raw.toLowerCase().trim();
    if (normalized.startsWith('de')) {
        return 'de';
    }
    return 'en';
}

/**
 * Resolves the effective SupportedLocale from a LanguageOption ('system' | 'en' | 'de').
 */
export function getEffectiveLocale(option: LanguageOption, navLang?: string): SupportedLocale {
    if (option === 'de') return 'de';
    if (option === 'en') return 'en';
    return detectSystemLanguage(navLang);
}

/**
 * Translates a key with parameters and language fallback hierarchy:
 * active locale -> English base -> raw key string.
 */
export function translate(
    locale: SupportedLocale,
    key: TranslationKey | string,
    params?: Record<string, string | number>
): string {
    const activeDict = locales[locale] || locales.en;
    let template = resolveTranslation(activeDict, key);

    if (template === undefined && locale !== 'en') {
        template = resolveTranslation(locales.en, key);
    }

    if (template === undefined) {
        return key;
    }

    return interpolate(template, params);
}

/**
 * Formats a Date object or ISO date string using Intl.DateTimeFormat according to active locale.
 */
export function formatDate(
    date: Date | string | number,
    options?: Intl.DateTimeFormatOptions,
    locale: SupportedLocale = 'en'
): string {
    try {
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) return '';
        const intlLocale = locale === 'de' ? 'de-DE' : 'en-US';
        return new Intl.DateTimeFormat(intlLocale, options).format(d);
    } catch {
        return String(date);
    }
}

/**
 * Formats a number according to the active locale.
 */
export function formatNumber(
    value: number,
    locale: SupportedLocale = 'en',
    options?: Intl.NumberFormatOptions
): string {
    try {
        const intlLocale = locale === 'de' ? 'de-DE' : 'en-US';
        return new Intl.NumberFormat(intlLocale, options).format(value);
    } catch {
        return String(value);
    }
}

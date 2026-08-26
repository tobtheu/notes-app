import { useContext } from 'react';
import { I18nContext, type I18nContextValue } from './I18nContext';
import { translate, formatDate, formatNumber } from './utils';
import type { TranslationKey, LanguageOption } from './types';

const defaultFallbackContext: I18nContextValue = {
    language: 'system',
    activeLocale: 'en',
    setLanguage: (_lang: LanguageOption) => {},
    t: (key: TranslationKey | string, params?: Record<string, string | number>) => translate('en', key, params),
    formatDate: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => formatDate(date, options, 'en'),
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => formatNumber(value, 'en', options),
};

/**
 * Hook to access translation function and language settings.
 */
export function useTranslation(): I18nContextValue {
    const context = useContext(I18nContext);
    return context ?? defaultFallbackContext;
}

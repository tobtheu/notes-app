import React, { createContext, useMemo, useCallback } from 'react';
import type { LanguageOption, SupportedLocale, TranslationKey } from './types';
import { getEffectiveLocale, translate, formatDate, formatNumber } from './utils';

export interface I18nContextValue {
    language: LanguageOption;
    activeLocale: SupportedLocale;
    setLanguage: (lang: LanguageOption) => void;
    t: (key: TranslationKey | string, params?: Record<string, string | number>) => string;
    formatDate: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

interface I18nProviderProps {
    children: React.ReactNode;
    language?: LanguageOption;
    onLanguageChange?: (lang: LanguageOption) => void;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({
    children,
    language = 'system',
    onLanguageChange,
}) => {
    const activeLocale = useMemo(() => getEffectiveLocale(language), [language]);

    const setLanguage = useCallback((lang: LanguageOption) => {
        onLanguageChange?.(lang);
    }, [onLanguageChange]);

    const t = useCallback((key: TranslationKey | string, params?: Record<string, string | number>): string => {
        return translate(activeLocale, key, params);
    }, [activeLocale]);

    const formatLocalizedDate = useCallback((
        date: Date | string | number,
        options?: Intl.DateTimeFormatOptions
    ): string => {
        return formatDate(date, options, activeLocale);
    }, [activeLocale]);

    const formatLocalizedNumber = useCallback((
        value: number,
        options?: Intl.NumberFormatOptions
    ): string => {
        return formatNumber(value, activeLocale, options);
    }, [activeLocale]);

    const value = useMemo<I18nContextValue>(() => ({
        language,
        activeLocale,
        setLanguage,
        t,
        formatDate: formatLocalizedDate,
        formatNumber: formatLocalizedNumber,
    }), [language, activeLocale, setLanguage, t, formatLocalizedDate, formatLocalizedNumber]);

    return (
        <I18nContext.Provider value={value}>
            {children}
        </I18nContext.Provider>
    );
};

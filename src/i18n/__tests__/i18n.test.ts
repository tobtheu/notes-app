import { describe, it, expect } from 'vitest';
import { resolveTranslation, interpolate, detectSystemLanguage, formatDate, formatNumber } from '../utils';
import { en } from '../locales/en';
import { de } from '../locales/de';
import { getAvailableLanguages } from '../locales';

describe('i18n core utilities', () => {
    it('resolves nested dot-notation keys correctly', () => {
        expect(resolveTranslation(en, 'common.save')).toBe('Save');
        expect(resolveTranslation(de, 'common.save')).toBe('Speichern');
        expect(resolveTranslation(en, 'sidebar.newNote')).toBe('New Note');
        expect(resolveTranslation(de, 'sidebar.newNote')).toBe('Neue Notiz');
    });

    it('interpolates {placeholder} tokens in strings', () => {
        expect(interpolate('Hello {name}!', { name: 'Tobias' })).toBe('Hello Tobias!');
        expect(interpolate('{count} notes found', { count: 5 })).toBe('5 notes found');
        expect(interpolate('Version {version}', { version: '0.8.4' })).toBe('Version 0.8.4');
    });

    it('detects system language correctly and falls back to en', () => {
        expect(detectSystemLanguage('de-DE')).toBe('de');
        expect(detectSystemLanguage('de-AT')).toBe('de');
        expect(detectSystemLanguage('de-CH')).toBe('de');
        expect(detectSystemLanguage('de')).toBe('de');
        expect(detectSystemLanguage('DE')).toBe('de');
        expect(detectSystemLanguage('en-US')).toBe('en');
        expect(detectSystemLanguage('en-GB')).toBe('en');
        expect(detectSystemLanguage('fr-FR')).toBe('en');
        expect(detectSystemLanguage('es-ES')).toBe('en');
        expect(detectSystemLanguage('')).toBe('en');
        expect(detectSystemLanguage(undefined)).toBe('en');
    });

    it('formats dates according to locale', () => {
        const testDate = new Date('2026-08-26T12:00:00Z');
        const formattedEn = formatDate(testDate, { month: 'short', day: 'numeric', year: 'numeric' }, 'en');
        const formattedDe = formatDate(testDate, { month: 'short', day: 'numeric', year: 'numeric' }, 'de');
        expect(formattedEn).toBeTruthy();
        expect(formattedDe).toBeTruthy();
    });

    it('formats numbers according to locale', () => {
        const formattedEn = formatNumber(1234.56, 'en');
        const formattedDe = formatNumber(1234.56, 'de');
        expect(formattedEn).toContain('1,234.56');
        expect(formattedDe).toContain('1.234,56');
    });

    it('returns all available registered languages', () => {
        const langs = getAvailableLanguages();
        expect(langs).toEqual([
            { code: 'en', label: 'English' },
            { code: 'de', label: 'Deutsch' },
        ]);
    });

    it('ensures German dictionary has the exact same key structure as English dictionary', () => {
        const getKeys = (obj: any, prefix = ''): string[] => {
            return Object.keys(obj).reduce((res: string[], el) => {
                if (Array.isArray(obj[el])) {
                    return res;
                } else if (typeof obj[el] === 'object' && obj[el] !== null) {
                    return [...res, ...getKeys(obj[el], `${prefix}${el}.`)];
                }
                return [...res, `${prefix}${el}`];
            }, []);
        };

        const enKeys = getKeys(en).sort();
        const deKeys = getKeys(de).sort();
        expect(deKeys).toEqual(enKeys);
    });
});

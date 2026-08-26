import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { I18nProvider } from '../I18nContext';
import { useTranslation } from '../useTranslation';
import type { LanguageOption } from '../types';

function TestConsumer() {
    const { t, language, setLanguage, activeLocale, formatDate, formatNumber } = useTranslation();
    return (
        <div>
            <span data-testid="save-text">{t('common.save')}</span>
            <span data-testid="editor-words">{t('editor.wordCount', { count: 15 })}</span>
            <span data-testid="active-locale">{activeLocale}</span>
            <span data-testid="current-lang">{language}</span>
            <span data-testid="formatted-date">{formatDate(new Date('2026-08-26T12:00:00Z'), { year: 'numeric' })}</span>
            <span data-testid="formatted-num">{formatNumber(1000)}</span>
            <button onClick={() => setLanguage('de')}>Set DE</button>
            <button onClick={() => setLanguage('en')}>Set EN</button>
            <button onClick={() => setLanguage('system')}>Set System</button>
        </div>
    );
}

describe('I18nProvider & useTranslation', () => {
    it('provides translation and handles language switching', () => {
        let currentLang: LanguageOption = 'en';
        const onLanguageChange = vi.fn((newLang: LanguageOption) => {
            currentLang = newLang;
        });

        const { rerender } = render(
            <I18nProvider language={currentLang} onLanguageChange={onLanguageChange}>
                <TestConsumer />
            </I18nProvider>
        );

        expect(screen.getByTestId('save-text').textContent).toBe('Save');
        expect(screen.getByTestId('editor-words').textContent).toBe('15 words');
        expect(screen.getByTestId('active-locale').textContent).toBe('en');

        // Trigger setLanguage
        fireEvent.click(screen.getByText('Set DE'));
        expect(onLanguageChange).toHaveBeenCalledWith('de');

        // Re-render with new language
        rerender(
            <I18nProvider language="de" onLanguageChange={onLanguageChange}>
                <TestConsumer />
            </I18nProvider>
        );

        expect(screen.getByTestId('save-text').textContent).toBe('Speichern');
        expect(screen.getByTestId('editor-words').textContent).toBe('15 Wörter');
        expect(screen.getByTestId('active-locale').textContent).toBe('de');
    });

    it('falls back gracefully outside provider', () => {
        render(<TestConsumer />);
        // Should not throw, should use default English
        expect(screen.getByTestId('save-text').textContent).toBe('Save');
        expect(screen.getByTestId('active-locale').textContent).toBe('en');
    });
});

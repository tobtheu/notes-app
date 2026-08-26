import clsx from 'clsx';
import type { Theme, ThemeOrigin } from '../hooks/useTheme';
import { ThemeSelector } from './ThemeSelector';
import { TypographySelector, type FontFamily, type FontSize } from './TypographySelector';
import { useTranslation, type LanguageOption } from '../i18n';

import { SlidingSegmentedControl } from './SlidingSegmentedControl';

interface AppearanceSectionProps {
    theme: Theme;
    setTheme: (theme: Theme, origin?: ThemeOrigin) => void;
    autoTheme?: boolean;
    onToggleAutoTheme?: (enabled: boolean) => void;
    preferredLightTheme?: 'clay' | 'sage';
    monochromeIcons: boolean;
    onToggleMonochromeIcons: (v: boolean) => void;
    showIconsWhenCollapsed?: boolean;
    onToggleShowIconsWhenCollapsed?: (v: boolean) => void;
    showNoteCounts?: boolean;
    onToggleShowNoteCounts?: (v: boolean) => void;
    fontFamily: FontFamily;
    setFontFamily: (fontFamily: FontFamily) => void;
    fontSize: FontSize;
    setFontSize: (fontSize: FontSize) => void;
    language?: LanguageOption;
    setLanguage?: (lang: LanguageOption) => void;
}

export function AppearanceSection({
    theme,
    setTheme,
    autoTheme = false,
    onToggleAutoTheme,
    preferredLightTheme = 'clay',
    monochromeIcons,
    onToggleMonochromeIcons,
    showIconsWhenCollapsed = false,
    onToggleShowIconsWhenCollapsed,
    showNoteCounts = false,
    onToggleShowNoteCounts,
    fontFamily,
    setFontFamily,
    fontSize,
    setFontSize,
    language: propLanguage,
    setLanguage: propSetLanguage,
}: AppearanceSectionProps) {
    const { t, language: ctxLanguage, setLanguage: ctxSetLanguage, activeLocale } = useTranslation();
    const currentLanguage = propLanguage ?? ctxLanguage;
    const updateLanguage = propSetLanguage ?? ctxSetLanguage;

    return (
        <div className="space-y-6 text-xs select-none pb-6">
            {/* Language Selector */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="font-semibold text-[var(--text-main)]">{t('settings.language.title')}</label>
                    <span className="text-[11px] text-[var(--text-muted)]">
                        {currentLanguage === 'system' ? `${t('settings.language.system')} (${activeLocale === 'de' ? 'Deutsch' : 'English'})` : ''}
                    </span>
                </div>
                <SlidingSegmentedControl<LanguageOption>
                    value={currentLanguage}
                    onChange={updateLanguage}
                    options={[
                        { value: 'system', label: t('settings.language.system') },
                        { value: 'en', label: t('settings.language.en') },
                        { value: 'de', label: t('settings.language.de') },
                    ]}
                />
            </div>

            {/* Theme Configuration */}
            <ThemeSelector
                theme={theme}
                setTheme={setTheme}
                autoTheme={autoTheme}
                onToggleAutoTheme={onToggleAutoTheme}
                preferredLightTheme={preferredLightTheme}
            />

            {/* Folder Icons Toggle */}
            <div className="pt-3 border-t border-[var(--border-subtle)] space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="font-semibold text-[var(--text-main)] truncate">{t('settings.appearance.monochromeIcons')}</div>
                        <div className="text-[11px] text-[var(--text-muted)] leading-relaxed">{t('settings.appearance.monochromeIconsDesc')}</div>
                    </div>
                    <button
                        type="button"
                        onClick={() => onToggleMonochromeIcons(!monochromeIcons)}
                        className={clsx(
                            "w-10 h-5 rounded-full transition-colors relative shrink-0",
                            monochromeIcons ? "bg-[var(--accent-color)]" : "bg-gray-300 dark:bg-gray-700"
                        )}
                    >
                        <div className={clsx(
                            "absolute top-1 w-3 h-3 rounded-full bg-white transition-transform",
                            monochromeIcons ? "translate-x-6" : "translate-x-1"
                        )} />
                    </button>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="min-w-0 flex-1">
                        <div className="font-semibold text-[var(--text-main)] truncate">{t('settings.appearance.showIconsCollapsed')}</div>
                        <div className="text-[11px] text-[var(--text-muted)] leading-relaxed">{t('settings.appearance.showIconsCollapsedDesc')}</div>
                    </div>
                    <button
                        type="button"
                        onClick={() => onToggleShowIconsWhenCollapsed?.(!showIconsWhenCollapsed)}
                        className={clsx(
                            "w-10 h-5 rounded-full transition-colors relative shrink-0",
                            showIconsWhenCollapsed ? "bg-[var(--accent-color)]" : "bg-gray-300 dark:bg-gray-700"
                        )}
                    >
                        <div className={clsx(
                            "absolute top-1 w-3 h-3 rounded-full bg-white transition-transform",
                            showIconsWhenCollapsed ? "translate-x-6" : "translate-x-1"
                        )} />
                    </button>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="min-w-0 flex-1">
                        <div className="font-semibold text-[var(--text-main)] truncate">{t('settings.appearance.showNoteCounts')}</div>
                        <div className="text-[11px] text-[var(--text-muted)] leading-relaxed">{t('settings.appearance.showNoteCountsDesc')}</div>
                    </div>
                    <button
                        type="button"
                        onClick={() => onToggleShowNoteCounts?.(!showNoteCounts)}
                        className={clsx(
                            "w-10 h-5 rounded-full transition-colors relative shrink-0",
                            showNoteCounts ? "bg-[var(--accent-color)]" : "bg-gray-300 dark:bg-gray-700"
                        )}
                        title={t('settings.appearance.showNoteCounts')}
                    >
                        <div className={clsx(
                            "absolute top-1 w-3 h-3 rounded-full bg-white transition-transform",
                            showNoteCounts ? "translate-x-6" : "translate-x-1"
                        )} />
                    </button>
                </div>
            </div>

            {/* Typography Configuration */}
            <TypographySelector
                fontFamily={fontFamily}
                setFontFamily={setFontFamily}
                fontSize={fontSize}
                setFontSize={setFontSize}
            />
        </div>
    );
}


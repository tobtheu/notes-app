import React from 'react';
import clsx from 'clsx';
import type { Theme, ThemeOrigin } from '../hooks/useTheme';
import { useTranslation } from '../i18n';

interface ThemeSelectorProps {
    theme: Theme;
    setTheme: (theme: Theme, origin?: ThemeOrigin) => void;
    autoTheme?: boolean;
    onToggleAutoTheme?: (enabled: boolean) => void;
    preferredLightTheme?: 'clay' | 'sage';
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
    theme,
    setTheme,
    autoTheme = false,
    onToggleAutoTheme,
    preferredLightTheme = 'clay',
}) => {
    const { t } = useTranslation();

    return (
        <div>
            <label className="block font-semibold text-[var(--text-main)] mb-2.5">{t('settings.appearance.theme')}</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                {/* 1. Clay & Oatmeal (Default) */}
                <button
                    type="button"
                    onClick={(e) => setTheme('clay', { x: e.clientX, y: e.clientY })}
                    className={clsx(
                        "smooth-transition flex flex-col p-2.5 sm:p-3 rounded-2xl border text-left active:scale-98 min-w-0 overflow-hidden relative",
                        theme === 'clay'
                            ? "border-[var(--accent-color)] ring-2 ring-[var(--accent-color)]/30 bg-[#EDE9E2] text-[#262422] shadow-sm"
                            : "border-[var(--border-subtle)] hover:border-gray-500/40 bg-[#EDE9E2]/90 text-gray-700"
                    )}
                >
                    <div className="flex items-center gap-2 mb-1 min-w-0">
                        <span className="w-3.5 h-3.5 rounded-full bg-[#7D6B5D] shrink-0" />
                        <span className="font-bold text-xs text-[#262422] truncate">Clay & Oatmeal</span>
                    </div>
                    <div className="text-[10px] text-[#79736D] truncate">
                        {autoTheme && preferredLightTheme === 'clay' ? 'Muted Warm (Active for Light)' : 'Muted Warm Earth (Default)'}
                    </div>
                </button>

                {/* 2. Sage Green */}
                <button
                    type="button"
                    onClick={(e) => setTheme('sage', { x: e.clientX, y: e.clientY })}
                    className={clsx(
                        "smooth-transition flex flex-col p-2.5 sm:p-3 rounded-2xl border text-left active:scale-98 min-w-0 overflow-hidden relative",
                        theme === 'sage'
                            ? "border-[var(--accent-color)] ring-2 ring-[var(--accent-color)]/30 bg-[#E8ECE6] text-[#242B24] shadow-sm"
                            : "border-[var(--border-subtle)] hover:border-gray-500/40 bg-[#E8ECE6]/90 text-gray-700"
                    )}
                >
                    <div className="flex items-center gap-2 mb-1 min-w-0">
                        <span className="w-3.5 h-3.5 rounded-full bg-[#5D6D5D] shrink-0" />
                        <span className="font-bold text-xs text-[#242B24] truncate">Sage Green</span>
                    </div>
                    <div className="text-[10px] text-[#707A70] truncate">
                        {autoTheme && preferredLightTheme === 'sage' ? 'Botanical (Active for Light)' : 'Botanical Earth'}
                    </div>
                </button>

                {/* 3. Dark Mode */}
                <button
                    type="button"
                    onClick={(e) => setTheme('dark', { x: e.clientX, y: e.clientY })}
                    className={clsx(
                        "smooth-transition flex flex-col p-2.5 sm:p-3 rounded-2xl border text-left active:scale-98 min-w-0 overflow-hidden",
                        theme === 'dark'
                            ? "border-[var(--accent-color)] ring-2 ring-[var(--accent-color)]/30 bg-[#222221] text-white shadow-sm"
                            : "border-[var(--border-subtle)] hover:border-gray-500/40 bg-[#222221]/90 text-gray-300"
                    )}
                >
                    <div className="flex items-center gap-2 mb-1 min-w-0">
                        <span className="w-3.5 h-3.5 rounded-full bg-[#1A1A19] border border-[#E5484D] shrink-0" />
                        <span className="font-bold text-xs text-[#D8D5CF] truncate">{t('settings.appearance.dark')}</span>
                    </div>
                    <div className="text-[10px] text-[#7E7A73] truncate">Charcoal & Crimson</div>
                </button>
            </div>

            {/* Auto Switch */}
            <div className="flex items-center justify-between gap-3 pt-2">
                <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[var(--text-main)] truncate">{t('settings.appearance.autoTheme')}</div>
                    <div className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                        {t('settings.appearance.autoThemeDesc')}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => onToggleAutoTheme?.(!autoTheme)}
                    className={clsx(
                        "w-10 h-5 rounded-full transition-colors relative shrink-0",
                        autoTheme ? "bg-[var(--accent-color)]" : "bg-gray-300 dark:bg-gray-700"
                    )}
                    title={t('settings.appearance.autoTheme')}
                >
                    <div className={clsx(
                        "absolute top-1 w-3 h-3 rounded-full bg-white transition-transform",
                        autoTheme ? "translate-x-6" : "translate-x-1"
                    )} />
                </button>
            </div>
        </div>
    );
};


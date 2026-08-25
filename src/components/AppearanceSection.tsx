import clsx from 'clsx';
import type { Theme, ThemeOrigin } from '../hooks/useTheme';
import { ThemeSelector } from './ThemeSelector';
import { TypographySelector, type FontFamily, type FontSize } from './TypographySelector';

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
    setFontSize
}: AppearanceSectionProps) {
    return (
        <div className="space-y-6 text-xs select-none pb-6">
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
                        <div className="font-semibold text-[var(--text-main)] truncate">Monochrome Sidebar Icons</div>
                        <div className="text-[11px] text-[var(--text-muted)] leading-relaxed">Display neutral icons matching active theme</div>
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
                        <div className="font-semibold text-[var(--text-main)] truncate">Icons bei eingeklappter Sidebar</div>
                        <div className="text-[11px] text-[var(--text-muted)] leading-relaxed">Ordner-Icons anzeigen wenn Sidebar eingeklappt ist (sonst ausblenden)</div>
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
                        <div className="font-semibold text-[var(--text-main)] truncate">Notizen-Anzahl neben Ordnern</div>
                        <div className="text-[11px] text-[var(--text-muted)] leading-relaxed">Anzahl der Notizen neben den Ordnern und 'Alle Notizen' anzeigen</div>
                    </div>
                    <button
                        type="button"
                        onClick={() => onToggleShowNoteCounts?.(!showNoteCounts)}
                        className={clsx(
                            "w-10 h-5 rounded-full transition-colors relative shrink-0",
                            showNoteCounts ? "bg-[var(--accent-color)]" : "bg-gray-300 dark:bg-gray-700"
                        )}
                        title="Notizen-Anzahl umschalten"
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

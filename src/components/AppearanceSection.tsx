import clsx from 'clsx';
import type { Theme, ThemeOrigin } from '../hooks/useTheme';

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
    fontFamily: 'inter' | 'roboto' | 'courier' | 'sfmono' | 'serif' | 'system';
    setFontFamily: (fontFamily: 'inter' | 'roboto' | 'courier' | 'sfmono' | 'serif' | 'system') => void;
    fontSize: 'small' | 'medium' | 'large';
    setFontSize: (fontSize: 'small' | 'medium' | 'large') => void;
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
            <div>
                <label className="block font-semibold text-[var(--text-main)] mb-2.5">Theme Selection</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                    {/* 1. Clay & Oatmeal (Default) */}
                    <button
                        type="button"
                        onClick={(e) => setTheme('clay', e)}
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
                            {autoTheme && preferredLightTheme === 'clay' ? 'Muted Warm (Aktiviert für Light)' : 'Muted Warm Earth (Standard)'}
                        </div>
                    </button>

                    {/* 2. Sage Green */}
                    <button
                        type="button"
                        onClick={(e) => setTheme('sage', e)}
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
                            {autoTheme && preferredLightTheme === 'sage' ? 'Botanical (Aktiviert für Light)' : 'Botanical Earth'}
                        </div>
                    </button>

                    {/* 3. Dark Mode */}
                    <button
                        type="button"
                        onClick={(e) => setTheme('dark', e)}
                        className={clsx(
                            "smooth-transition flex flex-col p-2.5 sm:p-3 rounded-2xl border text-left active:scale-98 min-w-0 overflow-hidden",
                            theme === 'dark'
                                ? "border-[var(--accent-color)] ring-2 ring-[var(--accent-color)]/30 bg-[#222221] text-white shadow-sm"
                                : "border-[var(--border-subtle)] hover:border-gray-500/40 bg-[#222221]/90 text-gray-300"
                        )}
                    >
                        <div className="flex items-center gap-2 mb-1 min-w-0">
                            <span className="w-3.5 h-3.5 rounded-full bg-[#1A1A19] border border-[#E5484D] shrink-0" />
                            <span className="font-bold text-xs text-[#D8D5CF] truncate">Dark Mode</span>
                        </div>
                        <div className="text-[10px] text-[#7E7A73] truncate">Charcoal & Crimson</div>
                    </button>
                </div>

                {/* Auto Switch */}
                <div className="flex items-center justify-between gap-3 pt-2">
                    <div className="min-w-0 flex-1">
                        <div className="font-semibold text-[var(--text-main)] truncate">Automatisches Umschalten (System)</div>
                        <div className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                            Wechselt automatisch zwischen Dark Mode und deinem gewählten Light-Theme ({preferredLightTheme === 'sage' ? 'Sage Green' : 'Clay & Oatmeal'})
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => onToggleAutoTheme?.(!autoTheme)}
                        className={clsx(
                            "w-10 h-5 rounded-full transition-colors relative shrink-0",
                            autoTheme ? "bg-[var(--accent-color)]" : "bg-gray-300 dark:bg-gray-700"
                        )}
                        title="Automatisches Umschalten"
                    >
                        <div className={clsx(
                            "absolute top-1 w-3 h-3 rounded-full bg-white transition-transform",
                            autoTheme ? "translate-x-6" : "translate-x-1"
                        )} />
                    </button>
                </div>
            </div>

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
            <div className="pt-3 border-t border-[var(--border-subtle)]">
                <label className="block font-semibold text-[var(--text-main)] mb-2">Editor Typography</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 mb-4">
                    <button
                        type="button"
                        onClick={() => setFontFamily('inter')}
                        className={clsx(
                            "p-2 sm:p-2.5 rounded-xl text-center text-xs font-inter transition-all border min-w-0 truncate",
                            fontFamily === 'inter'
                                ? "border-[var(--accent-color)] bg-[var(--card-active)] text-[var(--accent-color)] font-semibold shadow-sm"
                                : "border-transparent bg-[var(--card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
                        )}
                    >
                        Inter
                    </button>
                    <button
                        type="button"
                        onClick={() => setFontFamily('roboto')}
                        className={clsx(
                            "p-2 sm:p-2.5 rounded-xl text-center text-xs font-roboto transition-all border min-w-0 truncate",
                            fontFamily === 'roboto'
                                ? "border-[var(--accent-color)] bg-[var(--card-active)] text-[var(--accent-color)] font-semibold shadow-sm"
                                : "border-transparent bg-[var(--card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
                        )}
                    >
                        Roboto
                    </button>
                    <button
                        type="button"
                        onClick={() => setFontFamily('courier')}
                        className={clsx(
                            "p-2 sm:p-2.5 rounded-xl text-center text-xs font-courier transition-all border min-w-0 truncate",
                            fontFamily === 'courier'
                                ? "border-[var(--accent-color)] bg-[var(--card-active)] text-[var(--accent-color)] font-semibold shadow-sm"
                                : "border-transparent bg-[var(--card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
                        )}
                    >
                        Courier New
                    </button>
                    <button
                        type="button"
                        onClick={() => setFontFamily('sfmono')}
                        className={clsx(
                            "p-2 sm:p-2.5 rounded-xl text-center text-xs font-sfmono transition-all border min-w-0 truncate",
                            fontFamily === 'sfmono'
                                ? "border-[var(--accent-color)] bg-[var(--card-active)] text-[var(--accent-color)] font-semibold shadow-sm"
                                : "border-transparent bg-[var(--card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
                        )}
                    >
                        SF Mono
                    </button>
                    <button
                        type="button"
                        onClick={() => setFontFamily('serif')}
                        className={clsx(
                            "p-2 sm:p-2.5 rounded-xl text-center text-xs font-serif transition-all border min-w-0 truncate",
                            fontFamily === 'serif'
                                ? "border-[var(--accent-color)] bg-[var(--card-active)] text-[var(--accent-color)] font-semibold shadow-sm"
                                : "border-transparent bg-[var(--card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
                        )}
                    >
                        Newsreader
                    </button>
                </div>

                {/* Font Size Selection */}
                <label className="block font-semibold text-[var(--text-main)] mb-2">Font Size</label>
                <div className="flex items-center gap-1.5 p-1 bg-[var(--card-hover)] rounded-xl border border-[var(--border-subtle)]">
                    <button
                        type="button"
                        onClick={() => setFontSize('small')}
                        className={clsx(
                            "flex-1 py-1.5 px-2.5 rounded-lg transition-all text-xs min-w-0 truncate",
                            fontSize === 'small' ? "bg-[var(--canvas-bg)] shadow-sm font-semibold text-[var(--text-main)]" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                        )}
                    >
                        Small
                    </button>
                    <button
                        type="button"
                        onClick={() => setFontSize('medium')}
                        className={clsx(
                            "flex-1 py-1.5 px-2.5 rounded-lg transition-all text-xs min-w-0 truncate",
                            fontSize === 'medium' ? "bg-[var(--canvas-bg)] shadow-sm font-semibold text-[var(--text-main)]" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                        )}
                    >
                        Medium
                    </button>
                    <button
                        type="button"
                        onClick={() => setFontSize('large')}
                        className={clsx(
                            "flex-1 py-1.5 px-2.5 rounded-lg transition-all text-xs min-w-0 truncate",
                            fontSize === 'large' ? "bg-[var(--canvas-bg)] shadow-sm font-semibold text-[var(--text-main)]" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                        )}
                    >
                        Large
                    </button>
                </div>
            </div>
        </div>
    );
}

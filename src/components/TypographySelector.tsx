import React from 'react';
import clsx from 'clsx';

export type FontFamily = 'inter' | 'roboto' | 'courier' | 'sfmono' | 'serif' | 'system';
export type FontSize = 'small' | 'medium' | 'large';

interface TypographySelectorProps {
    fontFamily: FontFamily;
    setFontFamily: (fontFamily: FontFamily) => void;
    fontSize: FontSize;
    setFontSize: (fontSize: FontSize) => void;
}

export const TypographySelector: React.FC<TypographySelectorProps> = ({
    fontFamily,
    setFontFamily,
    fontSize,
    setFontSize,
}) => {
    return (
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
    );
};

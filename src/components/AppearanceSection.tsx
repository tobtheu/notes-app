import React from 'react';
import { Sun, Moon, Monitor, Palette } from 'lucide-react';
import clsx from 'clsx';

interface AppearanceSectionProps {
    theme: 'light' | 'dark' | 'system';
    setTheme: (theme: 'light' | 'dark' | 'system') => void;
    accentColor: string;
    setAccentColor: (color: string) => void;
    monochromeIcons: boolean;
    onToggleMonochromeIcons: (v: boolean) => void;
    fontFamily: 'inter' | 'roboto' | 'system';
    setFontFamily: (fontFamily: 'inter' | 'roboto' | 'system') => void;
    fontSize: 'small' | 'medium' | 'large';
    setFontSize: (fontSize: 'small' | 'medium' | 'large') => void;
}

export function AppearanceSection({
    theme,
    setTheme,
    accentColor,
    setAccentColor,
    monochromeIcons,
    onToggleMonochromeIcons,
    fontFamily,
    setFontFamily,
    fontSize,
    setFontSize
}: AppearanceSectionProps) {
    return (
        <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Appearance</h3>

            {/* Theme Configuration */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                <button
                    onClick={() => setTheme('light')}
                    className={clsx(
                        "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all",
                        theme === 'light'
                            ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                            : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                    )}
                >
                    <Sun size={20} />
                    <span className="text-xs font-medium">Light</span>
                </button>
                <button
                    onClick={() => setTheme('dark')}
                    className={clsx(
                        "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all",
                        theme === 'dark'
                            ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                            : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                    )}
                >
                    <Moon size={20} />
                    <span className="text-xs font-medium">Dark</span>
                </button>
                <button
                    onClick={() => setTheme('system')}
                    className={clsx(
                        "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all",
                        theme === 'system'
                            ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                            : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                    )}
                >
                    <Monitor size={20} />
                    <span className="text-xs font-medium">System</span>
                </button>
            </div>

            {/* Accent Color Selection */}
            <div className="mb-6">
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">Accent Color</h4>
                <div className="flex items-center gap-3 px-3 py-1 -mx-1 mb-4">
                    {([
                        ['blue', '#3b82f6'],
                        ['purple', '#a855f7'],
                        ['green', '#59FFA0'],
                        ['red', '#ef4444'],
                        ['orange', '#f97316'],
                        ['jasmine', '#FFD972'],
                        ['periwinkle', '#B4ADEA'],
                        ['watermelon', '#E84855'],
                    ] as [string, string][]).map(([color, hex]) => (
                        <button
                            key={color}
                            onClick={() => setAccentColor(color)}
                            data-accent={color}
                            className={clsx(
                                "w-8 h-8 rounded-full flex items-center justify-center transition-all ring-offset-2 dark:ring-offset-gray-800",
                                accentColor === color ? "ring-2 ring-gray-400 dark:ring-gray-400 scale-110" : "hover:scale-110"
                            )}
                            style={{ backgroundColor: hex }}
                            title={color.charAt(0).toUpperCase() + color.slice(1)}
                        >
                            {accentColor === color && (
                                <div className="w-2.5 h-2.5 bg-white rounded-full shadow-sm" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Premium Themes Selection */}
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400">Premium Themes</h4>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 uppercase tracking-wider">Pro</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {([
                            ['terracotta', '#8c4a4a', '#f2ebe1', 'Terracotta'],
                            ['sage', '#5d6d5d', '#ecebe4', 'Sage & Stone'],
                            ['indigo', '#3f4d71', '#f1f1f1', 'Lava & Indigo'],
                        ] as [string, string, string, string][]).map(([color, primary, bg, label]) => (
                            <button
                                key={color}
                                onClick={() => setAccentColor(color)}
                                className={clsx(
                                    "relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all overflow-hidden group",
                                    accentColor === color
                                        ? "border-[var(--primary-500)] shadow-md shadow-[var(--primary-500)]/20"
                                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm"
                                )}
                                style={{ backgroundColor: theme === 'dark' ? '#111' : bg }}
                            >
                                <div
                                    className="w-10 h-10 rounded-full mb-2 flex items-center justify-center shadow-sm"
                                    style={{ backgroundColor: primary }}
                                >
                                    {accentColor === color && <div className="w-3 h-3 bg-white rounded-full" />}
                                </div>
                                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                    {label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Monochrome Icons Toggle */}
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-500">
                            <Palette size={16} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Monochrome Sidebar Icons</span>
                        </div>
                    </div>
                    <button
                        onClick={() => onToggleMonochromeIcons(!monochromeIcons)}
                        className={clsx(
                            "w-10 h-5 rounded-full transition-colors relative",
                            monochromeIcons ? "bg-primary-600" : "bg-gray-200 dark:bg-gray-700"
                        )}
                    >
                        <div className={clsx(
                            "absolute top-1 w-3 h-3 rounded-full bg-white transition-transform",
                            monochromeIcons ? "translate-x-6" : "translate-x-1"
                        )} />
                    </button>
                </div>
            </div>

            {/* Typography Configuration */}
            <div className="mt-6">
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">Typography</h4>

                {/* Font Family Selection */}
                <div className="flex items-center gap-2 mb-4 p-1 bg-gray-100 dark:bg-gray-900/50 rounded-lg">
                    <button
                        onClick={() => setFontFamily('system')}
                        className={clsx(
                            "flex-1 text-xs font-medium py-1.5 px-3 rounded-md transition-all",
                            fontFamily === 'system' ? "bg-white dark:bg-gray-800 shadow text-gray-800 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        )}
                        style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
                    >
                        System
                    </button>
                    <button
                        onClick={() => setFontFamily('inter')}
                        className={clsx(
                            "flex-1 text-xs font-medium py-1.5 px-3 rounded-md transition-all",
                            fontFamily === 'inter' ? "bg-white dark:bg-gray-800 shadow text-gray-800 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        )}
                        style={{ fontFamily: "'Inter', sans-serif" }}
                    >
                        Inter
                    </button>
                    <button
                        onClick={() => setFontFamily('roboto')}
                        className={clsx(
                            "flex-1 text-xs font-medium py-1.5 px-3 rounded-md transition-all",
                            fontFamily === 'roboto' ? "bg-white dark:bg-gray-800 shadow text-gray-800 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        )}
                        style={{ fontFamily: "'Roboto', sans-serif" }}
                    >
                        Roboto
                    </button>
                </div>

                {/* Font Size Selection */}
                <div className="flex items-center gap-2 p-1 bg-gray-100 dark:bg-gray-900/50 rounded-lg">
                    <button
                        onClick={() => setFontSize('small')}
                        className={clsx(
                            "flex-1 py-1.5 px-3 rounded-md transition-all flex items-center justify-center",
                            fontSize === 'small' ? "bg-white dark:bg-gray-800 shadow text-gray-800 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        )}
                        title="Small Text"
                    >
                        <span className="text-[12px] font-medium leading-none">Small</span>
                    </button>
                    <button
                        onClick={() => setFontSize('medium')}
                        className={clsx(
                            "flex-1 py-1.5 px-3 rounded-md transition-all flex items-center justify-center",
                            fontSize === 'medium' ? "bg-white dark:bg-gray-800 shadow text-gray-800 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        )}
                        title="Medium Text"
                    >
                        <span className="font-medium text-[14px] leading-none">Medium</span>
                    </button>
                    <button
                        onClick={() => setFontSize('large')}
                        className={clsx(
                            "flex-1 py-1.5 px-3 rounded-md transition-all flex items-center justify-center",
                            fontSize === 'large' ? "bg-white dark:bg-gray-800 shadow text-gray-800 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        )}
                        title="Large Text"
                    >
                        <span className="font-medium text-[16px] leading-none">Large</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

import { X, Moon, Sun, Monitor, FolderOpen } from 'lucide-react';
import clsx from 'clsx';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentPath: string | null;
    onChangePath: () => void;
    theme: 'light' | 'dark' | 'system';
    setTheme: (theme: 'light' | 'dark' | 'system') => void;
    markdownEnabled: boolean;
    onToggleMarkdown: (enabled: boolean) => void;
    accentColor: string;
    setAccentColor: (color: string) => void;
}

export function SettingsModal({
    isOpen,
    onClose,
    currentPath,
    onChangePath,
    theme,
    setTheme,
    markdownEnabled,
    onToggleMarkdown,
    accentColor,
    setAccentColor
}: SettingsModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6 relative animate-in fade-in zoom-in duration-200">
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                    <X size={20} />
                </button>

                <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Settings</h2>

                {/* Storage Path */}
                <div className="mb-8">
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Storage</h3>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-500 mb-1">Current Folder</p>
                        <p className="font-mono text-sm text-gray-700 dark:text-gray-300 break-all mb-3">
                            {currentPath || 'Not selected'}
                        </p>
                        <button
                            onClick={onChangePath}
                            className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                        >
                            <FolderOpen size={16} />
                            Change Location
                        </button>
                    </div>
                </div>

                {/* Appearance */}
                <div>
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Appearance</h3>

                    {/* Theme Toggle */}
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

                    {/* Accent Color */}
                    <div>
                        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">Accent Color</h4>
                        <div className="flex items-center gap-3">
                            {['blue', 'purple', 'green', 'red', 'orange'].map((color) => (
                                <button
                                    key={color}
                                    onClick={() => setAccentColor(color)}
                                    className={clsx(
                                        "w-8 h-8 rounded-full flex items-center justify-center transition-all ring-offset-2 dark:ring-offset-gray-800",
                                        accentColor === color ? "ring-2 ring-gray-400 dark:ring-gray-400 scale-110" : "hover:scale-110"
                                    )}
                                    style={{
                                        backgroundColor: `var(--color-primary-500)`,
                                        // We need to map color names to hardcoded values for the picker itself 
                                        // or temporarily set the explicit color for the button
                                        // actually we can just use tailwind classes if we had them or inline styles
                                        // Using specific colors for the picker buttons:
                                        background: color === 'blue' ? '#3b82f6' :
                                            color === 'purple' ? '#a855f7' :
                                                color === 'green' ? '#22c55e' :
                                                    color === 'red' ? '#ef4444' :
                                                        '#f97316'
                                    }}
                                    title={color.charAt(0).toUpperCase() + color.slice(1)}
                                >
                                    {accentColor === color && (
                                        <div className="w-2.5 h-2.5 bg-white rounded-full shadow-sm" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>


                {/* Editor Settings */}
                <div className="mt-8 border-t border-gray-100 dark:border-gray-700 pt-6">
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Editor</h3>
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Markdown Formatting</span>
                            <span className="text-xs text-gray-500">Live preview and auto-formatting</span>
                        </div>
                        <button
                            onClick={() => onToggleMarkdown(!markdownEnabled)}
                            className={clsx(
                                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                                markdownEnabled ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-700"
                            )}
                        >
                            <span
                                className={clsx(
                                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                    markdownEnabled ? "translate-x-6" : "translate-x-1"
                                )}
                            />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

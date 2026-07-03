import React from 'react';
import clsx from 'clsx';

interface EditorSectionProps {
    markdownEnabled: boolean;
    onToggleMarkdown: (enabled: boolean) => void;
    spellcheckEnabled: boolean;
    onToggleSpellcheck: (enabled: boolean) => void;
    isIOS?: boolean;
    landscapeFullscreen?: boolean;
    onToggleLandscapeFullscreen?: (enabled: boolean) => void;
}

export function EditorSection({
    markdownEnabled,
    onToggleMarkdown,
    spellcheckEnabled,
    onToggleSpellcheck,
    isIOS = false,
    landscapeFullscreen = false,
    onToggleLandscapeFullscreen
}: EditorSectionProps) {
    return (
        <div className="mt-8 border-t border-gray-100 dark:border-gray-700 pt-6">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Editor</h3>

            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg mb-3">
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Markdown Formatting</span>
                    <span className="text-xs text-gray-500">Live preview and auto-formatting</span>
                </div>
                <button
                    onClick={() => onToggleMarkdown(!markdownEnabled)}
                    className={clsx(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                        markdownEnabled ? "bg-primary-600" : "bg-gray-300 dark:bg-gray-700"
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

            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Spellcheck</span>
                    <span className="text-xs text-gray-500">Enable Windows spellcheck lines</span>
                </div>
                <button
                    onClick={() => onToggleSpellcheck(!spellcheckEnabled)}
                    className={clsx(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                        spellcheckEnabled ? "bg-primary-600" : "bg-gray-300 dark:bg-gray-700"
                    )}
                >
                    <span
                        className={clsx(
                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                            spellcheckEnabled ? "translate-x-6" : "translate-x-1"
                        )}
                    />
                </button>
            </div>

            {/* Landscape Fullscreen — iOS only */}
            {isIOS && (
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg mt-3">
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Landscape Fullscreen</span>
                        <span className="text-xs text-gray-500">Note in landscape mode across the full screen</span>
                    </div>
                    <button
                        type="button"
                        title={landscapeFullscreen ? "Disable landscape fullscreen" : "Enable landscape fullscreen"}
                        onClick={() => onToggleLandscapeFullscreen?.(!landscapeFullscreen)}
                        className={clsx(
                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                            landscapeFullscreen ? "bg-primary-600" : "bg-gray-300 dark:bg-gray-700"
                        )}
                    >
                        <span className={clsx(
                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                            landscapeFullscreen ? "translate-x-6" : "translate-x-1"
                        )} />
                    </button>
                </div>
            )}
        </div>
    );
}

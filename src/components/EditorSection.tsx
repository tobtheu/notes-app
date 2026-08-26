import clsx from 'clsx';
import { useTranslation } from '../i18n';

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
    const { t } = useTranslation();

    return (
        <div className="space-y-6 text-xs select-none pb-6">
            {/* Formatting Tools Section */}
            <div>
                <label className="block font-semibold text-[var(--text-main)] mb-2.5">{t('settings.tabs.editor')}</label>
                <div className="space-y-3">
                    {/* Markdown Formatting Toggle */}
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <div className="font-semibold text-[var(--text-main)] truncate">{t('settings.editorSection.markdownShortcuts')}</div>
                            <div className="text-[11px] text-[var(--text-muted)] leading-relaxed">{t('settings.editorSection.markdownShortcutsDesc')}</div>
                        </div>
                        <button
                            type="button"
                            onClick={() => onToggleMarkdown(!markdownEnabled)}
                            className={clsx(
                                "w-10 h-5 rounded-full transition-colors relative shrink-0",
                                markdownEnabled ? "bg-[var(--accent-color)]" : "bg-gray-300 dark:bg-gray-700"
                            )}
                        >
                            <div className={clsx(
                                "absolute top-1 w-3 h-3 rounded-full bg-white transition-transform",
                                markdownEnabled ? "translate-x-6" : "translate-x-1"
                            )} />
                        </button>
                    </div>

                    {/* Spellcheck Toggle */}
                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--border-subtle)]">
                        <div className="min-w-0 flex-1">
                            <div className="font-semibold text-[var(--text-main)] truncate">{t('settings.editorSection.spellcheck')}</div>
                            <div className="text-[11px] text-[var(--text-muted)] leading-relaxed">{t('settings.editorSection.spellcheckDesc')}</div>
                        </div>
                        <button
                            type="button"
                            onClick={() => onToggleSpellcheck(!spellcheckEnabled)}
                            className={clsx(
                                "w-10 h-5 rounded-full transition-colors relative shrink-0",
                                spellcheckEnabled ? "bg-[var(--accent-color)]" : "bg-gray-300 dark:bg-gray-700"
                            )}
                        >
                            <div className={clsx(
                                "absolute top-1 w-3 h-3 rounded-full bg-white transition-transform",
                                spellcheckEnabled ? "translate-x-6" : "translate-x-1"
                            )} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Display & Layout (iOS only) */}
            {isIOS && (
                <div className="pt-3 border-t border-[var(--border-subtle)] space-y-3">
                    <label className="block font-semibold text-[var(--text-main)] mb-1">{t('settings.editorSection.landscapeFullscreen')}</label>
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <div className="font-semibold text-[var(--text-main)] truncate">{t('settings.editorSection.landscapeFullscreen')}</div>
                            <div className="text-[11px] text-[var(--text-muted)] leading-relaxed">{t('settings.editorSection.landscapeFullscreenDesc')}</div>
                        </div>
                        <button
                            type="button"
                            onClick={() => onToggleLandscapeFullscreen?.(!landscapeFullscreen)}
                            className={clsx(
                                "w-10 h-5 rounded-full transition-colors relative shrink-0",
                                landscapeFullscreen ? "bg-[var(--accent-color)]" : "bg-gray-300 dark:bg-gray-700"
                            )}
                        >
                            <div className={clsx(
                                "absolute top-1 w-3 h-3 rounded-full bg-white transition-transform",
                                landscapeFullscreen ? "translate-x-6" : "translate-x-1"
                            )} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}


import React from 'react';
import { X, Link as LinkIcon, Globe, Type } from 'lucide-react';
import clsx from 'clsx';
import { useUrlInputModal } from '../hooks/useUrlInputModal';
import { useTranslation } from '../i18n';

interface UrlInputModalProps {
    isOpen: boolean;
    type?: 'link';
    initialUrl?: string;
    initialText?: string;
    onClose: () => void;
    onSave: (url: string, text?: string) => void;
    isIOS?: boolean;
}

/**
 * UrlInputModal
 * A clean, minimalist modal for inserting and editing external hyperlinks.
 */
export const UrlInputModal: React.FC<UrlInputModalProps> = (props) => {
    const { isOpen, onClose, isIOS = false } = props;
    const { t } = useTranslation();

    const {
        url,
        setUrl,
        text,
        setText,
        inputRef,
        handleSubmit,
    } = useUrlInputModal(props);

    if (!isOpen) return null;

    return (
        <div
            className={clsx(
                "fixed inset-0 z-[10000] flex p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200",
                isIOS ? "items-start justify-center" : "items-center justify-center"
            )}
            style={isIOS ? { paddingTop: 'max(env(safe-area-inset-top, 0px), 32px)' } : undefined}
            onClick={onClose}
        >
            <div
                className="rounded-3xl w-full max-w-md border border-[var(--border-subtle)] shadow-2xl overflow-hidden animate-modal-spring flex flex-col text-xs select-none relative"
                onClick={e => e.stopPropagation()}
                style={{ backgroundColor: 'var(--canvas-bg)' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] shrink-0 bg-[var(--canvas-bg)]">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-black/5 dark:bg-white/5">
                            <LinkIcon size={15} className="text-[var(--accent-color)]" />
                        </div>
                        <h2 className="text-sm font-bold text-[var(--text-main)]">{t('modals.insertLink')}</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col">
                    <div className="p-5 space-y-4">
                        {/* URL Input (Primary) */}
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                                <Globe size={12} /> {t('modals.linkUrl')}
                            </label>
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="https://example.com"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                className="smooth-transition w-full px-3 py-2 bg-[var(--card-hover)] border border-transparent focus:border-[var(--border-subtle)] rounded-xl outline-none text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:ring-1 focus:ring-[var(--accent-color)]/30 font-mono"
                                autoFocus
                            />
                        </div>

                        {/* Link Text Input */}
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                                <Type size={12} /> {t('modals.linkText')}
                            </label>
                            <input
                                type="text"
                                placeholder={t('modals.linkTextPlaceholder')}
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                className="smooth-transition w-full px-3 py-2 bg-[var(--card-hover)] border border-transparent focus:border-[var(--border-subtle)] rounded-xl outline-none text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:ring-1 focus:ring-[var(--accent-color)]/30"
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-3 border-t border-[var(--border-subtle)] flex justify-end shrink-0 bg-[var(--canvas-bg)]">
                        <button
                            type="submit"
                            className="smooth-transition px-4 py-1.5 text-xs font-semibold text-white bg-[var(--accent-color)] hover:opacity-90 rounded-xl shadow-sm active:scale-95 transition-all"
                        >
                            {t('common.save')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


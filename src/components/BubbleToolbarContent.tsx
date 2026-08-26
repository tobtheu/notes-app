import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import { ExternalLink, Edit2, Trash2, Link as LinkIcon } from 'lucide-react';
import { toggleSmartMark } from '../utils/editor';
import { useTranslation } from '../i18n';

interface BubbleToolbarContentProps {
    editor: any;
    onLinkClick: (url?: string, text?: string) => void;
    onRemoveLink?: () => void;
    hoveredLink?: { href: string; pos: number; rect: DOMRect } | null;
    onNavigate?: (id: string, anchor?: string) => void;
}

export const BubbleToolbarContent: React.FC<BubbleToolbarContentProps> = ({
    editor,
    onLinkClick,
    onRemoveLink,
    hoveredLink,
    onNavigate
}) => {
    const { t } = useTranslation();
    // Add a local state to force re-renders when the editor state changes
    const [, setUpdateCount] = useState(0);

    useEffect(() => {
        if (!editor) return;

        let rafId: number | null = null;
        const updateHandler = () => {
            if (rafId !== null) return;
            rafId = requestAnimationFrame(() => {
                rafId = null;
                setUpdateCount(prev => prev + 1);
            });
        };

        editor.on('transaction', updateHandler);

        return () => {
            editor.off('transaction', updateHandler);
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
            }
        };
    }, [editor]);

    // Show link actions if hovering or selection is purely a link
    const isLinkActive = hoveredLink || (editor.isActive('link') && editor.state.selection.empty);

    return (
        <div className="bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 rounded-lg p-1 flex items-center gap-1">
            <button
                onClick={() => toggleSmartMark(editor, 'bold')}
                className={clsx(
                    "p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors",
                    editor.isActive('bold') && "bg-primary-50 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400"
                )}
                title={t('editor.bold')}
            >
                <span className="font-bold text-sm">B</span>
            </button>
            <button
                onClick={() => toggleSmartMark(editor, 'italic')}
                className={clsx(
                    "p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors",
                    editor.isActive('italic') && "bg-primary-50 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400"
                )}
                title={t('editor.italic')}
            >
                <span className="italic font-serif text-sm">I</span>
            </button>
            <button
                onClick={() => toggleSmartMark(editor, 'highlight')}
                className={clsx(
                    "p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors",
                    editor.isActive('highlight') && "bg-primary-50 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400"
                )}
                title={t('editor.highlight')}
            >
                <div className="w-3 h-3 bg-yellow-200 rounded-sm" />
            </button>

            {/* Link Specific Actions - On the right side */}
            {isLinkActive && (
                <>
                    <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            const href = hoveredLink?.href || editor.getAttributes('link').href;
                            if (href) {
                                if (href.startsWith('note://') || href.startsWith('id:')) {
                                    const cleanHref = href.replace('note://', '').replace('id:', '');
                                    const [id, anchor] = cleanHref.split('#');
                                    onNavigate?.(decodeURIComponent(id), anchor);
                                } else if (href.startsWith('#')) {
                                    onNavigate?.('', href.substring(1));
                                } else {
                                    try {
                                        const parsed = new URL(href);
                                        if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
                                            window.open(href, '_blank', 'noopener,noreferrer');
                                        } else {
                                            console.warn('Blocked link with unsafe protocol:', href);
                                        }
                                    } catch {
                                        console.warn('Invalid URL:', href);
                                    }
                                }
                            }
                        }}
                        className="p-1.5 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900/40 text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                        title={t('editor.openLink')}
                    >
                        <ExternalLink size={14} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            if (hoveredLink) {
                                editor.chain().focus().setTextSelection(hoveredLink.pos).run();
                            }
                            onLinkClick();
                        }}
                        className="p-1.5 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900/40 text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                        title={t('editor.editLink')}
                    >
                        <Edit2 size={14} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            if (hoveredLink) {
                                editor.chain().focus().setTextSelection(hoveredLink.pos).extendMarkRange('link').unsetLink().run();
                                if (onRemoveLink) {
                                    onRemoveLink();
                                }
                            } else {
                                editor.chain().focus().extendMarkRange('link').unsetLink().run();
                            }
                        }}
                        className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/40 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title={t('editor.removeLink')}
                    >
                        <Trash2 size={14} />
                    </button>
                </>
            )}
            {!isLinkActive && (
                <>
                    <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
                    <button
                        onClick={() => onLinkClick()}
                        className={clsx(
                            "p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors",
                            editor.isActive('link') && "bg-primary-50 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400"
                        )}
                        title={t('editor.addLink')}
                    >
                        <LinkIcon size={14} />
                    </button>
                </>
            )}
        </div>
    );
};

import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import { ExternalLink, Edit2, Trash2, Link as LinkIcon, Maximize, Settings } from 'lucide-react';
import { toggleSmartMark } from '../utils/editor';

interface BubbleToolbarContentProps {
    editor: any;
    onLinkClick: (url?: string, text?: string) => void;
    onRemoveLink?: () => void;
    hoveredLink?: { href: string; pos: number; rect: DOMRect } | null;
    onImageEdit?: () => void;
    onImagePreview?: () => void;
    onNavigate?: (id: string, anchor?: string) => void;
}

export const BubbleToolbarContent: React.FC<BubbleToolbarContentProps> = ({
    editor,
    onLinkClick,
    onRemoveLink,
    hoveredLink,
    onImageEdit,
    onImagePreview,
    onNavigate
}) => {
    // Add a local state to force re-renders when the editor state changes
    const [, setUpdateCount] = useState(0);

    useEffect(() => {
        if (!editor) return;

        // Use requestAnimationFrame to batch transaction updates.
        // Without this, BubbleMenu's internal plugin dispatches transactions
        // during re-render, creating a synchronous infinite loop.
        let rafId: number | null = null;
        const updateHandler = () => {
            if (rafId !== null) return; // Already scheduled for this frame
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
    const isImageActive = editor.isActive('image');

    return (
        <div className="bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 rounded-lg p-1 flex items-center gap-1">
            <button
                onClick={() => toggleSmartMark(editor, 'bold')}
                className={clsx(
                    "p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors",
                    editor.isActive('bold') && "bg-primary-50 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400"
                )}
                title="Bold"
            >
                <span className="font-bold text-sm">B</span>
            </button>
            <button
                onClick={() => toggleSmartMark(editor, 'italic')}
                className={clsx(
                    "p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors",
                    editor.isActive('italic') && "bg-primary-50 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400"
                )}
                title="Italic"
            >
                <span className="italic font-serif text-sm">I</span>
            </button>
            <button
                onClick={() => toggleSmartMark(editor, 'highlight')}
                className={clsx(
                    "p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors",
                    editor.isActive('highlight') && "bg-primary-50 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400"
                )}
                title="Highlight"
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
                                    window.open(href, '_blank');
                                }
                            }
                        }}
                        className="p-1.5 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900/40 text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                        title="Open Link"
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
                        title="Edit Link"
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
                        title="Remove Link"
                    >
                        <Trash2 size={14} />
                    </button>
                </>
            )}
            {!isLinkActive && !isImageActive && (
                <>
                    <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
                    <button
                        onClick={() => onLinkClick()}
                        className={clsx(
                            "p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors",
                            editor.isActive('link') && "bg-primary-50 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400"
                        )}
                        title="Add Link"
                    >
                        <LinkIcon size={14} />
                    </button>
                </>
            )}

            {/* Image Specific Actions */}
            {isImageActive && (
                <>
                    <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
                    <button
                        onClick={onImagePreview}
                        className="p-1.5 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900/40 text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                        title="Preview"
                    >
                        <Maximize size={14} />
                    </button>
                    <button
                        onClick={onImageEdit}
                        className="p-1.5 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900/40 text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                        title="Edit Details"
                    >
                        <Settings size={14} />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().deleteSelection().run()}
                        className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/40 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title="Delete Image"
                    >
                        <Trash2 size={14} />
                    </button>
                </>
            )}
        </div>
    );
};

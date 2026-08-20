import { forwardRef, useImperativeHandle, memo } from 'react';
import type { Note } from '../types';
import { EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import clsx from 'clsx';

import { EditorToolbar } from './EditorToolbar';
import { UrlInputModal } from './UrlInputModal';
import { BubbleToolbarContent } from './BubbleToolbarContent';
import { DropIndicator } from './DropIndicator';
import { useMarkdownEditor } from '../hooks/useMarkdownEditor';

export interface MarkdownEditorRef {
    focus: (position?: 'start' | 'end') => void;
}

interface MarkdownEditorProps {
    content: string;
    allNotes?: Note[];
    onChange: (markdown: string) => void;
    onNavigate?: (id: string, anchor?: string) => void;
    toolbarVisible?: boolean;
    spellcheckEnabled?: boolean;
    workspacePath: string;
    header?: React.ReactNode;
    isFocusMode?: boolean;
    iosLandscapeFullscreen?: boolean;
    onArrowUpAtStart?: () => void;
    onBlur?: () => void;
}

/**
 * MarkdownEditor Component
 * A feature-rich WYSIWYG editor powered by Tiptap.
 */
export const MarkdownEditor = memo(forwardRef<MarkdownEditorRef, MarkdownEditorProps>((props, ref) => {
    const {
        toolbarVisible = true,
        header,
        isFocusMode = false,
        iosLandscapeFullscreen = false,
        allNotes,
        onNavigate
    } = props;

    const {
        editor,
        isLinkModalOpen,
        setIsLinkModalOpen,
        linkModalData,
        hoveredLink,
        setHoveredLink,
        isScrolling,
        isIOS,
        keyboardHeight,
        isDragging,
        setIsDragging,
        scrollContainerRef,
        toolbarRef,
        clearHideTimeout,
        startHideTimeout,
        handleScroll,
        openLinkModal,
        saveLink,
    } = useMarkdownEditor(props);

    useImperativeHandle(ref, () => ({
        focus: (position?: 'start' | 'end') => {
            if (!editor) return;
            if (position === 'start') {
                editor.chain().focus().setTextSelection(1).run();
            } else if (position === 'end') {
                editor.chain().focus('end').run();
            } else {
                editor.chain().focus().run();
            }
        }
    }), [editor]);

    if (!editor) {
        return null;
    }

    return (
        <div
            className={clsx(
                "flex flex-col flex-1 w-full relative overflow-hidden",
                isScrolling && "is-scrolling"
            )}
            onMouseLeave={() => setHoveredLink(null)}
            style={{ backgroundColor: 'var(--app-bg)' }}
        >
            {/* Link Modal */}
            <UrlInputModal
                isOpen={isLinkModalOpen}
                type="link"
                initialUrl={linkModalData.url}
                initialText={linkModalData.text}
                allNotes={allNotes}
                onClose={() => setIsLinkModalOpen(false)}
                onSave={saveLink}
                isIOS={isIOS}
            />

            {/* Merged Formatting & Link Menu */}
            {editor && (
                <BubbleMenu
                    pluginKey="formattingMenu"
                    editor={editor}
                    updateDelay={0}
                    shouldShow={({ from, to }) => {
                        if (isIOS) return false;
                        return from !== to;
                    }}
                >
                    <BubbleToolbarContent
                        editor={editor}
                        onLinkClick={openLinkModal}
                        onRemoveLink={() => setHoveredLink(null)}
                        onNavigate={onNavigate}
                    />
                </BubbleMenu>
            )}

            {/* Hover-based Link Toolbar */}
            {hoveredLink && editor.state.selection.empty && (
                <div
                    className="fixed z-[100] animate-fade-in-up"
                    style={{
                        top: hoveredLink.rect.top - 45,
                        left: Math.max(10, Math.min(window.innerWidth - 250, hoveredLink.rect.left + (hoveredLink.rect.width / 2) - 100))
                    }}
                    onMouseEnter={clearHideTimeout}
                    onMouseLeave={startHideTimeout}
                >
                    <BubbleToolbarContent
                        editor={editor}
                        onLinkClick={openLinkModal}
                        onRemoveLink={() => setHoveredLink(null)}
                        hoveredLink={hoveredLink}
                        onNavigate={onNavigate}
                    />
                </div>
            )}

            {/* Drop Indicator */}
            {isDragging && <DropIndicator />}

            {/* Content area - isolated scroll area */}
            <div
                ref={scrollContainerRef}
                className={clsx(
                    "flex-1 overflow-y-auto custom-scrollbar min-h-0 cursor-text group/editor",
                    isFocusMode && "focus-mode-active"
                )}
                style={isIOS && keyboardHeight > 0 ? { paddingBottom: `${keyboardHeight + 80}px` } : undefined}
                onScroll={handleScroll}
                onDragEnter={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                }}
                onDragLeave={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    if (
                        e.clientX <= rect.left ||
                        e.clientX >= rect.right ||
                        e.clientY <= rect.top ||
                        e.clientY >= rect.bottom
                    ) {
                        setIsDragging(false);
                    }
                }}
                onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(false);
                }}
                onClick={(e) => {
                    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('max-w-4xl')) {
                        editor.chain().focus('end').run();
                    }
                }}
            >
                <div
                    className="max-w-4xl mx-auto pt-0 pb-8 px-4 md:px-8 min-h-full flex flex-col w-full"
                    style={iosLandscapeFullscreen ? {
                        paddingLeft: 'max(10%, env(safe-area-inset-left, 16px))',
                        paddingRight: 'max(10%, env(safe-area-inset-right, 16px))',
                    } : undefined}
                >
                    {header}
                    <EditorContent editor={editor} className="prose dark:prose-invert prose-sm sm:prose-base lg:prose-lg xl:prose-2xl flex-1 flex flex-col break-words [overflow-wrap:anywhere]" />
                </div>
            </div>

            {/* Footer Toolbar - native accessory bar on iOS, floating web bar on desktop */}
            {toolbarVisible && !isIOS && (
                <div
                    ref={toolbarRef}
                    className="px-2 backdrop-blur-md border-t border-gray-100 dark:border-gray-800 flex items-center justify-center w-full box-content"
                    style={keyboardHeight > 0
                        ? { backgroundColor: 'var(--app-bg)', position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9998, paddingTop: 4, paddingBottom: 4 }
                        : { backgroundColor: 'var(--app-bg)', paddingTop: 8, paddingBottom: 'calc(8px + var(--safe-bottom, 0vh))' }
                    }
                >
                    <EditorToolbar
                        editor={editor}
                        onLinkClick={() => openLinkModal()}
                        mobile={keyboardHeight > 0}
                    />
                </div>
            )}
        </div>
    );
}));

MarkdownEditor.displayName = 'MarkdownEditor';

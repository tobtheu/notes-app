import { forwardRef, useImperativeHandle, memo, useState } from 'react';
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
    scrollToTop: () => void;
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
        onNavigate
    } = props;

    const [prevVisible, setPrevVisible] = useState(toolbarVisible);
    const [animState, setAnimState] = useState<'initial-visible' | 'initial-hidden' | 'entering' | 'exiting'>(() =>
        toolbarVisible ? 'initial-visible' : 'initial-hidden'
    );

    if (prevVisible !== toolbarVisible) {
        setPrevVisible(toolbarVisible);
        setAnimState(toolbarVisible ? 'entering' : 'exiting');
    }



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
        },
        scrollToTop: () => {
            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop = 0;
            }
        }
    }), [editor, scrollContainerRef]);

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
            style={{ backgroundColor: 'transparent' }}
        >
            {/* Link Modal */}
            <UrlInputModal
                isOpen={isLinkModalOpen}
                type="link"
                initialUrl={linkModalData.url}
                initialText={linkModalData.text}
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
                    "flex-1 overflow-y-auto custom-scrollbar min-h-0 cursor-text group/editor pb-16",
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
                        editor.chain().focus().run();
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

            {/* Floating Toolbar with Elastic Spring Physics */}
            <div
                ref={toolbarRef}
                className={clsx(
                    "absolute bottom-4 left-0 right-0 flex justify-center z-30 px-4 pointer-events-none origin-bottom",
                    animState === 'entering' && "animate-toolbar-enter",
                    animState === 'exiting' && "animate-toolbar-exit",
                    animState === 'initial-visible' && "toolbar-static-visible",
                    animState === 'initial-hidden' && "toolbar-static-hidden"
                )}
                style={keyboardHeight > 0 ? { bottom: `${keyboardHeight + 12}px` } : undefined}
                onAnimationEnd={(e) => {
                    if (e.target === toolbarRef.current) {
                        if (animState === 'entering') {
                            setAnimState('initial-visible');
                        } else if (animState === 'exiting') {
                            setAnimState('initial-hidden');
                        }
                    }
                }}
            >
                <div className="pointer-events-auto">
                    <EditorToolbar
                        editor={editor}
                        onLinkClick={() => openLinkModal()}
                        mobile={keyboardHeight > 0}
                    />
                </div>
            </div>
        </div>
    );
}));

MarkdownEditor.displayName = 'MarkdownEditor';

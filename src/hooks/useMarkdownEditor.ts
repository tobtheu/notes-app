import { useState, useEffect, useRef, useCallback } from 'react';
import { Selection } from 'prosemirror-state';
import { useEditor, type Editor } from '@tiptap/react';
import { platform } from '@tauri-apps/plugin-os';

import { EDITOR_EXTENSIONS } from '../extensions/editorExtensions';
import { handleEditorPaste } from '../utils/editorPasteHandler';
import { useEditorKeyboardScroll } from './useEditorKeyboardScroll';
import { useIOSEditorToolbar } from './useIOSEditorToolbar';
import { useEditorLinkPopup } from './useEditorLinkPopup';
import { useEditorDragDrop } from './useEditorDragDrop';

interface UseMarkdownEditorProps {
    content: string;
    onChange: (markdown: string) => void;
    onNavigate?: (id: string, anchor?: string) => void;
    spellcheckEnabled?: boolean;
    workspacePath?: string;
    isFocusMode?: boolean;
    onArrowUpAtStart?: () => void;
    onBlur?: () => void;
}

export function useMarkdownEditor({
    content,
    onChange,
    onNavigate,
    spellcheckEnabled = true,
    workspacePath: _workspacePath,
    onArrowUpAtStart,
    onBlur
}: UseMarkdownEditorProps) {
    const [isScrolling, setIsScrolling] = useState(false);

    const [isIOS, setIsIOS] = useState(false);
    useEffect(() => {
        try {
            const p = platform();
            setIsIOS(p === 'ios');
        } catch (e) {
            console.error("Failed to detect platform:", e);
        }
    }, []);

    // Visual viewport & keyboard scrolling
    const {
        keyboardHeight,
        keyboardHeightRef,
        scrollContainerRef,
        scrollCursorAboveKeyboard,
    } = useEditorKeyboardScroll(isIOS);

    // File Drag & Drop feedback
    const {
        isDragging,
        setIsDragging,
        handleDragEnter,
        handleDragOver,
        handleDragLeave,
    } = useEditorDragDrop();

    const toolbarRef = useRef<HTMLDivElement>(null);
    const scrollTimeoutRef = useRef<any>(null);

    const editorMarkdownRef = useRef('');
    const onNavigateRef = useRef(onNavigate);
    onNavigateRef.current = onNavigate;
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const onBlurRef = useRef(onBlur);
    onBlurRef.current = onBlur;
    const editorRef = useRef<Editor | null>(null);

    const editor = useEditor({
        extensions: EDITOR_EXTENSIONS,
        content,
        autofocus: false,
        editorProps: {
            attributes: {
                class: 'focus:outline-none min-h-[500px] pb-32 px-1',
                spellcheck: spellcheckEnabled ? 'true' : 'false',
            },
            handleScrollToSelection: (view) => {
                if (!view.hasFocus()) return true;
                return false;
            },
            handleDOMEvents: {
                click: (_view, event) => {
                    const target = event.target as HTMLElement;

                    const taskItem = target.closest('li[data-type="taskItem"], li.task-item');
                    if (taskItem && (target.tagName === 'INPUT' || target.tagName === 'LABEL' || target.closest('label'))) {
                        try {
                            const pos = _view.posAtDOM(taskItem, 0);
                            if (typeof pos === 'number' && pos >= 0) {
                                const tr = _view.state.tr.setSelection(
                                    Selection.near(_view.state.doc.resolve(pos))
                                );
                                _view.dispatch(tr);
                            }
                        } catch {}
                    }

                    const anchor = target.closest('a');
                    if (anchor && onNavigateRef.current) {
                        const href = anchor.getAttribute('href');
                        if (href) {
                            const isInternal = href.startsWith('note://') || href.startsWith('id:') || href.startsWith('#');
                            if (isInternal) {
                                event.preventDefault();
                                event.stopPropagation();
                                if (href.startsWith('#')) {
                                    onNavigateRef.current('', href.substring(1));
                                } else {
                                    const cleanHref = href.replace('note://', '').replace('id:', '');
                                    const [id, anchor] = cleanHref.split('#');
                                    let decodedId = id;
                                    try {
                                        decodedId = decodeURIComponent(id);
                                    } catch {
                                        decodedId = id;
                                    }
                                    onNavigateRef.current(decodedId, anchor);
                                }
                                return true;
                            }
                        }
                    }
                    return false;
                },
                dragenter: handleDragEnter,
                dragover: handleDragOver,
                dragleave: handleDragLeave,
            },
            handlePaste: (view, event): boolean => {
                return handleEditorPaste(view, event, editorRef.current);
            },
            handleKeyDown: (view, event) => {
                if (event.key === 'ArrowUp' && onArrowUpAtStart) {
                    const { selection } = view.state;
                    if (selection.empty && selection.$from.pos <= 1) {
                        onArrowUpAtStart();
                        return true;
                    }
                }
                return false;
            }
        },
        onCreate: ({ editor: ed }) => {
            try {
                const md = (ed.storage as any)?.markdown?.getMarkdown();
                editorMarkdownRef.current = md || content || '';
            } catch {
                editorMarkdownRef.current = content || '';
            }
        },
        onUpdate: ({ editor: ed }) => {
            const markdown = (ed.storage as any).markdown.getMarkdown();
            editorMarkdownRef.current = markdown;
            onChangeRef.current(markdown);
            if (keyboardHeightRef.current > 0) {
                requestAnimationFrame(() => scrollCursorAboveKeyboard(ed));
            }
        },
        onBlur: () => {
            onBlurRef.current?.();
        },
    }, []);

    editorRef.current = editor;

    // Link popovers & link modal management
    const {
        isLinkModalOpen,
        setIsLinkModalOpen,
        linkModalData,
        hoveredLink,
        setHoveredLink,
        clearHideTimeout,
        startHideTimeout,
        openLinkModal,
        saveLink,
    } = useEditorLinkPopup({ editor });

    // Sync content changes
    useEffect(() => {
        if (!editor || content == null) return;
        const normalizedContent = content.trim();
        const currentContent = editorMarkdownRef.current.trim();
        if (normalizedContent !== currentContent && !editor.isDestroyed && !editor.isFocused) {
            queueMicrotask(() => {
                if (!editor.isDestroyed) {
                    editor.commands.setContent(content, { emitUpdate: false });
                    editorMarkdownRef.current = content;
                    if (scrollContainerRef.current) {
                        scrollContainerRef.current.scrollTop = 0;
                    }
                }
            });
        }
    }, [editor, content, scrollContainerRef]);

    useEffect(() => {
        if (!editor) return;
        const timer = setTimeout(() => {
            editor.setOptions({
                editorProps: {
                    attributes: {
                        spellcheck: spellcheckEnabled ? 'true' : 'false',
                    }
                }
            });
        }, 0);
        return () => clearTimeout(timer);
    }, [editor, spellcheckEnabled]);

    const handleScroll = useCallback(() => {
        setIsScrolling(true);
        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = setTimeout(() => {
            setIsScrolling(false);
        }, 1000);
    }, []);

    useEffect(() => {
        return () => {
            if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        };
    }, []);

    // iOS native toolbar accessory bar bridge
    useIOSEditorToolbar({
        isIOS,
        editor,
        keyboardHeight,
        scrollCursorAboveKeyboard,
        openLinkModal,
    });

    return {
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
    };
}

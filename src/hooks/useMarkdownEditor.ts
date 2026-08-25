import { useState, useEffect, useRef, useCallback } from 'react';
import { Selection } from 'prosemirror-state';
import { useEditor, type Editor } from '@tiptap/react';
import { platform } from '@tauri-apps/plugin-os';

import { EDITOR_EXTENSIONS } from '../extensions/editorExtensions';
import { handleEditorPaste } from '../utils/editorPasteHandler';
import { useEditorKeyboardScroll } from './useEditorKeyboardScroll';
import { useIOSEditorToolbar } from './useIOSEditorToolbar';

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
    /**
     * --- LOCAL STATE ---
     */
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [linkModalData, setLinkModalData] = useState<{ url: string; text: string }>({ url: '', text: '' });

    // Tracks current hover state for "quick action" popups on links
    const [hoveredLink, setHoveredLink] = useState<{ href: string, text: string, pos: number, rect: DOMRect } | null>(null);

    const [isScrolling, setIsScrolling] = useState(false);
    const [isDragging, setIsDragging] = useState(false); // Visual feedback for file drop

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

    const toolbarRef = useRef<HTMLDivElement>(null);
    const hideTimeoutRef = useRef<any>(null);
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
                // Prevent ProseMirror from scrolling the container if the editor does not have focus
                if (!view.hasFocus()) {
                    return true;
                }
                return false;
            },
            handleDOMEvents: {
                click: (_view, event) => {
                    const target = event.target as HTMLElement;

                    // If a taskItem checkbox is clicked, ensure selection matches clicked item position to prevent viewport jump
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
                dragenter: () => {
                    setIsDragging(true);
                    return false;
                },
                dragover: (_view, event) => {
                    setIsDragging(true);
                    event.preventDefault();
                    return false;
                },
                dragleave: (_view, event) => {
                    if (!(_view.dom as HTMLElement).contains(event.relatedTarget as Node)) {
                        setIsDragging(false);
                    }
                    return false;
                }
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

    /**
     * --- SIDE EFFECTS ---
     */

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

    /**
     * --- HELPER METHODS ---
     */

    const clearHideTimeout = () => {
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
        }
    };

    const startHideTimeout = () => {
        clearHideTimeout();
        hideTimeoutRef.current = setTimeout(() => {
            setHoveredLink(null);
            hideTimeoutRef.current = null;
        }, 300);
    };

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

    const openLinkModal = useCallback((initialUrl?: string, initialText?: string) => {
        if (!editor) return;
        setLinkModalData({
            url: initialUrl || editor.getAttributes('link').href || '',
            text: initialText || editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to) || ''
        });
        setIsLinkModalOpen(true);
    }, [editor]);

    useEffect(() => {
        const handler = () => openLinkModal();
        window.addEventListener('tiptap:openLinkModal', handler);
        return () => window.removeEventListener('tiptap:openLinkModal', handler);
    }, [openLinkModal]);

    // iOS native toolbar accessory bar bridge
    useIOSEditorToolbar({
        isIOS,
        editor,
        keyboardHeight,
        scrollCursorAboveKeyboard,
        openLinkModal,
    });

    const saveLink = (url: string, text?: string) => {
        if (!editor) return;

        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
        } else {
            if (text) {
                editor.chain()
                    .focus()
                    .extendMarkRange('link')
                    .insertContent({
                        type: 'text',
                        text: text,
                        marks: [{ type: 'link', attrs: { href: url } }]
                    })
                    .run();
            } else {
                editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
            }
        }
        setIsLinkModalOpen(false);
    };

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

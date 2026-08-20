import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Note } from '../types';
import { useEditor, ReactNodeViewRenderer, mergeAttributes } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Heading from '@tiptap/extension-heading';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';

import { ImageWithCaption } from '../extensions/ImageWithCaption';
import { platform } from '@tauri-apps/plugin-os';
import { TableNode } from '../components/TableNode';
import { toggleSmartMark } from '../utils/editor';
import { CodeBlockComponent } from '../components/CodeBlockComponent';

// Custom Tiptap Extensions
import { SlashCommands } from '../extensions/SlashCommands';

const lowlight = createLowlight(common);

interface UseMarkdownEditorProps {
    content: string;
    allNotes?: Note[];
    onChange: (markdown: string) => void;
    onNavigate?: (id: string, anchor?: string) => void;
    spellcheckEnabled?: boolean;
    imageCloudSync?: boolean;
    workspacePath: string;
    isFocusMode?: boolean;
    onArrowUpAtStart?: () => void;
    onBlur?: () => void;
}

export function useMarkdownEditor({
    content,
    allNotes,
    onChange,
    onNavigate,
    spellcheckEnabled = true,
    workspacePath,
    imageCloudSync = false,
    onArrowUpAtStart,
    onBlur
}: UseMarkdownEditorProps) {
    /**
     * --- LOCAL STATE ---
     */
    const [localAssetsDir, setLocalAssetsDir] = useState<string | null>(null);

    useEffect(() => {
        window.tauriAPI.getLocalAssetsDir().then(setLocalAssetsDir).catch(console.error);
    }, []);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [linkModalData, setLinkModalData] = useState<{ url: string; text: string }>({ url: '', text: '' });
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [imageModalData, setImageModalData] = useState<{ src: string; caption: string }>({ src: '', caption: '' });

    // Tracks current hover state for "quick action" popups on links
    const [hoveredLink, setHoveredLink] = useState<{ href: string, text: string, pos: number, rect: DOMRect } | null>(null);

    const [lightboxImage, setLightboxImage] = useState<{ src: string, caption?: string } | null>(null);
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

    // Track keyboard height via visualViewport so toolbar floats above keyboard on mobile
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const keyboardHeightRef = useRef(0);
    const toolbarRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const scrollCursorAboveKeyboard = useCallback((editorInstance: any) => {
        if (!editorInstance || keyboardHeightRef.current <= 0) return;
        const container = scrollContainerRef.current;
        if (!container) return;
        try {
            const { from } = editorInstance.state.selection;
            const coords = editorInstance.view.coordsAtPos(from);
            // Use window.innerHeight - keyboardHeight as the true visible bottom
            const visibleBottom = window.innerHeight - keyboardHeightRef.current - 16;
            if (coords.bottom > visibleBottom) {
                container.scrollTop += coords.bottom - visibleBottom;
            }
        } catch { }
    }, []);

    useEffect(() => {
        const vv = window.visualViewport;
        if (!vv) return;

        if (isIOS) {
            const onResize = () => {
                window.scrollTo(0, 0);
                const kbHeight = window.innerHeight - vv.height - vv.offsetTop;
                const h = kbHeight > 50 ? kbHeight : 0;
                keyboardHeightRef.current = h;
                setKeyboardHeight(h);
            };
            vv.addEventListener('resize', onResize);
            return () => {
                vv.removeEventListener('resize', onResize);
            };
        }

        const update = () => {
            const kbHeight = window.innerHeight - vv.height;
            if (kbHeight > 100) {
                setKeyboardHeight(kbHeight);
            } else {
                setKeyboardHeight(0);
            }
            if (toolbarRef.current && kbHeight > 100) {
                const shift = vv.offsetTop - kbHeight;
                toolbarRef.current.style.transform = `translateY(${shift}px)`;
            }
        };
        vv.addEventListener('resize', update);
        vv.addEventListener('scroll', update);
        update();
        return () => {
            vv.removeEventListener('resize', update);
            vv.removeEventListener('scroll', update);
        };
    }, [isIOS]);
    const [isDragging, setIsDragging] = useState(false); // Visual feedback for file drop

    const hideTimeoutRef = useRef<any>(null);
    const scrollTimeoutRef = useRef<any>(null);

    /**
     * --- EDITOR CONFIGURATION ---
     */
    const workspacePathRef = useRef<string>(workspacePath);

    useEffect(() => { workspacePathRef.current = workspacePath; }, [workspacePath]);

    const extensions = useMemo(() => {
        const rawExtensions = [
            // Suggestions & Slash Commands
            SlashCommands,

            // Core Block Parsing
            TaskList.configure({
                HTMLAttributes: { class: 'task-list' },
            }),
            TaskItem.configure({
                nested: true,
                HTMLAttributes: { class: 'task-item' },
            }),

            // Formatting
            StarterKit.configure({
                heading: false,
                codeBlock: false,
                link: false,
                bulletList: false,
                orderedList: false,
            }),
            BulletList.configure({
                HTMLAttributes: { class: 'bullet-list' },
            }),
            OrderedList.configure({
                HTMLAttributes: { class: 'ordered-list' },
            }),
            CodeBlockLowlight.extend({
                addNodeView() { return ReactNodeViewRenderer(CodeBlockComponent); },
            }).configure({ lowlight }),
            Heading.extend({
                renderHTML({ node, HTMLAttributes }) {
                    const text = node.textContent;
                    const id = text.toLowerCase().replace(/[^a-z0-9äöüß ]/gi, '').trim().replace(/\s+/g, '-');
                    return [`h${node.attrs.level}`, mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { id }), 0];
                },
            }),
            Markdown.configure({
                transformPastedText: true,
                linkify: true,
            }),
            Highlight.configure({ multicolor: true }),
            Link.configure({
                openOnClick: false,
                autolink: true,
                HTMLAttributes: {
                    class: 'cursor-pointer text-primary-600 hover:text-primary-700 underline underline-offset-4',
                },
            }),
            ImageWithCaption.configure({ workspacePathRef }),
            Table.extend({ addNodeView() { return ReactNodeViewRenderer(TableNode); } }).configure({ resizable: true }),
            TableRow, TableHeader, TableCell,
            Placeholder.configure({ placeholder: "Type '/' for commands or '[[' for links..." }),
        ];

        return rawExtensions;
    }, []);

    const editorMarkdownRef = useRef('');

    const onNavigateRef = useRef(onNavigate);
    onNavigateRef.current = onNavigate;
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const onBlurRef = useRef(onBlur);
    onBlurRef.current = onBlur;

    const editor = useEditor({
        extensions,
        content,
        editorProps: {
            attributes: {
                class: 'focus:outline-none min-h-[500px] pb-32 px-1',
                spellcheck: spellcheckEnabled ? 'true' : 'false',
            },
            handleDOMEvents: {
                click: (_view, event) => {
                    const target = event.target as HTMLElement;
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
                                    onNavigateRef.current(decodeURIComponent(id), anchor);
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
            handlePaste: (view, event) => {
                const clipboardData = event.clipboardData;
                if (!clipboardData) return false;

                const text = clipboardData.getData('text/plain');
                const html = clipboardData.getData('text/html');

                // If HTML is present in clipboard (e.g. copied rich text from a browser), let default Tiptap/ProseMirror handle it
                if (html && html.trim().length > 0) {
                    return false;
                }

                if (!text || !text.trim()) return false;

                // Check if user is currently inside a code block node
                const { $from } = view.state.selection;
                let inCodeBlock = false;
                for (let d = $from.depth; d > 0; d--) {
                    if ($from.node(d).type.name === 'codeBlock') {
                        inCodeBlock = true;
                        break;
                    }
                }
                if (inCodeBlock) return false;

                // Check if the text itself explicitly starts with a fence (```)
                const isExplicitCodeBlock = /^\s*```/.test(text);

                // Clean up leading line indents if the pasted text isn't an explicit code block fenced with ```
                // Standard markdown parsers treat 4-space indented lines as indented code blocks.
                let processedText = text;
                if (!isExplicitCodeBlock) {
                    const lines = text.split('\n');
                    const hasConsistent4SpaceIndent = lines.every(line => line.trim() === '' || line.startsWith('    ') || line.startsWith('\t'));
                    if (hasConsistent4SpaceIndent) {
                        processedText = lines.map(line => line.replace(/^(    |\t)/, '')).join('\n');
                    }
                }

                const markdownStorage = (editor?.storage as any)?.markdown;
                if (markdownStorage?.parser && editor) {
                    try {
                        const parsedNode = markdownStorage.parser.parse(processedText);
                        if (parsedNode) {
                            event.preventDefault();
                            event.stopPropagation();
                            editor.commands.insertContent(processedText);
                            return true;
                        }
                    } catch (err) {
                        console.error('Failed to parse pasted markdown:', err);
                    }
                }

                return false;
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
        onUpdate: ({ editor }) => {
            const markdown = (editor.storage as any).markdown.getMarkdown();
            editorMarkdownRef.current = markdown;
            onChangeRef.current(markdown);
            if (keyboardHeightRef.current > 0) {
                requestAnimationFrame(() => scrollCursorAboveKeyboard(editor));
            }
        },
        onBlur: () => {
            onBlurRef.current?.();
        },
    }, []);

    /**
     * --- SIDE EFFECTS ---
     */

    useEffect(() => {
        if (!editor || content == null) return;
        if (content !== editorMarkdownRef.current && !editor.isDestroyed && !editor.isFocused) {
            editor.commands.setContent(content, { emitUpdate: false });
            editorMarkdownRef.current = content;
        }
    }, [editor, content]);

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

    const openImageModal = useCallback((initialAttrs?: { src?: string, alt?: string }) => {
        if (!editor) return;
        setImageModalData({
            src: initialAttrs?.src || '',
            caption: initialAttrs?.alt || ''
        });
        setIsImageModalOpen(true);
    }, [editor]);

    const openLinkModalRef = useRef(openLinkModal);
    useEffect(() => { openLinkModalRef.current = openLinkModal; }, [openLinkModal]);
    const openImageModalRef = useRef(openImageModal);
    useEffect(() => { openImageModalRef.current = openImageModal; }, [openImageModal]);

    useEffect(() => {
        if (!isIOS || !editor || keyboardHeight <= 0) return;
        const t1 = setTimeout(() => scrollCursorAboveKeyboard(editor), 100);
        const t2 = setTimeout(() => scrollCursorAboveKeyboard(editor), 400);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, [isIOS, editor, keyboardHeight, scrollCursorAboveKeyboard]);

    useEffect(() => {
        if (!isIOS || !editor) return;

        (window as any).webkit?.messageHandlers?.toolbarVisible?.postMessage(true);

        (window as any).toolbarAction = (action: string) => {
            switch (action) {
                case 'bold':       toggleSmartMark(editor, 'bold', undefined, false); break;
                case 'italic':     toggleSmartMark(editor, 'italic', undefined, false); break;
                case 'highlight':  toggleSmartMark(editor, 'highlight', undefined, false); break;
                case 'h1':         editor.chain().toggleHeading({ level: 1 }).run(); break;
                case 'h2':         editor.chain().toggleHeading({ level: 2 }).run(); break;
                case 'h3':         editor.chain().toggleHeading({ level: 3 }).run(); break;
                case 'bulletList': editor.chain().toggleBulletList().run(); break;
                case 'taskList':   editor.chain().toggleTaskList().run(); break;
                case 'blockquote': editor.chain().toggleBlockquote().run(); break;
                case 'codeBlock':  editor.chain().toggleCodeBlock().run(); break;
                case 'link':       openLinkModalRef.current(); break;
                case 'image':      openImageModalRef.current(); break;
                case 'undo':       editor.chain().undo().run(); break;
                case 'redo':       editor.chain().redo().run(); break;
                case 'indent':     editor.chain().sinkListItem('listItem').run(); break;
                case 'outdent':    editor.chain().liftListItem('listItem').run(); break;
                case 'table':      editor.chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); break;
            }
        };

        const sendState = () => {
            const state = {
                bold:       editor.isActive('bold'),
                italic:     editor.isActive('italic'),
                highlight:  editor.isActive('highlight'),
                h1:         editor.isActive('heading', { level: 1 }),
                h2:         editor.isActive('heading', { level: 2 }),
                h3:         editor.isActive('heading', { level: 3 }),
                bulletList: editor.isActive('bulletList'),
                taskList:   editor.isActive('taskList'),
                blockquote: editor.isActive('blockquote'),
                codeBlock:  editor.isActive('codeBlock'),
                link:       editor.isActive('link'),
            };
            (window as any).webkit?.messageHandlers?.toolbarState?.postMessage(state);
        };

        editor.on('selectionUpdate', sendState);
        editor.on('transaction', sendState);

        const ensureCursorVisible = () => {
            requestAnimationFrame(() => scrollCursorAboveKeyboard(editor));
        };
        editor.on('selectionUpdate', ensureCursorVisible);
        editor.on('focus', ensureCursorVisible);

        return () => {
            delete (window as any).toolbarAction;
            editor.off('selectionUpdate', sendState);
            editor.off('transaction', sendState);
            editor.off('selectionUpdate', ensureCursorVisible);
            editor.off('focus', ensureCursorVisible);
            (window as any).webkit?.messageHandlers?.toolbarVisible?.postMessage(false);
        };
    }, [isIOS, editor, scrollCursorAboveKeyboard]);

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

    const saveImage = async (src: string, _text?: string, caption?: string) => {
        if (!editor) return;

        if (src) {
            if (src.startsWith('data:image/')) {
                const extMatch = src.match(/data:image\/([a-zA-Z0-9]+);base64,/);
                const extension = extMatch ? extMatch[1] : 'png';
                const filename = `img-${Date.now()}.${extension}`;
                try {
                    const res = imageCloudSync
                        ? await window.tauriAPI.saveAsset(workspacePath, filename, src)
                        : await window.tauriAPI.saveLocalAsset(filename, src);

                    if (res.success && res.path) {
                        editor.chain().focus().setImage({ src: res.path, alt: caption }).run();
                    }
                } catch (e) {
                    console.error("Failed to save image asset", e);
                }
            } else {
                editor.chain().focus().setImage({ src, alt: caption }).run();
            }
        }
        setIsImageModalOpen(false);
    };

    return {
        editor,
        localAssetsDir,
        isLinkModalOpen,
        setIsLinkModalOpen,
        linkModalData,
        isImageModalOpen,
        setIsImageModalOpen,
        imageModalData,
        hoveredLink,
        setHoveredLink,
        lightboxImage,
        setLightboxImage,
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
        openImageModal,
        saveLink,
        saveImage
    };
}

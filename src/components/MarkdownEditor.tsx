import { useState, useEffect, useCallback, forwardRef, useImperativeHandle, useRef, useMemo } from 'react';
import type { Note } from '../types';
import { useEditor, EditorContent, ReactRenderer, Extension, ReactNodeViewRenderer, mergeAttributes } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Heading from '@tiptap/extension-heading';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import 'highlight.js/styles/github-dark.css';

// Image import removed as it is replaced by ImageWithCaption
import { ImageWithCaption } from '../extensions/ImageWithCaption';
import Suggestion from '@tiptap/suggestion';
import tippy, { type Instance } from 'tippy.js';
import { EditorToolbar } from './EditorToolbar';
import {
    Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare, Quote, Minus,
    Code as CodeIcon, Table as TableIcon, Link as LinkIcon, ExternalLink, Edit2, Trash2,
    Upload, Maximize, Settings, X
} from 'lucide-react';
import clsx from 'clsx';

import { TableNode } from './TableNode';
import { UrlInputModal } from './UrlInputModal';
import { toggleSmartMark } from '../utils/editor';
import { WikiLinkMenu } from './WikiLinkMenu';
import { PluginKey } from '@tiptap/pm/state';
import { CodeBlockComponent } from './CodeBlockComponent';

const lowlight = createLowlight(common);

interface MarkdownEditorProps {
    content: string;
    allNotes?: Note[];
    onChange: (markdown: string) => void;
    onNavigate?: (id: string, anchor?: string) => void;
    toolbarVisible?: boolean;
    spellcheckEnabled?: boolean;
    header?: React.ReactNode;
}

// suggestion items definition
const items = [
    { title: 'Heading 1', icon: Heading1, command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run() },
    { title: 'Heading 2', icon: Heading2, command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run() },
    { title: 'Heading 3', icon: Heading3, command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run() },
    { title: 'Bullet List', icon: List, command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).toggleBulletList().run() },
    { title: 'Ordered List', icon: ListOrdered, command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).toggleOrderedList().run() },
    { title: 'Task List', icon: CheckSquare, command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).toggleTaskList().run() },
    { title: 'Table', icon: TableIcon, command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { title: 'Blockquote', icon: Quote, command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).toggleBlockquote().run() },
    { title: 'Code Block', icon: CodeIcon, command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run() },
    {
        title: 'Link', icon: LinkIcon, command: ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).run();
            // Trigger link modal via custom event (handled in MarkdownEditor)
            window.dispatchEvent(new CustomEvent('tiptap:openLinkModal'));
        }
    },
    { title: 'Divider', icon: Minus, command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).setHorizontalRule().run() },
];

const SlashMenu = forwardRef((props: any, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const lastMousePos = useRef({ x: 0, y: 0 });

    const handleMouseMove = (e: React.MouseEvent, index: number) => {
        if (e.clientX !== lastMousePos.current.x || e.clientY !== lastMousePos.current.y) {
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            if (selectedIndex !== index) {
                setSelectedIndex(index);
            }
        }
    };

    const selectItem = (index: number) => {
        const item = props.items[index];
        if (item) {
            props.command(item);
        }
    };

    useEffect(() => {
        const selectedElement = containerRef.current?.children[selectedIndex + 1] as HTMLElement;
        if (selectedElement) {
            selectedElement.scrollIntoView({ block: 'nearest' });
        }
    }, [selectedIndex]);

    useImperativeHandle(ref, () => ({
        onKeyDown: ({ event }: { event: KeyboardEvent }) => {
            if (event.key === 'ArrowUp') {
                setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
                return true;
            }
            if (event.key === 'ArrowDown') {
                setSelectedIndex((selectedIndex + 1) % props.items.length);
                return true;
            }
            if (event.key === 'Enter') {
                selectItem(selectedIndex);
                return true;
            }
            return false;
        },
    }));

    return (
        <div ref={containerRef} className="bg-white dark:bg-gray-800 shadow-2xl rounded-xl border border-gray-200 dark:border-gray-700 p-1.5 min-w-[220px] max-h-[300px] overflow-y-auto z-[1000] overflow-hidden custom-scrollbar">
            <div className="text-[10px] text-gray-400 p-2 font-black uppercase tracking-widest opacity-60">Add Block</div>
            {props.items.map((item: any, index: number) => (
                <button
                    key={index}
                    onClick={() => selectItem(index)}
                    onMouseMove={(e) => handleMouseMove(e, index)}
                    className={clsx(
                        "w-full text-left px-3 py-2 text-sm rounded-lg flex items-center gap-3 group transition-all",
                        index === selectedIndex
                            ? 'bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    )}
                >
                    <div className={clsx(
                        "w-8 h-8 flex-shrink-0 rounded-md flex items-center justify-center font-bold transition-colors",
                        index === selectedIndex
                            ? 'bg-primary-100 dark:bg-primary-800 text-primary-600 dark:text-primary-200'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                    )}>
                        <item.icon size={16} />
                    </div>
                    <span className="font-semibold">{item.title}</span>
                </button>
            ))}
        </div>
    );
});

SlashMenu.displayName = 'SlashMenu';

const WikiLinkSuggestion = Extension.create({
    name: 'wikiLinkSuggestion',
    addOptions() {
        return {
            allNotesRef: { current: [] as Note[] },
        };
    },
    addProseMirrorPlugins() {
        return [
            Suggestion({
                editor: this.editor,
                char: '[[',
                pluginKey: new PluginKey('wikiLinkSuggestion'),
                command: ({ editor, range, props }: any) => {
                    const { id, anchor, label } = props;
                    const encodedId = id.split('/').map((s: string) => encodeURIComponent(s)).join('/');
                    const url = `note://${encodedId}${anchor ? `#${anchor}` : ''}`;

                    editor
                        .chain()
                        .focus()
                        .deleteRange(range)
                        .setLink({ href: url })
                        .insertContent(`[[${label}]]`)
                        .run();
                },
                items: ({ query }: { query: string }) => {
                    const allNotes = this.options.allNotesRef.current as Note[];
                    return allNotes.filter(note =>
                        note.filename.toLowerCase().includes(query.toLowerCase()) ||
                        (note.folder && note.folder.toLowerCase().includes(query.toLowerCase()))
                    ).slice(0, 10);
                },
                render: () => {
                    let component: any;
                    let popup: Instance[];

                    return {
                        onStart: props => {
                            component = new ReactRenderer(WikiLinkMenu, {
                                props,
                                editor: props.editor,
                            });

                            popup = tippy('body', {
                                getReferenceClientRect: props.clientRect as any,
                                appendTo: () => document.body,
                                content: component.element,
                                showOnCreate: true,
                                interactive: true,
                                trigger: 'manual',
                                placement: 'bottom-start',
                                zIndex: 999,
                            });
                        },
                        onUpdate(props) {
                            component.updateProps(props);
                            if (popup && popup[0]) {
                                popup[0].setProps({
                                    getReferenceClientRect: props.clientRect as any,
                                });
                            }
                        },
                        onKeyDown(props) {
                            if (props.event.key === 'Escape') {
                                popup?.[0]?.hide();
                                return true;
                            }
                            return component.ref?.onKeyDown(props);
                        },
                        onExit() {
                            popup?.[0]?.destroy();
                            component.destroy();
                        },
                    };
                },
            }),
        ];
    },
});

const SlashCommands = Extension.create({
    name: 'slashCommands',
    addProseMirrorPlugins() {
        return [
            Suggestion({
                editor: this.editor,
                char: '/',
                pluginKey: new PluginKey('slashCommands'),
                command: ({ editor, range, props }: any) => {
                    props.command({ editor, range });
                },
                items: ({ query }: { query: string }) => {
                    return items.filter(item => item.title.toLowerCase().startsWith(query.toLowerCase()));
                },
                render: () => {
                    let component: any;
                    let popup: Instance[];

                    return {
                        onStart: props => {
                            component = new ReactRenderer(SlashMenu, {
                                props,
                                editor: props.editor,
                            });

                            popup = tippy('body', {
                                getReferenceClientRect: props.clientRect as any,
                                appendTo: () => document.body,
                                content: component.element,
                                showOnCreate: true,
                                interactive: true,
                                trigger: 'manual',
                                placement: 'bottom-start',
                                zIndex: 999,
                            });
                        },
                        onUpdate(props) {
                            component.updateProps(props);
                            if (popup && popup[0]) {
                                popup[0].setProps({
                                    getReferenceClientRect: props.clientRect as any,
                                });
                            }
                        },
                        onKeyDown(props) {
                            if (props.event.key === 'Escape') {
                                popup?.[0]?.hide();
                                return true;
                            }
                            return component.ref?.onKeyDown(props);
                        },
                        onExit() {
                            popup?.[0]?.destroy();
                            component.destroy();
                        },
                    };
                },
            }),
        ];
    },
});

const BubbleToolbarContent: React.FC<{
    editor: any;
    onLinkClick: (url?: string, text?: string) => void;
    onRemoveLink?: () => void;
    hoveredLink?: { href: string; pos: number; rect: DOMRect } | null;
    onImageEdit?: () => void;
    onImagePreview?: () => void;
    onNavigate?: (id: string, anchor?: string) => void;
}> = ({ editor, onLinkClick, onRemoveLink, hoveredLink, onImageEdit, onImagePreview, onNavigate }) => {
    // Add a local state to force re-renders when the editor state changes
    const [, setUpdateCount] = useState(0);

    useEffect(() => {
        if (!editor) return;

        const updateHandler = () => {
            setUpdateCount(prev => prev + 1);
        };

        editor.on('transaction', updateHandler);

        return () => {
            editor.off('transaction', updateHandler);
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
                                if (onRemoveLink) onRemoveLink();
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


/**
 * MarkdownEditor Component
 * A feature-rich WYSIWYG editor powered by Tiptap.
 * Provides: Markdown parsing, Slash Commands, Wiki-style internal linking,
 * Image handling (drag & drop), and dynamic toolbars.
 */
export const MarkdownEditor = ({
    content,
    allNotes,
    onChange,
    onNavigate,
    toolbarVisible = true,
    spellcheckEnabled = true,
    header
}: MarkdownEditorProps) => {
    /**
     * --- LOCAL STATE ---
     */
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [linkModalData, setLinkModalData] = useState<{ url: string; text: string }>({ url: '', text: '' });
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [imageModalData, setImageModalData] = useState<{ src: string; caption: string }>({ src: '', caption: '' });

    // Tracks current hover state for "quick action" popups on links
    const [hoveredLink, setHoveredLink] = useState<{ href: string, text: string, pos: number, rect: DOMRect } | null>(null);

    const [lightboxImage, setLightboxImage] = useState<{ src: string, caption?: string } | null>(null);
    const [isScrolling, setIsScrolling] = useState(false);
    const [isDragging, setIsDragging] = useState(false); // Visual feedback for file drop

    const hideTimeoutRef = useRef<any>(null);
    const scrollTimeoutRef = useRef<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    /**
     * --- EDITOR CONFIGURATION ---
     */
    const allNotesRef = useRef<Note[]>([]);
    useEffect(() => { allNotesRef.current = allNotes || []; }, [allNotes]);

    // We memoize extensions with a completely empty dependency array to prevent editor re-creation.
    // Dynamic values like 'allNotes' are passed via a ref which is internally used by the extension.
    const extensions = useMemo(() => {
        const rawExtensions = [
            StarterKit.configure({
                heading: false,
                codeBlock: false,
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

            Markdown,
            TaskList,
            TaskItem.configure({ nested: true }),
            Highlight.configure({ multicolor: true }),

            Link.configure({
                openOnClick: false,
                autolink: true,
                HTMLAttributes: {
                    class: 'cursor-pointer text-primary-600 hover:text-primary-700 underline underline-offset-4',
                },
            }),

            ImageWithCaption,
            Table.extend({ addNodeView() { return ReactNodeViewRenderer(TableNode); } }).configure({ resizable: true }),
            TableRow, TableHeader, TableCell,

            Placeholder.configure({ placeholder: "Type '/' for commands..." }),
            SlashCommands,
            WikiLinkSuggestion.configure({ allNotesRef }),
        ];

        return rawExtensions;
    }, []);

    // Tracks the editor's current markdown WITHOUT calling the expensive getMarkdown().
    // Updated in onUpdate (user typing) and setContent (note switching).
    // Initialized to '' so the first useEffect ALWAYS calls setContent — this is critical
    // because ReactNodeViewRenderer (for code blocks) is only ready AFTER EditorContent mounts.
    const editorMarkdownRef = useRef('');

    // Refs for callbacks so the useEditor closure (with [] deps) always has the latest references
    const onNavigateRef = useRef(onNavigate);
    onNavigateRef.current = onNavigate;
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    const editor = useEditor({
        extensions,
        content,
        editorProps: {
            attributes: {
                // prose classes are on the EditorContent wrapper — NOT here to avoid double CSS matching
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
                }
            },
            handleDrop: (view, event, _slice, moved) => {
                setIsDragging(false);
                if (!moved && event.dataTransfer?.files.length) {
                    const file = event.dataTransfer.files[0];
                    if (file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
                            if (coords && e.target?.result) {
                                view.dispatch(view.state.tr.insert(coords.pos, view.state.schema.nodes.image.create({ src: e.target.result })));
                            }
                        };
                        reader.readAsDataURL(file);
                        return true;
                    }
                }
                return false;
            },
        },
        onUpdate: ({ editor }) => {
            const markdown = (editor.storage as any).markdown.getMarkdown();
            editorMarkdownRef.current = markdown; // Track what the editor generated
            onChangeRef.current(markdown);
        },
    }, []); // Empty dependency array ensures stability

    /**
     * --- SIDE EFFECTS ---
     */

    // Content synchronization: handles note switching and backend updates.
    useEffect(() => {
        if (!editor || content == null) return;
        if (content !== editorMarkdownRef.current && !editor.isDestroyed) {
            editor.commands.setContent(content, { emitUpdate: false });
            editorMarkdownRef.current = content;
        }
    }, [editor, content]);

    // Updates dynamic options without re-creating the editor instance
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

    // Listen for slash menu link modal trigger
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

    const saveImage = (src: string, caption?: string) => {
        if (!editor) return;

        if (src) {
            if (editor.isActive('image')) {
                editor.chain().focus().updateAttributes('image', { src, alt: caption }).run();
            } else {
                (editor.chain().focus() as any).setImage({ src, alt: caption }).run();
            }
        }
        setIsImageModalOpen(false);
    };

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && editor) {
            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target?.result) {
                    (editor.chain().focus() as any).setImage({ src: event.target.result as string }).run();
                }
            };
            reader.readAsDataURL(file);
        }
        // Reset input value so same file can be selected again
        if (e.target) e.target.value = '';
    };

    if (!editor) {
        return null;
    }

    return (
        <div
            className={clsx(
                "flex flex-col flex-1 w-full bg-white dark:bg-gray-900 relative overflow-hidden",
                isScrolling && "is-scrolling"
            )}
            onMouseLeave={() => setHoveredLink(null)}
        >
            <UrlInputModal
                isOpen={isLinkModalOpen}
                type="link"
                initialUrl={linkModalData.url}
                initialText={linkModalData.text}
                allNotes={allNotes}
                onClose={() => setIsLinkModalOpen(false)}
                onSave={saveLink}
            />

            {/* Image Modal (reusing UrlInputModal for now, but type is 'image') */}
            <UrlInputModal
                isOpen={isImageModalOpen}
                type="image"
                initialUrl={imageModalData.src}
                initialCaption={imageModalData.caption}
                onClose={() => setIsImageModalOpen(false)}
                onSave={saveImage}
                onBrowseFiles={() => fileInputRef.current?.click()}
            />

            {/* Merged Formatting & Link Menu */}
            {editor && (
                <BubbleMenu
                    pluginKey="formattingMenu"
                    editor={editor}
                    updateDelay={0}
                    shouldShow={({ from, to, editor }) => {
                        return from !== to || editor.isActive('image');
                    }}
                >
                    <BubbleToolbarContent
                        editor={editor}
                        onLinkClick={openLinkModal}
                        onRemoveLink={() => setHoveredLink(null)}
                        onImageEdit={() => {
                            const attrs = editor.getAttributes('image');
                            openImageModal(attrs);
                        }}
                        onImagePreview={() => {
                            const attrs = editor.getAttributes('image');
                            setLightboxImage({ src: attrs.src, caption: attrs.alt });
                        }}
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

            {/* Image Lightbox */}
            {lightboxImage && (
                <div
                    className="image-lightbox"
                    onClick={() => setLightboxImage(null)}
                >
                    <button className="image-lightbox-close">
                        <X size={24} />
                    </button>
                    <div className="image-lightbox-content" onClick={e => e.stopPropagation()}>
                        <img src={lightboxImage.src} alt={lightboxImage.caption || 'Preview'} />
                        {lightboxImage.caption && (
                            <div className="image-lightbox-caption">
                                {lightboxImage.caption}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Drop Indicator */}
            {isDragging && (
                <div className="drop-indicator">
                    <div className="drop-indicator-text">
                        <Upload size={20} />
                        <span>Drop images to insert</span>
                    </div>
                </div>
            )}

            {/* Hidden File Input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onFileChange}
                className="hidden"
            />

            {/* Content area - isolated scroll area */}
            <div
                className="flex-1 overflow-y-auto custom-scrollbar min-h-0"
                onScroll={handleScroll}
            >
                <div className="max-w-4xl mx-auto py-8 px-8">
                    {header}
                    <EditorContent editor={editor} className="prose dark:prose-invert prose-sm sm:prose-base lg:prose-lg xl:prose-2xl" />
                </div>
            </div>

            {/* Footer Toolbar - stays fixed at bottom of MarkdownEditor */}
            {toolbarVisible && (
                <div className="shrink-0 pt-2 editor-toolbar-padding bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-t border-gray-100 dark:border-gray-800 flex justify-center w-full">
                    <EditorToolbar
                        editor={editor}
                        onLinkClick={() => openLinkModal()}
                        onImageClick={openImageModal}
                    />
                </div>
            )}
        </div>
    );
};

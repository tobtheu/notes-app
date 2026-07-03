import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import type { Editor } from '@tiptap/react';
import {
    Bold, Italic, Heading1, Heading2, Heading3, List, CheckSquare,
    Quote, Code, Table, Highlighter, Link as LinkIcon, Image as ImageIcon,
    type LucideIcon
} from 'lucide-react';
import { toggleSmartMark } from '../utils/editor';

interface UseEditorToolbarProps {
    editor: Editor | null;
    mode?: 'full' | 'compact';
    onLinkClick?: () => void;
    onImageClick?: () => void;
    mobile?: boolean;
}

export interface ToolbarItem {
    type: 'button' | 'divider';
    id: string;
    icon?: LucideIcon;
    label?: string;
    action?: () => void;
    isActive?: boolean;
    showInCompact?: boolean;
}

export function useEditorToolbar({
    editor,
    mode = 'full',
    onLinkClick,
    onImageClick,
    mobile = false
}: UseEditorToolbarProps) {
    const [, setUpdateCount] = useState(0);
    const [visibleCount, setVisibleCount] = useState<number>(99);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const hiddenContainerRef = useRef<HTMLDivElement>(null);
    const hiddenOverflowRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Subscribe to transaction changes to update active button states
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

    // Handle clicks outside the overflow dropdown to close it
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const isCompact = mode === 'compact';
    const iconSize = mobile ? 20 : 16;
    const btnPadding = mobile ? "p-2.5" : "p-1.5";

    const items: ToolbarItem[] = !editor ? [] : [
        {
            type: 'button',
            id: 'bold',
            icon: Bold,
            label: "Bold",
            action: () => toggleSmartMark(editor, 'bold'),
            isActive: editor.isActive('bold'),
            showInCompact: true
        },
        {
            type: 'button',
            id: 'italic',
            icon: Italic,
            label: "Italic",
            action: () => toggleSmartMark(editor, 'italic'),
            isActive: editor.isActive('italic'),
            showInCompact: true
        },
        {
            type: 'button',
            id: 'highlight',
            icon: Highlighter,
            label: "Highlight",
            action: () => toggleSmartMark(editor, 'highlight'),
            isActive: editor.isActive('highlight'),
            showInCompact: true
        },
        { type: 'divider', id: 'div1', showInCompact: false },
        {
            type: 'button',
            id: 'heading1',
            icon: Heading1,
            label: "Heading 1",
            action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
            isActive: editor.isActive('heading', { level: 1 }),
            showInCompact: false
        },
        {
            type: 'button',
            id: 'heading2',
            icon: Heading2,
            label: "Heading 2",
            action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
            isActive: editor.isActive('heading', { level: 2 }),
            showInCompact: false
        },
        {
            type: 'button',
            id: 'heading3',
            icon: Heading3,
            label: "Heading 3",
            action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
            isActive: editor.isActive('heading', { level: 3 }),
            showInCompact: false
        },
        { type: 'divider', id: 'div2', showInCompact: false },
        {
            type: 'button',
            id: 'bulletList',
            icon: List,
            label: "Bullet List",
            action: () => editor.chain().focus().toggleBulletList().run(),
            isActive: editor.isActive('bulletList'),
            showInCompact: false
        },
        {
            type: 'button',
            id: 'taskList',
            icon: CheckSquare,
            label: "Task List",
            action: () => editor.chain().focus().toggleTaskList().run(),
            isActive: editor.isActive('taskList'),
            showInCompact: false
        },
        { type: 'divider', id: 'div3', showInCompact: false },
        {
            type: 'button',
            id: 'blockquote',
            icon: Quote,
            label: "Quote",
            action: () => editor.chain().focus().toggleBlockquote().run(),
            isActive: editor.isActive('blockquote'),
            showInCompact: false
        },
        {
            type: 'button',
            id: 'codeBlock',
            icon: Code,
            label: "Code Block",
            action: () => editor.chain().focus().toggleCodeBlock().run(),
            isActive: editor.isActive('codeBlock'),
            showInCompact: false
        },
        { type: 'divider', id: 'div4', showInCompact: false },
        {
            type: 'button',
            id: 'table',
            icon: Table,
            label: "Insert Table",
            action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
            isActive: editor.isActive('table'),
            showInCompact: false
        },
        { type: 'divider', id: 'div5', showInCompact: true },
        {
            type: 'button',
            id: 'link',
            icon: LinkIcon,
            label: "Link",
            action: () => {
                if (onLinkClick) {
                    onLinkClick();
                } else {
                    const previousUrl = editor.getAttributes('link').href;
                    const url = window.prompt('URL', previousUrl);
                    if (url === null) return;
                    if (url === '') {
                        editor.chain().focus().extendMarkRange('link').unsetLink().run();
                        return;
                    }
                    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
                }
            },
            isActive: editor.isActive('link'),
            showInCompact: true
        },
        {
            type: 'button',
            id: 'image',
            icon: ImageIcon,
            label: "Image",
            action: () => {
                if (onImageClick) {
                    onImageClick();
                } else {
                    const url = window.prompt('Image URL');
                    if (url) {
                        editor.chain().focus().setImage({ src: url }).run();
                    }
                }
            },
            isActive: editor.isActive('image'),
            showInCompact: true
        }
    ];

    const filteredItems = items.filter(item => !isCompact || item.showInCompact);

    // Dynamic width calculation effect
    useLayoutEffect(() => {
        if (!containerRef.current || !hiddenContainerRef.current || !hiddenOverflowRef.current) return;

        let parent = containerRef.current.parentElement;
        if (parent && parent.classList.contains('md:w-fit')) {
            parent = parent.parentElement;
        }
        if (!parent) return;

        const observer = new ResizeObserver((entries) => {
            for (let entry of entries) {
                const containerWidth = entry.contentRect.width - 24;
                const hiddenChildren = Array.from(hiddenContainerRef.current!.children) as HTMLElement[];
                const overflowBtnWidth = hiddenOverflowRef.current!.getBoundingClientRect().width;

                if (hiddenChildren.length === 0) return;

                const gap = 4;
                let totalWidth = 0;
                let fitCount = 0;

                const childWidths = hiddenChildren.map(c => c.getBoundingClientRect().width);

                for (let i = 0; i < hiddenChildren.length; i++) {
                    const itemWidth = childWidths[i];
                    const nextTotal = totalWidth + itemWidth + (i > 0 ? gap : 0);

                    if (nextTotal <= containerWidth) {
                        totalWidth = nextTotal;
                        fitCount++;
                    } else {
                        break;
                    }
                }

                if (fitCount < hiddenChildren.length) {
                    totalWidth = 0;
                    fitCount = 0;
                    for (let i = 0; i < hiddenChildren.length; i++) {
                        const itemWidth = childWidths[i];
                        const nextTotal = totalWidth + itemWidth + (i > 0 ? gap : 0);

                        if (nextTotal + overflowBtnWidth + gap <= containerWidth) {
                            totalWidth = nextTotal;
                            fitCount++;
                        } else {
                            break;
                        }
                    }
                }

                setVisibleCount(fitCount);
            }
        });

        observer.observe(parent);
        return () => observer.disconnect();
    }, [filteredItems.length]);

    const visibleItems = filteredItems.slice(0, visibleCount);
    const overflowItems = filteredItems.slice(visibleCount);

    return {
        isCompact,
        iconSize,
        btnPadding,
        visibleItems,
        overflowItems,
        filteredItems,
        isDropdownOpen,
        setIsDropdownOpen,
        containerRef,
        hiddenContainerRef,
        hiddenOverflowRef,
        dropdownRef
    };
}

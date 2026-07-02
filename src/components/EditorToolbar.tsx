import React from 'react';
import type { Editor } from '@tiptap/react';
import {
    Bold,
    Italic,
    Heading1,
    Heading2,
    Heading3,
    List,
    CheckSquare,
    Quote,
    Code,
    Table,
    Highlighter,
    Link as LinkIcon,
    Image as ImageIcon,
    MoreHorizontal,
    type LucideIcon
} from 'lucide-react';
import clsx from 'clsx';
import { toggleSmartMark } from '../utils/editor';

interface ToolbarButtonProps {
    icon: LucideIcon;
    label: string;
    action: () => void;
    isActive?: boolean;
    iconSize?: number;
    btnPadding?: string;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({ icon: Icon, label, action, isActive, iconSize = 16, btnPadding = "p-1.5" }) => (
    <button
        onMouseDown={(e) => {
            e.preventDefault();
        }}
        onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            action();
        }}
        className={clsx(
            "rounded-md transition-colors flex items-center justify-center shrink-0",
            btnPadding,
            isActive
                ? "bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400"
                : "text-gray-500 dark:text-gray-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400"
        )}
        title={label}
    >
        <Icon size={iconSize} strokeWidth={2.5} />
    </button>
);

interface EditorToolbarProps {
    editor: Editor | null;
    mode?: 'full' | 'compact';
    onLinkClick?: () => void;
    onImageClick?: () => void;
    mobile?: boolean;
}

interface ToolbarItem {
    type: 'button' | 'divider';
    id: string;
    icon?: LucideIcon;
    label?: string;
    action?: () => void;
    isActive?: boolean;
    showInCompact?: boolean;
}

/**
 * EditorToolbar Component
 * A floating formatting bar for the Tiptap editor.
 * Features:
 * - Basic formatting (Bold, Italic, Highlight)
 * - Headings and Lists
 * - Advanced items (Blockquote, Code, Table)
 * - Custom Modal integration for Links and Images
 * - Responsive "Compact" vs "Full" modes
 * - Dynamic overflow calculation collapsing hidden items into a 3-dot dropdown
 */
export const EditorToolbar: React.FC<EditorToolbarProps> = ({ editor, mode = 'full', onLinkClick, onImageClick, mobile = false }) => {
    /**
     * --- FORCED UPDATES ---
     * Tiptap's internal state (selection, isActive) doesn't always trigger React re-renders.
     * We subscribe to 'transaction' to ensure the toolbar buttons reflect the current formatting.
     */
    const [, setUpdateCount] = React.useState(0);

    React.useEffect(() => {
        if (!editor) return;

        const updateHandler = () => {
            setUpdateCount(prev => prev + 1);
        };

        editor.on('transaction', updateHandler);

        return () => {
            editor.off('transaction', updateHandler);
        };
    }, [editor]);

    const containerRef = React.useRef<HTMLDivElement>(null);
    const hiddenContainerRef = React.useRef<HTMLDivElement>(null);
    const hiddenOverflowRef = React.useRef<HTMLDivElement>(null);

    const [visibleCount, setVisibleCount] = React.useState<number>(99);
    const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
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

    if (!editor) return null;

    const isCompact = mode === 'compact';
    const iconSize = mobile ? 20 : 16;
    const btnPadding = mobile ? "p-2.5" : "p-1.5";

    const items: ToolbarItem[] = [
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

    React.useLayoutEffect(() => {
        if (!containerRef.current || !hiddenContainerRef.current || !hiddenOverflowRef.current) return;

        const parent = containerRef.current.parentElement;
        if (!parent) return;

        const observer = new ResizeObserver((entries) => {
            for (let entry of entries) {
                // available width is parent's content width minus small padding offset (24px)
                const containerWidth = entry.contentRect.width - 24;
                const hiddenChildren = Array.from(hiddenContainerRef.current!.children) as HTMLElement[];
                const overflowBtnWidth = hiddenOverflowRef.current!.getBoundingClientRect().width;
                
                if (hiddenChildren.length === 0) return;

                const gap = 4; // gap-1 is 4px
                let totalWidth = 0;
                let fitCount = 0;

                for (let i = 0; i < hiddenChildren.length; i++) {
                    const itemWidth = hiddenChildren[i].getBoundingClientRect().width;
                    const nextTotal = totalWidth + itemWidth + (i > 0 ? gap : 0);

                    if (nextTotal <= containerWidth) {
                        totalWidth = nextTotal;
                        fitCount++;
                    } else {
                        break;
                    }
                }

                // If items overflow, reserve space for the 3-dot menu button
                if (fitCount < hiddenChildren.length) {
                    totalWidth = 0;
                    fitCount = 0;
                    for (let i = 0; i < hiddenChildren.length; i++) {
                        const itemWidth = hiddenChildren[i].getBoundingClientRect().width;
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

    return (
        <div className="relative w-full md:w-fit max-w-[calc(100vw-2rem)] shrink-0">
            {/* Hidden measuring container */}
            <div
                ref={hiddenContainerRef}
                className="absolute top-0 left-0 flex items-center gap-1 p-1 invisible pointer-events-none"
            >
                {filteredItems.map(item => {
                    if (item.type === 'divider') {
                        return <div key={item.id} className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5 shrink-0" />;
                    }
                    return (
                        <ToolbarButton
                            key={item.id}
                            icon={item.icon!}
                            label={item.label!}
                            action={item.action!}
                            isActive={item.isActive}
                            iconSize={iconSize}
                            btnPadding={btnPadding}
                        />
                    );
                })}
            </div>

            {/* Hidden overflow button to measure its size */}
            <div
                ref={hiddenOverflowRef}
                className="absolute top-0 left-0 invisible pointer-events-none p-1"
            >
                <button className={clsx("rounded-md", btnPadding)}>
                    <MoreHorizontal size={iconSize} />
                </button>
            </div>

            {/* Visible Container */}
            <div
                ref={containerRef}
                className={clsx(
                    "flex items-center gap-1 p-1 shadow-xl border border-gray-200 dark:border-gray-700 rounded-lg animate-in fade-in zoom-in duration-200 w-full",
                    isCompact ? "bg-opacity-90 backdrop-blur-sm" : ""
                )}
                style={{ backgroundColor: 'var(--app-bg)' }}
            >
                {visibleItems.map(item => {
                    if (item.type === 'divider') {
                        return <div key={item.id} className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5 shrink-0" />;
                    }
                    return (
                        <ToolbarButton
                            key={item.id}
                            icon={item.icon!}
                            label={item.label!}
                            action={item.action!}
                            isActive={item.isActive}
                            iconSize={iconSize}
                            btnPadding={btnPadding}
                        />
                    );
                })}

                {overflowItems.length > 0 && (
                    <div className="relative ml-auto shrink-0">
                        <button
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className={clsx(
                                "rounded-md transition-colors flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400",
                                btnPadding,
                                isDropdownOpen && "bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400"
                            )}
                            title="More Options"
                        >
                            <MoreHorizontal size={iconSize} strokeWidth={2.5} />
                        </button>
                        {isDropdownOpen && (
                            <div
                                ref={dropdownRef}
                                className="absolute bottom-full right-0 mb-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl min-w-[150px] z-50 flex flex-col gap-0.5 animate-in fade-in slide-in-from-bottom-2 duration-150"
                                style={{ backgroundColor: 'var(--app-bg)' }}
                            >
                                {overflowItems.map(item => {
                                    if (item.type === 'divider') {
                                        return <div key={item.id} className="h-px bg-gray-250 dark:bg-gray-700 my-1 mx-2" />;
                                    }
                                    const Icon = item.icon!;
                                    return (
                                        <button
                                            key={item.id}
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                item.action!();
                                                setIsDropdownOpen(false);
                                            }}
                                            className={clsx(
                                                "flex items-center gap-2 px-3 py-1.5 text-sm text-left w-full transition-colors rounded-md",
                                                item.isActive
                                                    ? "bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400 font-medium"
                                                    : "text-gray-500 dark:text-gray-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400"
                                            )}
                                        >
                                            <Icon size={14} />
                                            <span className="truncate">{item.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

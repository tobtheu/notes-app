import type { Editor } from '@tiptap/react';
import {
    Bold, Italic, Heading1, Heading2, Heading3, List, CheckSquare,
    Quote, Code, Table, Highlighter, Link as LinkIcon,
    type LucideIcon
} from 'lucide-react';
import { toggleSmartMark } from './editor';

export interface ToolbarItem {
    type: 'button' | 'divider';
    id: string;
    icon?: LucideIcon;
    label?: string;
    action?: () => void;
    isActive?: boolean;
    showInCompact?: boolean;
}

export interface BuildToolbarItemsOptions {
    editor: Editor | null;
    onLinkClick?: () => void;
}

export function buildToolbarItems({
    editor,
    onLinkClick,
}: BuildToolbarItemsOptions): ToolbarItem[] {
    if (!editor) return [];

    return [
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
        }
    ];
}

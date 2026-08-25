import { ReactNodeViewRenderer, mergeAttributes } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import Heading from '@tiptap/extension-heading';
import { common, createLowlight } from 'lowlight';

import { TableNode } from '../components/TableNode';
import { CodeBlockComponent } from '../components/CodeBlockComponent';
import { SlashCommands } from './SlashCommands';

const lowlight = createLowlight(common);

export const EDITOR_EXTENSIONS = [
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
    Table.extend({ addNodeView() { return ReactNodeViewRenderer(TableNode); } }).configure({ resizable: true }),
    TableRow, TableHeader, TableCell,
    Placeholder.configure({ placeholder: "Type '/' for commands..." }),
];

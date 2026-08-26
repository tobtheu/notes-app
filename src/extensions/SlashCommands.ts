import { Extension, ReactRenderer } from '@tiptap/react';
import Suggestion from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import tippy, { type Instance } from 'tippy.js';
import {
    Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare, Quote, Minus,
    Code as CodeIcon, Table as TableIcon, Link as LinkIcon
} from 'lucide-react';
import { SlashMenu } from '../components/SlashMenu';
import { translate } from '../i18n';

export const getSlashCommandItems = () => [
    { title: translate('editor.heading1'), icon: Heading1, command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run() },
    { title: translate('editor.heading2'), icon: Heading2, command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run() },
    { title: translate('editor.heading3'), icon: Heading3, command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run() },
    { title: translate('editor.bulletList'), icon: List, command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).toggleBulletList().run() },
    { title: translate('editor.numberedList'), icon: ListOrdered, command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).toggleOrderedList().run() },
    { title: translate('editor.taskList'), icon: CheckSquare, command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).toggleTaskList().run() },
    { title: translate('editor.table'), icon: TableIcon, command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { title: translate('editor.quote'), icon: Quote, command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).toggleBlockquote().run() },
    { title: translate('editor.codeBlock'), icon: CodeIcon, command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run() },
    {
        title: translate('editor.link'), icon: LinkIcon, command: ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).run();
            // Trigger link modal via custom event (handled in MarkdownEditor)
            window.dispatchEvent(new CustomEvent('tiptap:openLinkModal'));
        }
    },
    { title: translate('editor.divider'), icon: Minus, command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).setHorizontalRule().run() },
];

export const items = getSlashCommandItems();

export const SlashCommands = Extension.create({
    name: 'slashCommands',
    addProseMirrorPlugins() {
        return [
            Suggestion({
                editor: this.editor,
                char: '/',
                pluginKey: new PluginKey('slashCommands'),
                startOfLine: true,
                allow: ({ state, range }) => {
                    const $from = state.doc.resolve(range.from);

                    // Do not trigger inside lists (bullet, ordered, task), code blocks, or tables
                    for (let d = $from.depth; d > 0; d--) {
                        const typeName = $from.node(d).type.name;
                        if ([
                            'listItem',
                            'taskItem',
                            'bulletList',
                            'orderedList',
                            'taskList',
                            'codeBlock',
                            'code_block',
                            'table',
                            'tableCell',
                            'tableHeader',
                            'tableRow',
                        ].includes(typeName)) {
                            return false;
                        }
                    }

                    // Only trigger if at the very beginning of the parent block or after a hard break
                    if ($from.parentOffset === 0) {
                        return true;
                    }

                    if ($from.nodeBefore?.type.name === 'hardBreak') {
                        return true;
                    }

                    // Preceding text on this line must be whitespace only
                    const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\n');
                    return textBefore.trim() === '';
                },
                command: ({ editor, range, props }: any) => {
                    props.command({ editor, range });
                },
                items: ({ query }: { query: string }) => {
                    const q = (query || '').toLowerCase();
                    return getSlashCommandItems().filter(item => (item.title || '').toLowerCase().startsWith(q));
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
                            component?.destroy();
                        },
                    };
                },
            }),
        ];
    },
});

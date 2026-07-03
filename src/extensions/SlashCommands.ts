import { Extension, ReactRenderer } from '@tiptap/react';
import Suggestion from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import tippy, { type Instance } from 'tippy.js';
import {
    Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare, Quote, Minus,
    Code as CodeIcon, Table as TableIcon, Link as LinkIcon
} from 'lucide-react';
import { SlashMenu } from '../components/SlashMenu';

export const items = [
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

export const SlashCommands = Extension.create({
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
                            component?.destroy();
                        },
                    };
                },
            }),
        ];
    },
});

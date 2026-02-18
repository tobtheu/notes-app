
import React, { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { useEditor, EditorContent, ReactRenderer, Extension } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import BubbleMenuExtension from '@tiptap/extension-bubble-menu';
import Suggestion from '@tiptap/suggestion';
import tippy, { type Instance } from 'tippy.js';
import { EditorToolbar } from './EditorToolbar';
import { Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare, Quote, Minus, Code as CodeIcon } from 'lucide-react';

interface MarkdownEditorProps {
    content: string;
    onChange: (markdown: string) => void;
}

// suggestion items definition
const items = [
    { title: 'Heading 1', icon: Heading1, command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run() },
    { title: 'Heading 2', icon: Heading2, command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run() },
    { title: 'Heading 3', icon: Heading3, command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run() },
    { title: 'Bullet List', icon: List, command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).toggleBulletList().run() },
    { title: 'Ordered List', icon: ListOrdered, command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).toggleOrderedList().run() },
    { title: 'Task List', icon: CheckSquare, command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).toggleTaskList().run() },
    { title: 'Blockquote', icon: Quote, command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).toggleBlockquote().run() },
    { title: 'Code Block', icon: CodeIcon, command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run() },
    { title: 'Divider', icon: Minus, command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).setHorizontalRule().run() },
];

const SlashMenu = forwardRef((props: any, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const containerRef = React.useRef<HTMLDivElement>(null);

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
        <div ref={containerRef} className="bg-white dark:bg-gray-800 shadow-2xl rounded-xl border border-gray-200 dark:border-gray-700 p-1.5 min-w-[220px] max-h-[300px] overflow-y-auto z-50 overflow-hidden custom-scrollbar">
            <div className="text-[10px] text-gray-400 p-2 font-black uppercase tracking-widest opacity-60">Add Block</div>
            {props.items.map((item: any, index: number) => (
                <button
                    key={index}
                    onClick={() => selectItem(index)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center gap-3 group transition-all ${index === selectedIndex
                        ? 'bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                >
                    <div className={`w-8 h-8 flex-shrink-0 rounded-md flex items-center justify-center font-bold transition-colors ${index === selectedIndex
                        ? 'bg-primary-100 dark:bg-primary-800 text-primary-600 dark:text-primary-200'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                        }`}>
                        <item.icon size={16} />
                    </div>
                    <span className="font-semibold">{item.title}</span>
                </button>
            ))}
        </div>
    );
});

SlashMenu.displayName = 'SlashMenu';

// Define a separate extension for the commands logic
const Commands = Extension.create({
    name: 'commands',
    addProseMirrorPlugins() {
        return [
            Suggestion({
                editor: this.editor,
                char: '/',
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

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ content, onChange }) => {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Markdown,
            TaskList,
            TaskItem.configure({
                nested: true,
            }),
            Placeholder.configure({
                placeholder: "Type '/' for commands...",
            }),
            BubbleMenuExtension.configure({
                pluginKey: 'bubbleMenu',
            }),
            Commands,
        ],
        content: content,
        onUpdate: ({ editor }) => {
            const markdown = (editor.storage as any).markdown.getMarkdown();
            onChange(markdown);
        },
        editorProps: {
            attributes: {
                class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-[300px] pb-32',
            },
        },
    });

    useEffect(() => {
        if (editor && content !== (editor.storage as any).markdown.getMarkdown()) {
            editor.commands.setContent(content);
        }
    }, [content, editor]);

    if (!editor) {
        return null;
    }

    return (
        <div className="tiptap-wrapper relative flex-1 flex flex-col px-8 py-4 overflow-y-auto custom-scrollbar">
            <BubbleMenu
                editor={editor}
                options={{
                    placement: 'top',
                    offset: 10
                }}
                shouldShow={({ editor }) => {
                    return !editor.state.selection.empty && editor.isFocused;
                }}
            >
                <EditorToolbar editor={editor} />
            </BubbleMenu>

            <EditorContent editor={editor} className="flex-1" />
        </div>
    );
};

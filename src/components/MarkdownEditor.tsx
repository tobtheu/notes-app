
import React, { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { useEditor, EditorContent, ReactRenderer, Extension } from '@tiptap/react';
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
import Suggestion from '@tiptap/suggestion';
import tippy, { type Instance } from 'tippy.js';
import clsx from 'clsx';
import { EditorToolbar } from './EditorToolbar';
import {
    Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare, Quote, Minus,
    Code as CodeIcon, Table as TableIcon, Trash2, ArrowUp, ArrowDown,
    ArrowLeft, ArrowRight, Layout, GripVertical, Plus
} from 'lucide-react';

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
    { title: 'Table', icon: TableIcon, command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
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
        <div ref={containerRef} className="bg-white dark:bg-gray-800 shadow-2xl rounded-xl border border-gray-200 dark:border-gray-700 p-1.5 min-w-[220px] max-h-[300px] overflow-y-auto z-[1000] overflow-hidden custom-scrollbar">
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

const TableActionsMenu = ({ editor }: { editor: any }) => {
    if (!editor) return null;

    return (
        <div className="flex flex-col bg-white dark:bg-gray-800 shadow-2xl rounded-xl border border-gray-200 dark:border-gray-700 p-1.5 min-w-[180px] animate-in fade-in zoom-in duration-200">
            <div className="text-[10px] text-gray-400 p-2 font-black uppercase tracking-widest opacity-60">Table Actions</div>

            <div className="grid grid-cols-1 gap-1">
                <div className="flex items-center gap-1 p-1 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                    <button
                        onClick={() => editor.chain().focus().addRowBefore().run()}
                        className="flex-1 flex items-center gap-2 px-2 py-1.5 hover:bg-white dark:hover:bg-gray-600 rounded shadow-sm text-sm text-gray-700 dark:text-gray-200 transition-all"
                    >
                        <ArrowUp size={14} /> Row Above
                    </button>
                    <button
                        onClick={() => editor.chain().focus().addRowAfter().run()}
                        className="flex-1 flex items-center gap-2 px-2 py-1.5 hover:bg-white dark:hover:bg-gray-600 rounded shadow-sm text-sm text-gray-700 dark:text-gray-200 transition-all"
                    >
                        <ArrowDown size={14} /> Row Below
                    </button>
                </div>

                <div className="flex items-center gap-1 p-1 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                    <button
                        onClick={() => editor.chain().focus().addColumnBefore().run()}
                        className="flex-1 flex items-center gap-2 px-2 py-1.5 hover:bg-white dark:hover:bg-gray-600 rounded shadow-sm text-sm text-gray-700 dark:text-gray-200 transition-all"
                    >
                        <ArrowLeft size={14} /> Col Left
                    </button>
                    <button
                        onClick={() => editor.chain().focus().addColumnAfter().run()}
                        className="flex-1 flex items-center gap-2 px-2 py-1.5 hover:bg-white dark:hover:bg-gray-600 rounded shadow-sm text-sm text-gray-700 dark:text-gray-200 transition-all"
                    >
                        <ArrowRight size={14} /> Col Right
                    </button>
                </div>

                <div className="w-full h-px bg-gray-100 dark:bg-gray-700 my-1" />

                <button
                    onClick={() => editor.chain().focus().toggleHeaderRow().run()}
                    className={clsx(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                        editor.isActive('table', { withHeaderRow: true })
                            ? "bg-primary-50 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300"
                            : "hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                    )}
                >
                    <Layout size={14} /> Header Row
                </button>

                <div className="w-full h-px bg-gray-100 dark:bg-gray-700 my-1" />

                <button
                    onClick={() => editor.chain().focus().deleteRow().run()}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg text-sm transition-all"
                >
                    <Trash2 size={14} /> Delete Row
                </button>
                <button
                    onClick={() => editor.chain().focus().deleteColumn().run()}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg text-sm transition-all"
                >
                    <Trash2 size={14} /> Delete Column
                </button>
                <button
                    onClick={() => editor.chain().focus().deleteTable().run()}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 rounded-lg text-sm font-bold transition-all mt-1"
                >
                    <TableIcon size={14} /> Delete Table
                </button>
            </div>
        </div>
    );
};

const TableGripHandle = ({ editor }: { editor: any }) => {
    const [menuOpen, setMenuOpen] = useState(false);

    if (!editor) return null;

    return (
        <div className="relative group">
            <button
                onClick={() => setMenuOpen(!menuOpen)}
                className={clsx(
                    "p-1 rounded-md bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-primary-500 hover:border-primary-300 transition-all flex items-center justify-center",
                    menuOpen && "text-primary-600 border-primary-400 shadow-md ring-2 ring-primary-500/20"
                )}
                title="Table Settings"
            >
                <GripVertical size={16} />
            </button>

            {menuOpen && (
                <div
                    className="absolute left-[calc(100%+8px)] top-0 z-[1001]"
                    onMouseLeave={() => setMenuOpen(false)}
                >
                    <TableActionsMenu editor={editor} />
                </div>
            )}
        </div>
    );
};

const AddRowHandle = ({ editor }: { editor: any }) => {
    if (!editor) return null;
    return (
        <button
            onClick={() => editor.chain().focus().addRowAfter().run()}
            className="p-1 rounded-full bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/40 hover:border-primary-300 transition-all flex items-center justify-center translate-y-1"
            title="Add Row Below"
        >
            <Plus size={14} />
        </button>
    );
};

const AddColumnHandle = ({ editor }: { editor: any }) => {
    if (!editor) return null;
    return (
        <button
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            className="p-1 rounded-full bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/40 hover:border-primary-300 transition-all flex items-center justify-center translate-x-1"
            title="Add Column Right"
        >
            <Plus size={14} />
        </button>
    );
};

// Define a separate extension for the slash commands logic
const SlashCommands = Extension.create({
    name: 'slashCommands',
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

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ content, onChange }) => {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Markdown,
            TaskList,
            TaskItem.configure({
                nested: true,
            }),
            Highlight.configure({
                multicolor: true,
            }),
            Table.configure({
                resizable: true,
            }),
            TableRow,
            TableHeader,
            TableCell,
            Placeholder.configure({
                placeholder: "Type '/' for commands...",
            }),
            SlashCommands,
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
        <div className="tiptap-wrapper relative flex-1 flex flex-col min-h-0">
            <style dangerouslySetInnerHTML={{
                __html: `
                .ProseMirror table {
                    border-collapse: collapse;
                    table-layout: fixed;
                    width: 100%;
                    margin: 0;
                    overflow: hidden;
                }
                .ProseMirror td, .ProseMirror th {
                    min-width: 1em;
                    border: 1px solid #ddd;
                    padding: 3px 5px;
                    vertical-align: top;
                    box-sizing: border-box;
                    position: relative;
                }
                .dark .ProseMirror td, .dark .ProseMirror th {
                    border-color: #374151;
                }
                .ProseMirror th {
                    font-weight: bold;
                    text-align: left;
                    background-color: #f9fafb;
                }
                .dark .ProseMirror th {
                    background-color: #1f2937;
                }
                .ProseMirror .selectedCell:after {
                    z-index: 2;
                    position: absolute;
                    content: "";
                    left: 0; right: 0; top: 0; bottom: 0;
                    background: rgba(200, 200, 255, 0.4);
                    pointer-events: none;
                }
                .ProseMirror .column-resize-handle {
                    position: absolute;
                    right: -2px;
                    top: 0;
                    bottom: 0;
                    width: 4px;
                    z-index: 20;
                    background-color: #adf;
                    pointer-events: none;
                }
                .tableWrapper {
                    overflow-x: auto;
                }
                .resize-cursor {
                    cursor: ew-resize;
                    cursor: col-resize;
                }
            `}} />
            {editor && (
                <div className="sticky top-0 z-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 px-8 py-2 mb-4 shrink-0 -mx-8">
                    <EditorToolbar editor={editor} />
                </div>
            )}
            <div className="flex-1 flex flex-col relative px-8 py-4 overflow-y-auto custom-scrollbar">
                <BubbleMenu
                    editor={editor}
                    pluginKey="text-bubble-menu"
                    shouldShow={({ state }: any) => {
                        return !state.selection.empty;
                    }}
                >
                    <EditorToolbar editor={editor} mode="compact" />
                </BubbleMenu>

                <BubbleMenu
                    editor={editor}
                    pluginKey="table-grip-menu"
                    shouldShow={({ editor: innerEditor }: any) => {
                        return innerEditor.isActive('table');
                    }}
                    {...({
                        tippyOptions: {
                            placement: 'left-start',
                            offset: [-15, -15],
                            animation: 'shift-away',
                        }
                    } as any)}
                >
                    <TableGripHandle editor={editor} />
                </BubbleMenu>

                <BubbleMenu
                    editor={editor}
                    pluginKey="table-row-add-menu"
                    shouldShow={({ editor: innerEditor }: any) => {
                        return innerEditor.isActive('table');
                    }}
                    {...({
                        tippyOptions: {
                            placement: 'bottom',
                            offset: [0, 15],
                        }
                    } as any)}
                >
                    <AddRowHandle editor={editor} />
                </BubbleMenu>

                <BubbleMenu
                    editor={editor}
                    pluginKey="table-col-add-menu"
                    shouldShow={({ editor: innerEditor }: any) => {
                        return innerEditor.isActive('table');
                    }}
                    {...({
                        tippyOptions: {
                            placement: 'right',
                            offset: [15, 0],
                        }
                    } as any)}
                >
                    <AddColumnHandle editor={editor} />
                </BubbleMenu>

                <EditorContent editor={editor} className="flex-1" />
            </div>
        </div>
    );
};


import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx, editorViewCtx, serializerCtx } from '@milkdown/core';
import { Selection, TextSelection, Plugin, PluginKey } from '@milkdown/prose/state';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { Milkdown, useEditor, MilkdownProvider, useInstance } from '@milkdown/react';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { history } from '@milkdown/plugin-history';
import { indent } from '@milkdown/plugin-indent';
import { trailing } from '@milkdown/plugin-trailing';
import { cursor } from '@milkdown/plugin-cursor';
import { replaceAll } from '@milkdown/utils';
import { block, BlockProvider } from '@milkdown/plugin-block';
import { slashFactory, SlashProvider } from '@milkdown/plugin-slash';
import { prism, prismConfig } from '@milkdown/plugin-prism';
import css from 'refractor/css';
import javascript from 'refractor/javascript';
import typescript from 'refractor/typescript';
import jsx from 'refractor/jsx';
import tsx from 'refractor/tsx';
import markdown from 'refractor/markdown';
import python from 'refractor/python';
import java from 'refractor/java';
import bash from 'refractor/bash';
import json from 'refractor/json';
import { ProsemirrorAdapterProvider, usePluginViewFactory, usePluginViewContext, useNodeViewContext, useNodeViewFactory } from '@prosemirror-adapter/react';
import { wrapIn, setBlockType } from '@milkdown/prose/commands';

interface MarkdownEditorProps {
    content: string;
    onChange: (markdown: string) => void;
}

const BlockHandle: React.FC = () => {
    const { view } = usePluginViewContext();

    return (
        <div className="milkdown-block-handle flex flex-row gap-0.5 items-center p-0.5 group z-30">
            <button
                className="text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-gray-800 p-1 rounded transition-colors cursor-pointer"
                title="Add block"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;

                    const posAtCoords = view.posAtCoords({ left: centerX + 60, top: centerY });
                    if (!posAtCoords) return;

                    const { state, dispatch } = view;
                    const $pos = state.doc.resolve(posAtCoords.pos);

                    // Force breakout: always find depth 0 position (after top-level node)
                    // If we are inside depth 1 (Quote/List), we go after it.
                    const depth = $pos.depth;
                    const pos = depth > 0 ? $pos.after(1) : $pos.after(0);

                    const { tr, schema } = state;
                    const newTr = tr.insert(pos, schema.nodes.paragraph.create(null, schema.text('/')));

                    const nextSelection = TextSelection.create(newTr.doc, pos + 2);

                    view.focus();
                    dispatch(newTr.setSelection(nextSelection).scrollIntoView());
                }}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
                </svg>
            </button>
            <div
                className="text-gray-300 hover:text-gray-600 dark:hover:text-gray-100 cursor-grab active:cursor-grabbing p-1"
                title="Drag to reorder"
                draggable="true"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
                </svg>
            </div>
        </div>
    );
};

const SlashMenu: React.FC = () => {
    const [loading, getEditor] = useInstance();
    const [selectedIndex, setSelectedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const menuItems = useMemo(() => [
        { id: 'h1', label: 'Heading 1', desc: 'Large header', icon: 'H1' },
        { id: 'h2', label: 'Heading 2', desc: 'Medium header', icon: 'H2' },
        { id: 'h3', label: 'Heading 3', desc: 'Small header', icon: 'H3' },
        { id: 'bullet', label: 'Bullet List', desc: 'Simple bulleted list', icon: '•' },
        { id: 'ordered', label: 'Ordered List', desc: 'Numbered list', icon: '1.' },
        { id: 'todo', label: 'To-do List', desc: 'Track tasks', icon: '☑' },
        { id: 'table', label: 'Table', desc: 'Insert a table', icon: '▦' },
        { id: 'quote', label: 'Quote', desc: 'Capture a quote', icon: '"' },
        { id: 'divider', label: 'Divider', desc: 'Visual separation', icon: '—' },
        { id: 'code', label: 'Code Block', desc: 'Code with highlighting', icon: '</>' },
    ], []);

    const handleCommand = useCallback((type: string) => {
        if (loading) return;
        const editor = getEditor();
        if (!editor) return;

        editor.action((ctx) => {
            const view = ctx.get(editorViewCtx);
            const { state, dispatch } = view;
            const { selection, schema } = state;
            const { $from } = selection;

            // 1. Delete the slash if it's there
            if ($from.parent.textContent.startsWith('/') && $from.parentOffset === 1) {
                dispatch(state.tr.delete($from.start(), $from.pos));
            }

            // 2. Execute the block command on the next frame to ensure state is synchronized
            editor.action((innerCtx) => {
                const innerView = innerCtx.get(editorViewCtx);
                const innerState = innerView.state;

                if (type === 'h1') {
                    setBlockType(schema.nodes.heading, { level: 1 })(innerState, innerView.dispatch);
                } else if (type === 'h2') {
                    setBlockType(schema.nodes.heading, { level: 2 })(innerState, innerView.dispatch);
                } else if (type === 'h3') {
                    setBlockType(schema.nodes.heading, { level: 3 })(innerState, innerView.dispatch);
                } else if (type === 'bullet') {
                    wrapIn(schema.nodes.bullet_list)(innerState, innerView.dispatch);
                } else if (type === 'ordered') {
                    wrapIn(schema.nodes.ordered_list)(innerState, innerView.dispatch);
                } else if (type === 'todo') {
                    // Check if task_list_item exists
                    const listItemType = schema.nodes.task_list_item || schema.nodes.list_item;
                    if (listItemType && schema.nodes.bullet_list) {
                        // Create a task list structure
                        const listNode = schema.nodes.bullet_list.create(null,
                            listItemType.create({ checked: false }, schema.nodes.paragraph.create())
                        );

                        // Insert the new list
                        const { $from } = innerState.selection;
                        const insertPos = $from.pos;
                        const tr = innerState.tr.replaceSelectionWith(listNode);

                        try {
                            // Manually set selection inside the new paragraph
                            // bullet_list (start) -> list_item (start+1) -> paragraph (start+2) -> text (start+3)
                            const textPos = insertPos + 3;
                            const newSelection = TextSelection.create(tr.doc, textPos);
                            innerView.dispatch(tr.setSelection(newSelection));
                        } catch (e) {
                            innerView.dispatch(tr);
                        }
                    } else {
                        innerView.dispatch(innerState.tr.insertText('- [ ] '));
                    }
                } else if (type === 'table') {
                    if (schema.nodes.table) {
                        const table = schema.nodes.table.create(null, [
                            schema.nodes.table_row.create(null, [
                                schema.nodes.table_header.create(null, schema.text('Header')),
                                schema.nodes.table_header.create(null, schema.text('Header'))
                            ]),
                            schema.nodes.table_row.create(null, [
                                schema.nodes.table_cell.create(null, schema.text('Cell')),
                                schema.nodes.table_cell.create(null, schema.text('Cell'))
                            ])
                        ]);
                        const tr = innerState.tr.replaceSelectionWith(table);
                        const nextSelection = TextSelection.create(tr.doc, tr.selection.from + 4); // Attempt to select inside first cell
                        innerView.dispatch(tr.setSelection(nextSelection));
                    }
                } else if (type === 'quote') {
                    wrapIn(schema.nodes.blockquote)(innerState, innerView.dispatch);
                } else if (type === 'divider') {
                    const tr = innerState.tr.replaceSelectionWith(schema.nodes.horizontal_rule.create());
                    innerView.dispatch(tr);
                } else if (type === 'code') {
                    setBlockType(schema.nodes.code_block)(innerState, innerView.dispatch);
                }
            });

            // Explicitly hide the menu container after command
            const container = containerRef.current?.closest('.milkdown-slash-menu-container') as HTMLElement;
            if (container) {
                container.style.visibility = 'hidden';
                container.style.opacity = '0';
                container.dispatchEvent(new CustomEvent('slash-internal-close'));
            }
        });
    }, [loading, getEditor]);

    useEffect(() => {
        const handleKeyDownMsg = (e: any) => {
            const key = e.detail.key;
            if (key === 'ArrowDown') {
                setSelectedIndex(prev => (prev + 1) % menuItems.length);
            } else if (key === 'ArrowUp') {
                setSelectedIndex(prev => (prev - 1 + menuItems.length) % menuItems.length);
            } else if (key === 'Enter') {
                handleCommand(menuItems[selectedIndex].id);
            } else if (key === 'Escape') {
                const container = containerRef.current?.closest('.milkdown-slash-menu-container') as HTMLElement;
                if (container) {
                    container.style.visibility = 'hidden';
                    container.style.opacity = '0';
                    container.dispatchEvent(new CustomEvent('slash-internal-close'));
                }
            }
        };

        const container = containerRef.current?.closest('.milkdown-slash-menu-container');
        container?.addEventListener('slash-keydown' as any, handleKeyDownMsg);
        return () => {
            container?.removeEventListener('slash-keydown' as any, handleKeyDownMsg);
        };
    }, [handleCommand, menuItems, selectedIndex]);

    // Auto-scroll the selected item into view
    useEffect(() => {
        if (!containerRef.current) return;
        const selectedElement = containerRef.current.children[selectedIndex + 1] as HTMLElement; // +1 because of the "Add Block" div
        if (selectedElement) {
            selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [selectedIndex]);

    return (
        <div ref={containerRef} className="milkdown-slash-menu bg-white dark:bg-gray-800 shadow-2xl rounded-xl border border-gray-200 dark:border-gray-700 p-1.5 min-w-[220px] max-h-[300px] overflow-y-auto z-50 overflow-hidden custom-scrollbar">
            <div className="text-[10px] text-gray-400 p-2 font-black uppercase tracking-widest opacity-60">Add Block</div>
            {menuItems.map((item, index) => (
                <button
                    key={item.id}
                    onClick={() => handleCommand(item.id)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center gap-3 group transition-all ${index === selectedIndex
                        ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                >
                    <div className={`w-8 h-8 flex-shrink-0 rounded-md flex items-center justify-center font-bold transition-colors ${index === selectedIndex
                        ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-200'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                        }`}>
                        {item.icon}
                    </div>
                    <div>
                        <div className="font-semibold last:mb-0 leading-tight">{item.label}</div>
                        <div className="text-[10px] text-gray-400">{item.desc}</div>
                    </div>
                </button>
            ))}
        </div>
    );
};

const ListItem: React.FC = () => {
    const { node, setAttrs, contentRef } = useNodeViewContext();
    const checked = node.attrs.checked;

    if (typeof checked === 'boolean') {
        // This is a task list item
        return (
            <li className="flex flex-row items-start gap-2 my-1 relative" data-type="task-list-item" data-checked={checked}>
                <div className="select-none flex-shrink-0 mt-1.5 leading-none" contentEditable="false">
                    <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                            setAttrs({ checked: e.target.checked });
                        }}
                        className="h-4 w-4 accent-primary-600 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer transition-colors"
                    />
                </div>
                <div className="flex-1 min-w-0" ref={contentRef} />
            </li>
        );
    }

    // This is a regular list item
    return (
        <li className="my-1 relative list-item">
            <div ref={contentRef} />
        </li>
    );
};

const EditorComponent: React.FC<MarkdownEditorProps> = ({ content, onChange }) => {
    const pluginViewFactory = usePluginViewFactory();
    const nodeViewFactory = useNodeViewFactory();
    const onChangeRef = React.useRef(onChange);
    const lastMarkdownRef = React.useRef(content);

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    const slash = useMemo(() => slashFactory('DEFAULT'), []);

    const editor = useEditor((rootElement) => {
        return Editor.make()
            .use(commonmark)
            .use(gfm)
            .use(listener)
            .use(history)
            .use(indent)
            .use(trailing)
            .use(cursor)
            .use(block)
            .use(slash)
            .use(prism)
            .config((ctx) => {
                ctx.set(prismConfig.key, {
                    configureRefractor: (refractor) => {
                        refractor.register(css);
                        refractor.register(javascript);
                        refractor.register(typescript);
                        refractor.register(jsx);
                        refractor.register(tsx);
                        refractor.register(markdown);
                        refractor.register(python);
                        refractor.register(java);
                        refractor.register(bash);
                        refractor.register(json);
                    },
                });
                ctx.set(rootCtx, rootElement);
                ctx.set(defaultValueCtx, content);
                ctx.update(editorViewOptionsCtx, (prev) => ({
                    ...prev,
                    nodeViews: {
                        ...(prev.nodeViews || {}),
                        list_item: nodeViewFactory({ component: ListItem }),
                        task_list_item: nodeViewFactory({ component: ListItem })
                    },
                    plugins: [
                        ...(prev.plugins || []),
                        new Plugin({
                            key: new PluginKey('milkdown-block-handle'),
                            view: (view) => {
                                const pluginView = pluginViewFactory({ component: BlockHandle })(view);
                                const provider = new BlockProvider({
                                    ctx,
                                    content: (pluginView as any).dom as HTMLElement,
                                });
                                return {
                                    update: (view, prevState) => {
                                        pluginView.update?.(view, prevState);
                                        provider.update();
                                    },
                                    destroy: () => {
                                        pluginView.destroy?.();
                                        provider.destroy();
                                    }
                                };
                            }
                        }),
                        new Plugin({
                            key: new PluginKey('milkdown-slash-menu'),
                            view: (view) => {
                                const pluginView = pluginViewFactory({ component: SlashMenu })(view);
                                const provider = new SlashProvider({
                                    content: (pluginView as any).dom as HTMLElement,
                                });
                                return {
                                    update: (view, prevState) => {
                                        pluginView.update?.(view, prevState);
                                        provider.update(view, prevState);
                                    },
                                    destroy: () => {
                                        pluginView.destroy?.();
                                        provider.destroy();
                                    }
                                };
                            }
                        }),
                        new Plugin({
                            key: new PluginKey('milkdown-state-tracker'),
                            view: () => ({
                                update: (view) => {
                                    const { state } = view;
                                    const { selection, schema } = state;
                                    const { $from } = selection;
                                    const activeItems: string[] = [];

                                    // Check Marks
                                    const isMarkActive = (markType: any) => {
                                        if (selection.empty) {
                                            return !!(state.storedMarks?.find(m => m.type === markType) || $from.marks().find(m => m.type === markType));
                                        }
                                        return state.doc.rangeHasMark(selection.from, selection.to, markType);
                                    };

                                    if (schema.marks.strong && isMarkActive(schema.marks.strong)) activeItems.push('bold');
                                    if (schema.marks.emphasis && isMarkActive(schema.marks.emphasis)) activeItems.push('italic');
                                    if (schema.marks.code && isMarkActive(schema.marks.code)) activeItems.push('code_inline');

                                    // Check Blocks
                                    const block = $from.parent;

                                    if (block.type === schema.nodes.heading) {
                                        activeItems.push(`h${block.attrs.level}`);
                                    } else if (block.type === schema.nodes.paragraph) {
                                        activeItems.push('paragraph');
                                    } else if (block.type === schema.nodes.code_block) {
                                        activeItems.push('code_block');
                                    } else if (block.type === schema.nodes.blockquote) {
                                        activeItems.push('quote');
                                    }

                                    // Check Lists
                                    let curr: any = $from;
                                    let depth = curr.depth;
                                    while (depth > 0) {
                                        const node = curr.node(depth);
                                        if (node.type === schema.nodes.bullet_list) activeItems.push('bullet_list');
                                        if (node.type === schema.nodes.ordered_list) activeItems.push('ordered_list');
                                        if (node.type === schema.nodes.task_list_item || (node.type === schema.nodes.list_item && typeof node.attrs.checked === 'boolean')) {
                                            activeItems.push('task_list');
                                        }
                                        depth--;
                                    }

                                    window.dispatchEvent(new CustomEvent('milkdown-state-update', { detail: activeItems }));
                                }
                            })
                        })
                    ],
                    handleDOMEvents: {
                        ...(prev.handleDOMEvents || {}),
                        focus: (view) => {
                            const { state, dispatch } = view;
                            if (window.getSelection()?.type === 'Range') return false;
                            try {
                                const endPos = state.doc.content.size;
                                const $pos = state.doc.resolve(endPos);
                                const selection = Selection.findFrom($pos, -1) || Selection.atEnd(state.doc);
                                dispatch(state.tr.setSelection(selection));
                            } catch (e) { }
                            return false;
                        },
                        keydown: (view, event) => {
                            const container = rootElement.querySelector('.milkdown-slash-menu-container') as HTMLElement;
                            if (container) {
                                const style = window.getComputedStyle(container);
                                const isVisible = style.visibility !== 'hidden' && style.opacity !== '0';

                                if (isVisible) {
                                    if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) {
                                        const ev = new CustomEvent('slash-keydown', { detail: { key: event.key } });
                                        container.dispatchEvent(ev);
                                        event.preventDefault();
                                        return true;
                                    }
                                }
                            }
                            return false;
                        }
                    }
                }));

                ctx.get(listenerCtx).markdownUpdated((_, markdown, prevMarkdown) => {
                    if (markdown !== prevMarkdown) {
                        lastMarkdownRef.current = markdown;
                        onChangeRef.current(markdown);
                    }
                });
            });
    }, [pluginViewFactory, slash]);

    useEffect(() => {
        const editorRef = editor.get();
        if (!editorRef) return;

        if (content !== lastMarkdownRef.current) {
            editorRef.action((ctx) => {
                const view = ctx.get(editorViewCtx);
                const serializer = ctx.get(serializerCtx);
                const currentEditorMarkdown = serializer(view.state.doc);

                if (content !== currentEditorMarkdown) {
                    replaceAll(content)(ctx);
                    lastMarkdownRef.current = content;
                }
            });
        }
    }, [content, editor]);

    // Dynamic Block Handle Visibility
    useEffect(() => {
        const rootElement = document.querySelector('.milkdown-wrapper');
        if (!rootElement) return;

        const handleKeyDown = () => {
            rootElement.classList.add('hide-block-handle');
        };

        const handleMouseMove = () => {
            rootElement.classList.remove('hide-block-handle');
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('mousemove', handleMouseMove);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    return <Milkdown />;
};

import { EditorToolbar } from './EditorToolbar';

export const MarkdownEditor: React.FC<MarkdownEditorProps> = (props) => {
    return (
        <div className="milkdown-wrapper prose dark:prose-invert max-w-none flex-1 flex flex-col relative px-8">
            <MilkdownProvider>
                <ProsemirrorAdapterProvider>
                    <EditorToolbar />
                    <EditorComponent {...props} />
                </ProsemirrorAdapterProvider>
            </MilkdownProvider>
        </div>
    );
};

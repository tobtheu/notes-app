import React, { useCallback, useEffect, useState } from 'react';
import { useInstance } from '@milkdown/react';
import { editorViewCtx } from '@milkdown/core';
import { Bold, Italic, Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare, Quote, Code, type LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { setBlockType, toggleMark, lift } from '@milkdown/prose/commands';
import { wrapInList, liftListItem } from '@milkdown/prose/schema-list';
import { wrapInBlockquoteCommand } from '@milkdown/preset-commonmark';
import type { CmdKey } from '@milkdown/core';


interface ToolbarButtonProps {
    icon: LucideIcon;
    label: string;
    action: () => void;
    isActive?: boolean;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({ icon: Icon, label, action, isActive }) => (
    <button
        onMouseDown={(e) => {
            e.preventDefault(); // Prevent losing focus from editor
            action();
        }}
        className={clsx(
            "p-1.5 rounded-md transition-colors",
            isActive
                ? "bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200"
        )}
        title={label}
    >
        <Icon size={18} />
    </button>
);

export const EditorToolbar: React.FC = () => {
    const [loading, getEditor] = useInstance();
    const [isFocused, setIsFocused] = useState(false);
    const [activeFormats, setActiveFormats] = useState<string[]>([]);

    // Check initial focus state and set up listener
    useEffect(() => {
        if (loading) return;
        const editor = getEditor();
        if (!editor) return;

        const checkFocus = () => {
            const active = document.activeElement;
            const editorEl = document.querySelector('.milkdown .ProseMirror');
            setIsFocused(active === editorEl || editorEl?.contains(active) || false);
        };

        const handleStateUpdate = (e: Event) => {
            const customEvent = e as CustomEvent;
            setActiveFormats(customEvent.detail || []);
        };

        document.addEventListener('focusin', checkFocus);
        document.addEventListener('focusout', checkFocus);
        window.addEventListener('milkdown-state-update', handleStateUpdate);

        // Also check periodically or on click
        const interval = setInterval(checkFocus, 500);

        return () => {
            document.removeEventListener('focusin', checkFocus);
            document.removeEventListener('focusout', checkFocus);
            window.removeEventListener('milkdown-state-update', handleStateUpdate);
            clearInterval(interval);
        };
    }, [loading, getEditor]);

    const runCommand = useCallback((commandKey: CmdKey<any>, payload?: any) => {
        if (loading) return;
        const editor = getEditor();
        if (!editor) return;

        editor.action((ctx) => {
            const command = ctx.get(commandKey);
            command(payload);
        });
    }, [loading, getEditor]);

    const runCustomCommand = useCallback((fn: (state: any, dispatch: any, schema: any, view: any) => void) => {
        if (loading) return;
        const editor = getEditor();
        if (!editor) return;

        editor.action((ctx) => {
            const view = ctx.get(editorViewCtx);
            const { state, dispatch } = view;
            fn(state, dispatch, state.schema, view);
            view.focus();
        });
    }, [loading, getEditor]);

    const toggleHeading = (level: number) => {
        runCustomCommand((state, dispatch, schema) => {
            const { $from } = state.selection;
            const node = $from.parent;
            if (node.type === schema.nodes.heading && node.attrs.level === level) {
                // If already at this heading level, toggle back to paragraph
                setBlockType(schema.nodes.paragraph)(state, dispatch);
            } else {
                setBlockType(schema.nodes.heading, { level })(state, dispatch);
            }
        });
    };

    const toggleList = (nodeName: string, activeKey: string) => {
        runCustomCommand((state, dispatch, schema) => {
            if (activeFormats.includes(activeKey)) {
                // If already in this list type, lift out of it
                const itemType = schema.nodes.task_list_item || schema.nodes.list_item;
                if (itemType) {
                    liftListItem(itemType)(state, dispatch);
                }
            } else {
                // Wrap in list
                const listType = schema.nodes[nodeName];
                if (listType) {
                    wrapInList(listType)(state, dispatch);
                }
            }
        });
    };

    if (!isFocused) return null;

    return (
        <div className="absolute top-0 left-0 right-0 z-40 flex justify-center pointer-events-none sticky top-2">
            <div className="flex items-center gap-1 p-1 bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 rounded-lg pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-200">
                <ToolbarButton
                    icon={Heading1}
                    label="Heading 1"
                    isActive={activeFormats.includes('h1')}
                    action={() => toggleHeading(1)}
                />
                <ToolbarButton
                    icon={Heading2}
                    label="Heading 2"
                    isActive={activeFormats.includes('h2')}
                    action={() => toggleHeading(2)}
                />
                <ToolbarButton
                    icon={Heading3}
                    label="Heading 3"
                    isActive={activeFormats.includes('h3')}
                    action={() => toggleHeading(3)}
                />
                <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
                <ToolbarButton
                    icon={Bold}
                    label="Bold"
                    isActive={activeFormats.includes('bold')}
                    action={() => runCustomCommand((state, dispatch, schema) => toggleMark(schema.marks.strong)(state, dispatch))}
                />
                <ToolbarButton
                    icon={Italic}
                    label="Italic"
                    isActive={activeFormats.includes('italic')}
                    action={() => runCustomCommand((state, dispatch, schema) => toggleMark(schema.marks.emphasis)(state, dispatch))}
                />

                <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />

                <ToolbarButton
                    icon={List}
                    label="Bullet List"
                    isActive={activeFormats.includes('bullet_list')}
                    action={() => toggleList('bullet_list', 'bullet_list')}
                />
                <ToolbarButton
                    icon={ListOrdered}
                    label="Ordered List"
                    isActive={activeFormats.includes('ordered_list')}
                    action={() => toggleList('ordered_list', 'ordered_list')}
                />
                <ToolbarButton
                    icon={CheckSquare}
                    label="Task List"
                    isActive={activeFormats.includes('task_list')}
                    action={() => {
                        if (activeFormats.includes('task_list')) {
                            runCustomCommand((state, dispatch, schema) => {
                                const itemType = schema.nodes.task_list_item || schema.nodes.list_item;
                                if (itemType) {
                                    liftListItem(itemType)(state, dispatch);
                                }
                            });
                        } else {
                            runCustomCommand((state, dispatch, schema, view) => {
                                const { bullet_list, task_list_item, list_item } = schema.nodes;
                                // 1. Wrap in standard bullet list first
                                wrapInList(bullet_list)(state, dispatch);

                                // 2. Convert list items to task list items
                                setTimeout(() => {
                                    const { state: newState, dispatch: newDispatch } = view;
                                    const { selection } = newState;
                                    const { from, to } = selection;

                                    let tr = newState.tr;
                                    let hasChanges = false;

                                    newState.doc.nodesBetween(from, to, (node: any, pos: number) => {
                                        if (node.type === list_item) {
                                            tr.setNodeMarkup(pos, task_list_item, { checked: false });
                                            hasChanges = true;
                                        }
                                        return true;
                                    });

                                    if (hasChanges) {
                                        newDispatch(tr);
                                    }
                                }, 0);
                            });
                        }
                    }}
                />

                <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />

                <ToolbarButton
                    icon={Quote}
                    label="Quote"
                    isActive={activeFormats.includes('quote')}
                    action={() => {
                        if (activeFormats.includes('quote')) {
                            runCustomCommand((state, dispatch) => lift(state, dispatch));
                        } else {
                            runCommand(wrapInBlockquoteCommand.key);
                        }
                    }}
                />
                <ToolbarButton
                    icon={Code}
                    label="Code Block"
                    isActive={activeFormats.includes('code_block')}
                    action={() => runCustomCommand((state, dispatch, schema) => {
                        if (activeFormats.includes('code_block')) {
                            setBlockType(schema.nodes.paragraph)(state, dispatch);
                        } else {
                            setBlockType(schema.nodes.code_block)(state, dispatch);
                        }
                    })}
                />
            </div>
        </div>
    );
};

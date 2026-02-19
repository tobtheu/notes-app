import React from 'react'
import { Trash2, Plus, Minus, Heading } from 'lucide-react'
import clsx from 'clsx'
import { Editor } from '@tiptap/react'

interface TableHoverToolbarProps {
    editor: Editor
    node: any // Using any to avoid import issues with ProseMirror Node
    getPos: boolean | (() => number)
}

export const TableHoverToolbar: React.FC<TableHoverToolbarProps> = ({ editor, node, getPos }) => {
    // Helper to execute command immediately on mousedown to prevent focus loss/click issues
    const exec = (command: (pos: number) => void) => (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()

        if (typeof getPos !== 'function') return
        const pos = getPos()
        command(pos)
    }

    const setSelectionToLastCell = (pos: number) => {
        if (!node) return

        // Calculate position of the end of the table
        // pos is the start of the table node
        // node.nodeSize is the total size
        // We want to be inside the last cell.
        // Tiptap/ProseMirror tables structure: Table -> Row -> Cell/Header -> Paragraph
        // The end of the table is `pos + nodeSize`.
        // Setting selection to `pos + nodeSize - 2` usually hits the last cell's content end.
        const endPos = pos + node.nodeSize - 2

        // Use chain to set selection
        editor.chain().setTextSelection(endPos).run()
    }

    return (
        <div className={clsx(
            "flex items-center gap-1 bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 rounded-md p-0.5 animate-in fade-in zoom-in duration-200 pointer-events-auto"
        )}>
            {/* Table Header Toggle */}
            <div className="flex items-center gap-0.5 border-r border-gray-100 dark:border-gray-700 pr-1 mr-1">
                <button
                    onMouseDown={exec(() => editor.chain().focus().toggleHeaderRow().run())}
                    className="p-1.5 hover:bg-primary-50 dark:hover:bg-primary-900/40 text-gray-500 hover:text-primary-600 rounded-md transition-colors"
                    title="Toggle Header Row"
                >
                    <Heading size={14} />
                </button>
            </div>

            {/* Row Actions */}
            <div className="flex items-center gap-0.5 border-r border-gray-100 dark:border-gray-700 pr-1 mr-1">
                <span className="text-[10px] text-gray-400 font-bold uppercase px-1 mr-1">Row</span>
                <button
                    onMouseDown={exec((pos) => {
                        setSelectionToLastCell(pos)
                        // Use setTimeout to allow selection to update before adding?
                        // chain().run() is synchronous so it should be fine.
                        editor.chain().addRowAfter().run()
                    })}
                    className="p-1.5 hover:bg-primary-50 dark:hover:bg-primary-900/40 text-gray-500 hover:text-primary-600 rounded-md transition-colors"
                    title="Add Row to Bottom"
                >
                    <Plus size={14} />
                </button>
                <button
                    onMouseDown={exec((pos) => {
                        setSelectionToLastCell(pos)
                        editor.chain().deleteRow().run()
                    })}
                    className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/40 text-gray-500 hover:text-red-600 rounded-md transition-colors"
                    title="Delete Last Row"
                >
                    <Minus size={14} />
                </button>
            </div>

            {/* Column Actions */}
            <div className="flex items-center gap-0.5 border-r border-gray-100 dark:border-gray-700 pr-1 mr-1">
                <span className="text-[10px] text-gray-400 font-bold uppercase px-1 mr-1">Col</span>
                <button
                    onMouseDown={exec((pos) => {
                        setSelectionToLastCell(pos)
                        editor.chain().addColumnAfter().run()
                    })}
                    className="p-1.5 hover:bg-primary-50 dark:hover:bg-primary-900/40 text-gray-500 hover:text-primary-600 rounded-md transition-colors"
                    title="Add Column to Right"
                >
                    <Plus size={14} />
                </button>
                <button
                    onMouseDown={exec((pos) => {
                        setSelectionToLastCell(pos)
                        editor.chain().deleteColumn().run()
                    })}
                    className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/40 text-gray-500 hover:text-red-600 rounded-md transition-colors"
                    title="Delete Last Column"
                >
                    <Minus size={14} />
                </button>
            </div>

            {/* Table Actions */}
            <button
                onMouseDown={exec(() => editor.chain().focus().deleteTable().run())}
                className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/40 text-red-500 hover:text-red-600 rounded-md transition-colors text-xs font-medium"
                title="Delete Entire Table"
            >
                <Trash2 size={14} />
            </button>
        </div>
    )
}

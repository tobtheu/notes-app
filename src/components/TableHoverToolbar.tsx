import React from 'react'
import { Trash2, Plus, Minus, Heading } from 'lucide-react'
import clsx from 'clsx'
import { Editor } from '@tiptap/react'

interface TableHoverToolbarProps {
    editor: Editor
    node: any // Using any to avoid import issues with ProseMirror Node
    getPos: boolean | (() => number | undefined)
}

/**
 * TableHoverToolbar Component
 * A specialized toolbar that appears when a user hovers over or selects a table.
 * Provides granular controls for rows, columns, and table-wide actions.
 */
export const TableHoverToolbar: React.FC<TableHoverToolbarProps> = ({ editor, node, getPos }) => {
    /**
     * --- SELECTION HELPERS ---
     * Tiptap/ProseMirror table commands depend on the current selection.
     * Since clicking a toolbar button can shift focus, we use onMouseDown + e.preventDefault()
     * and manually ensure the selection is correct before executing the command.
     */
    const exec = (command: (pos: number) => void) => (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()

        if (typeof getPos !== 'function') {
            command(0)
            return
        }
        const pos = getPos()
        if (pos === undefined) return
        command(pos)
    }

    /**
     * Forces selection into the last cell to ensure commands like 'addRowAfter' 
     * target the expected location (the end of the table).
     */
    const setSelectionToLastCell = (pos: number) => {
        if (!node) return
        const endPos = pos + node.nodeSize - 2
        editor.chain().setTextSelection(endPos).run()
    }

    /**
     * Deletes the entire table safely and reliably, even if focus/selection is elsewhere.
     */
    const handleDeleteTable = (pos: number) => {
        if (node && typeof pos === 'number') {
            const from = pos
            const to = pos + node.nodeSize
            const ran = editor.chain().setTextSelection(pos + 2).deleteTable().focus().run()
            if (!ran) {
                editor.chain().deleteRange({ from, to }).focus().run()
            }
        } else {
            editor.chain().focus().deleteTable().run()
        }
    }

    return (
        <div className={clsx(
            "flex items-center gap-1 bg-[var(--canvas-bg)] shadow-lg border border-[var(--border-subtle)] rounded-xl p-1 animate-in fade-in zoom-in duration-200 pointer-events-auto backdrop-blur-md"
        )}>
            {/* --- HEADER CONTROLS --- */}
            <div className="flex items-center gap-0.5 border-r border-[var(--border-subtle)] pr-1 mr-0.5">
                <button
                    type="button"
                    onMouseDown={exec((pos) => {
                        editor.chain().setTextSelection(pos + 2).toggleHeaderRow().focus().run()
                    })}
                    className="p-1.5 hover:bg-[var(--card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-lg transition-colors"
                    title="Toggle Header Row"
                >
                    <Heading size={13} />
                </button>
            </div>

            {/* --- ROW CONTROLS --- */}
            <div className="flex items-center gap-0.5 border-r border-[var(--border-subtle)] pr-1 mr-0.5">
                <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase px-1 mr-0.5">Row</span>
                <button
                    type="button"
                    onMouseDown={exec((pos) => {
                        setSelectionToLastCell(pos)
                        editor.chain().addRowAfter().focus().run()
                    })}
                    className="p-1.5 hover:bg-[var(--card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-lg transition-colors"
                    title="Add Row to Bottom"
                >
                    <Plus size={13} />
                </button>
                <button
                    type="button"
                    onMouseDown={exec((pos) => {
                        setSelectionToLastCell(pos)
                        editor.chain().deleteRow().focus().run()
                    })}
                    className="p-1.5 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 rounded-lg transition-colors"
                    title="Delete Last Row"
                >
                    <Minus size={13} />
                </button>
            </div>

            {/* --- COLUMN CONTROLS --- */}
            <div className="flex items-center gap-0.5 border-r border-[var(--border-subtle)] pr-1 mr-0.5">
                <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase px-1 mr-0.5">Col</span>
                <button
                    type="button"
                    onMouseDown={exec((pos) => {
                        setSelectionToLastCell(pos)
                        editor.chain().addColumnAfter().focus().run()
                    })}
                    className="p-1.5 hover:bg-[var(--card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-lg transition-colors"
                    title="Add Column to Right"
                >
                    <Plus size={13} />
                </button>
                <button
                    type="button"
                    onMouseDown={exec((pos) => {
                        setSelectionToLastCell(pos)
                        editor.chain().deleteColumn().focus().run()
                    })}
                    className="p-1.5 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 rounded-lg transition-colors"
                    title="Delete Last Column"
                >
                    <Minus size={13} />
                </button>
            </div>

            {/* --- DANGER ZONE (DELETE TABLE) --- */}
            <button
                type="button"
                onMouseDown={exec(handleDeleteTable)}
                className="flex items-center gap-1 p-1.5 hover:bg-red-500/10 text-red-500 hover:text-red-600 rounded-lg transition-colors text-xs font-medium"
                title="Delete Entire Table"
            >
                <Trash2 size={13} />
            </button>
        </div>
    )
}

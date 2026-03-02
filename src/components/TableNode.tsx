import React from 'react'
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { TableHoverToolbar } from './TableHoverToolbar'
import clsx from 'clsx'

/**
 * TableNode Component
 * Custom NodeView for Tiptap Tables.
 * Wraps the standard HTML table with a hover effect and a context-aware toolbar.
 */
export const TableNode: React.FC<NodeViewProps> = (props) => {
    /**
     * --- SELECTION DETECTION ---
     * Determines if the user's cursor is currently within the boundaries of this table.
     * This is used to keep the toolbar visible while typing.
     */
    // @ts-ignore
    const isSelected = props.editor.isActive('table') &&
        props.editor.state.selection.anchor >= (props.node as any).pos &&
        props.editor.state.selection.anchor <= (props.node as any).pos + (props.node as any).nodeSize

    return (
        <NodeViewWrapper className="relative group my-8 w-full" style={{ width: '100%' }}>
            {/* 
                HACK: Tiptap React Node View layout fix.
                Ensures that nested divs created by React don't break the CSS table layout semantics.
            */}
            <style>{`
                tbody[data-node-view-content] > div {
                    display: contents !important;
                }
            `}</style>

            {/* --- HOVER/SELECTED TOOLBAR --- */}
            <div
                className={clsx(
                    "absolute -top-10 left-1/2 -translate-x-1/2 z-10 transition-opacity duration-200",
                    "opacity-0 group-hover:opacity-100", // Show on hover
                    isSelected && "opacity-100"           // Show if active
                )}
                contentEditable={false} // Prevents the editor cursor from entering the toolbar
            >
                <TableHoverToolbar editor={props.editor} node={props.node} getPos={props.getPos} />
            </div>

            {/* --- THE TABLE RENDERING --- */}
            <table className="w-full table-fixed" style={{ width: '100%' }}>
                {/* Tiptap injects the table body content here */}
                {/* @ts-ignore */}
                <NodeViewContent as="tbody" />
            </table>
        </NodeViewWrapper>
    )
}

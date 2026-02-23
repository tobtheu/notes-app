import React from 'react'
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { TableHoverToolbar } from './TableHoverToolbar'
import clsx from 'clsx'

export const TableNode: React.FC<NodeViewProps> = (props) => {
    // Check if selection is inside this specific table node
    // We cast props.node to any because Tiptap types can be tricky with NodeViewProps
    // @ts-ignore
    const isSelected = props.editor.isActive('table') && props.editor.state.selection.anchor >= (props.node as any).pos && props.editor.state.selection.anchor <= (props.node as any).pos + (props.node as any).nodeSize

    return (
        <NodeViewWrapper className="relative group my-8 w-full" style={{ width: '100%' }}>
            {/* Fix for Tiptap React Node View nesting: Force the wrapper div inside tbody to be ignored by layout */}
            <style>{`
                tbody[data-node-view-content] > div {
                    display: contents !important;
                }
            `}</style>

            {/* Toolbar Positioned Above */}
            <div
                className={clsx(
                    "absolute -top-10 left-1/2 -translate-x-1/2 z-10 transition-opacity duration-200",
                    // Show if hovered (group-hover) OR if selected
                    "opacity-0 group-hover:opacity-100",
                    isSelected && "opacity-100" // Keep visible if selected/typing inside
                )}
                contentEditable={false} // Prevent cursor from entering toolbar
            >
                <TableHoverToolbar editor={props.editor} node={props.node} getPos={props.getPos} />
            </div>

            {/* The Actual Table */}
            <table className="w-full table-fixed" style={{ width: '100%' }}>
                {/* @ts-ignore */}
                <NodeViewContent as="tbody" />
            </table>
        </NodeViewWrapper>
    )
}

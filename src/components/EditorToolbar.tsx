import React from 'react';
import type { Editor } from '@tiptap/react';
import { MoreHorizontal } from 'lucide-react';
import clsx from 'clsx';
import { useEditorToolbar } from '../hooks/useEditorToolbar';
import { ToolbarButton } from './ToolbarButton';

interface EditorToolbarProps {
    editor: Editor | null;
    mode?: 'full' | 'compact';
    onLinkClick?: () => void;
    mobile?: boolean;
}

/**
 * EditorToolbar Component
 * A floating formatting bar for the Tiptap editor.
 * Features:
 * - Basic formatting (Bold, Italic, Highlight)
 * - Headings and Lists
 * - Advanced items (Blockquote, Code, Table)
 * - Custom Modal integration for Links and Images
 * - Responsive "Compact" vs "Full" modes
 * - Dynamic overflow calculation collapsing hidden items into a 3-dot dropdown
 */
export const EditorToolbar: React.FC<EditorToolbarProps> = (props) => {
    const { editor } = props;

    const {
        isCompact,
        iconSize,
        btnPadding,
        visibleItems,
        overflowItems,
        filteredItems,
        isDropdownOpen,
        setIsDropdownOpen,
        containerRef,
        hiddenContainerRef,
        hiddenOverflowRef,
        dropdownRef
    } = useEditorToolbar(props);

    if (!editor) return null;

    return (
        <div className="relative w-full md:w-fit max-w-[calc(100vw-2rem)] shrink-0">
            {/* Hidden measuring container */}
            <div
                ref={hiddenContainerRef}
                className="absolute top-0 left-0 flex items-center gap-1 p-1 invisible pointer-events-none"
            >
                {filteredItems.map(item => {
                    if (item.type === 'divider') {
                        return <div key={item.id} className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5 shrink-0" />;
                    }
                    return (
                        <ToolbarButton
                            key={item.id}
                            icon={item.icon!}
                            label={item.label!}
                            action={item.action!}
                            isActive={item.isActive}
                            iconSize={iconSize}
                            btnPadding={btnPadding}
                        />
                    );
                })}
            </div>

            {/* Hidden overflow button to measure its size */}
            <div
                ref={hiddenOverflowRef}
                className="absolute top-0 left-0 invisible pointer-events-none p-1"
            >
                <button className={clsx("rounded-md", btnPadding)}>
                    <MoreHorizontal size={iconSize} />
                </button>
            </div>

            {/* Visible Container */}
            <div
                ref={containerRef}
                className={clsx(
                    "flex items-center gap-1 p-1 shadow-xl border border-gray-200 dark:border-gray-700 rounded-lg animate-in fade-in zoom-in duration-200 w-full",
                    isCompact ? "bg-opacity-90 backdrop-blur-sm" : ""
                )}
                style={{ backgroundColor: 'var(--app-bg)' }}
            >
                {visibleItems.map(item => {
                    if (item.type === 'divider') {
                        return <div key={item.id} className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5 shrink-0" />;
                    }
                    return (
                        <ToolbarButton
                            key={item.id}
                            icon={item.icon!}
                            label={item.label!}
                            action={item.action!}
                            isActive={item.isActive}
                            iconSize={iconSize}
                            btnPadding={btnPadding}
                        />
                    );
                })}

                {overflowItems.length > 0 && (
                    <div className="relative ml-auto shrink-0">
                        <button
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className={clsx(
                                "rounded-md transition-colors flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400",
                                btnPadding,
                                isDropdownOpen && "bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400"
                            )}
                            title="More Options"
                        >
                            <MoreHorizontal size={iconSize} strokeWidth={2.5} />
                        </button>
                        {isDropdownOpen && (
                            <div
                                ref={dropdownRef}
                                className="absolute bottom-full right-0 mb-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl min-w-[150px] z-50 flex flex-col gap-0.5 animate-in fade-in slide-in-from-bottom-2 duration-150"
                                style={{ backgroundColor: 'var(--app-bg)' }}
                            >
                                {overflowItems.map(item => {
                                    if (item.type === 'divider') {
                                        return <div key={item.id} className="h-px bg-gray-250 dark:bg-gray-700 my-1 mx-2" />;
                                    }
                                    const Icon = item.icon!;
                                    return (
                                        <button
                                            key={item.id}
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                item.action!();
                                                setIsDropdownOpen(false);
                                            }}
                                            className={clsx(
                                                "flex items-center gap-2 px-3 py-1.5 text-sm text-left w-full transition-colors rounded-md",
                                                item.isActive
                                                    ? "bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400 font-medium"
                                                    : "text-gray-500 dark:text-gray-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400"
                                            )}
                                        >
                                            <Icon size={14} />
                                            <span className="truncate">{item.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

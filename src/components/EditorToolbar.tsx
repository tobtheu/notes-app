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
 * Floating pill formatting bar for the Tiptap editor matching the Minimalist Redesign Mockup.
 */
export const EditorToolbar: React.FC<EditorToolbarProps> = (props) => {
    const { editor } = props;

    const {
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
        <div className="relative w-full md:w-fit max-w-[calc(100vw-2rem)] shrink-0 select-none">
            {/* Hidden measuring container */}
            <div
                ref={hiddenContainerRef}
                className="absolute top-0 left-0 flex items-center gap-0.5 p-1 invisible pointer-events-none"
            >
                {filteredItems.map(item => {
                    if (item.type === 'divider') {
                        return <div key={item.id} className="w-px h-3.5 bg-gray-300 dark:bg-gray-700 mx-1 shrink-0" />;
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
                <button className={clsx("rounded-xl w-7 h-7 flex items-center justify-center", btnPadding)}>
                    <MoreHorizontal size={iconSize} />
                </button>
            </div>

            {/* Visible Container */}
            <div
                ref={containerRef}
                className="flex items-center gap-0.5 px-2 py-1 shadow-toolbar-light dark:shadow-toolbar-dark border border-[var(--border-subtle)] rounded-2xl backdrop-blur-md w-full md:w-auto"
                style={{ backgroundColor: 'var(--toolbar-bg)' }}
            >
                {visibleItems.map(item => {
                    if (item.type === 'divider') {
                        return <div key={item.id} className="w-px h-3.5 bg-gray-300 dark:bg-gray-700 mx-1 shrink-0" />;
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
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className={clsx(
                                "smooth-transition rounded-xl flex items-center justify-center w-7 h-7 active:scale-95 text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10",
                                btnPadding,
                                isDropdownOpen && "bg-[var(--card-active)] text-[var(--accent-color)]"
                            )}
                            title="More Options"
                        >
                            <MoreHorizontal size={iconSize} />
                        </button>
                        {isDropdownOpen && (
                            <div
                                ref={dropdownRef}
                                className="absolute bottom-full right-0 mb-2 py-1 border border-[var(--border-subtle)] rounded-2xl shadow-xl min-w-[150px] z-50 flex flex-col gap-0.5 animate-popover-expand backdrop-blur-xl"
                                style={{ backgroundColor: 'var(--canvas-bg)' }}
                            >
                                {overflowItems.map(item => {
                                    if (item.type === 'divider') {
                                        return <div key={item.id} className="h-px bg-[var(--border-subtle)] my-1 mx-2" />;
                                    }
                                    const Icon = item.icon!;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                item.action!();
                                                setIsDropdownOpen(false);
                                            }}
                                            className={clsx(
                                                "flex items-center gap-2 px-3 py-1.5 text-xs text-left w-full transition-colors rounded-xl",
                                                item.isActive
                                                    ? "bg-[var(--card-active)] text-[var(--accent-color)] font-semibold"
                                                    : "text-[var(--text-main)] hover:bg-[var(--card-hover)]"
                                            )}
                                        >
                                            <Icon size={13} />
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

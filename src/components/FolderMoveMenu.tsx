import React, { useState, useRef } from 'react';
import { Folder, FolderTree, Check } from 'lucide-react';
import clsx from 'clsx';

interface FolderMoveMenuProps {
    noteFolder: string | null;
    folders: string[];
    onMoveNote: (folder: string | null) => void;
    onClose: () => void;
}

export function FolderMoveMenu({
    noteFolder,
    folders,
    onMoveNote,
    onClose
}: FolderMoveMenuProps) {
    const [dragY, setDragY] = useState(0);
    const dragStartY = useRef<number | null>(null);

    const handleDragStart = (e: React.TouchEvent) => {
        dragStartY.current = e.touches[0].clientY;
    };

    const handleDragMove = (e: React.TouchEvent) => {
        if (dragStartY.current === null) return;
        const currentY = e.touches[0].clientY;
        const diffY = currentY - dragStartY.current;
        if (diffY > 0) {
            setDragY(diffY);
        }
    };

    const handleDragEnd = () => {
        if (dragStartY.current === null) return;
        if (dragY > 80) {
            onClose();
        }
        setDragY(0);
        dragStartY.current = null;
    };

    return (
        <>
            {/* Desktop Dropdown */}
            <div
                className="hidden md:block absolute right-2 top-8 z-50 w-48 border border-[var(--border-subtle)] rounded-2xl shadow-xl py-1 overflow-y-auto custom-scrollbar animate-popover-expand pointer-events-auto origin-top-right folder-dropdown-menu backdrop-blur-xl"
                style={{ maxHeight: '14rem', backgroundColor: 'var(--canvas-bg)' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-3 py-1.5 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider sticky top-0 bg-[var(--canvas-bg)]/95 backdrop-blur-md border-b border-[var(--border-subtle)] select-none">
                    Move Note to...
                </div>
                <button
                    type="button"
                    className={clsx(
                        "smooth-transition w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--card-hover)] flex items-center gap-2 active:scale-98",
                        !noteFolder ? "text-[var(--accent-color)] font-semibold bg-[var(--card-hover)]/60" : "text-[var(--text-main)]"
                    )}
                    onClick={(e) => {
                        e.stopPropagation();
                        onMoveNote(null);
                        onClose();
                    }}
                >
                    <FolderTree size={13} className={clsx(!noteFolder ? "text-[var(--accent-color)]" : "text-[var(--text-muted)]")} />
                    <span className="flex-1 truncate">All Notes (Root)</span>
                    {!noteFolder && <Check size={12} className="text-[var(--accent-color)] shrink-0" />}
                </button>
                {folders.map(folder => (
                    <button
                        key={folder}
                        type="button"
                        className={clsx(
                            "smooth-transition w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--card-hover)] flex items-center gap-2 active:scale-98",
                            noteFolder === folder ? "text-[var(--accent-color)] font-semibold bg-[var(--card-hover)]/60" : "text-[var(--text-main)]"
                        )}
                        onClick={(e) => {
                            e.stopPropagation();
                            onMoveNote(folder);
                            onClose();
                        }}
                    >
                        <Folder size={13} className={clsx(noteFolder === folder ? "text-[var(--accent-color)]" : "text-[var(--text-muted)]")} />
                        <span className="truncate flex-1">{folder}</span>
                        {noteFolder === folder && <Check size={12} className="text-[var(--accent-color)] shrink-0" />}
                    </button>
                ))}
            </div>

            {/* Mobile Bottom Sheet Backdrop */}
            <div
                className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 md:hidden animate-fade-in"
                onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                }}
            />

            {/* Mobile Bottom Sheet Drawer */}
            <div
                className="fixed inset-x-0 bottom-0 bg-[var(--canvas-bg)] rounded-t-3xl shadow-2xl p-5 pb-[calc(1.5rem+var(--safe-bottom,0vh))] z-50 md:hidden border-t border-[var(--border-subtle)] folder-dropdown-menu max-h-[80vh] flex flex-col animate-modal-spring origin-bottom"
                style={{
                    transform: `translate3d(0, ${dragY}px, 0)`,
                    transition: dragStartY.current === null ? 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)' : 'none'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Drag handle area with touch gesture handlers */}
                <div
                    onTouchStart={handleDragStart}
                    onTouchMove={handleDragMove}
                    onTouchEnd={handleDragEnd}
                    className="w-full pt-1 pb-3 cursor-grab active:cursor-grabbing shrink-0 select-none touch-none"
                >
                    <div className="w-10 h-1 bg-[var(--border-subtle)] rounded-full mx-auto mb-3" />
                    <h3 className="text-sm font-bold text-[var(--text-main)] text-center">
                        Move Note to Folder
                    </h3>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1.5 py-1 pr-1 custom-scrollbar">
                    <button
                        type="button"
                        className={clsx(
                            "smooth-transition w-full text-left px-3.5 py-2.5 text-xs hover:bg-[var(--card-hover)] rounded-xl flex items-center gap-3 border active:scale-[0.99]",
                            !noteFolder
                                ? "text-[var(--accent-color)] font-semibold bg-[var(--card-hover)] border-[var(--accent-color)]/30 shadow-xs"
                                : "text-[var(--text-main)] border-[var(--border-subtle)] bg-[var(--card-hover)]/30"
                        )}
                        onClick={(e) => {
                            e.stopPropagation();
                            onMoveNote(null);
                            onClose();
                        }}
                    >
                        <FolderTree size={15} className={clsx(!noteFolder ? "text-[var(--accent-color)]" : "text-[var(--text-muted)]")} />
                        <span className="flex-1">All Notes (Root)</span>
                        {!noteFolder && <Check size={14} className="text-[var(--accent-color)]" />}
                    </button>
                    {folders.map(folder => (
                        <button
                            key={folder}
                            type="button"
                            className={clsx(
                                "smooth-transition w-full text-left px-3.5 py-2.5 text-xs hover:bg-[var(--card-hover)] rounded-xl flex items-center gap-3 border active:scale-[0.99]",
                                noteFolder === folder
                                    ? "text-[var(--accent-color)] font-semibold bg-[var(--card-hover)] border-[var(--accent-color)]/30 shadow-xs"
                                    : "text-[var(--text-main)] border-[var(--border-subtle)] bg-[var(--card-hover)]/30"
                            )}
                            onClick={(e) => {
                                e.stopPropagation();
                                onMoveNote(folder);
                                onClose();
                            }}
                        >
                            <Folder size={15} className={clsx(noteFolder === folder ? "text-[var(--accent-color)]" : "text-[var(--text-muted)]")} />
                            <span className="flex-1 truncate">{folder}</span>
                            {noteFolder === folder && <Check size={14} className="text-[var(--accent-color)]" />}
                        </button>
                    ))}
                </div>
            </div>
        </>
    );
}

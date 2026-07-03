import React, { useState, useRef } from 'react';
import { FolderTree } from 'lucide-react';
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
                className="hidden md:block absolute right-2 top-10 mt-2 w-48 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-200 z-50 pointer-events-auto origin-top-right folder-dropdown-menu"
                style={{ maxHeight: '12rem', backgroundColor: 'var(--app-bg)' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider sticky top-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-700">
                    Move to...
                </div>
                <button
                    className={clsx(
                        "w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2",
                        !noteFolder ? "text-primary-600 dark:text-primary-400 font-medium bg-primary-50/30 dark:bg-primary-900/10" : "text-gray-600 dark:text-gray-300"
                    )}
                    onClick={(e) => {
                        e.stopPropagation();
                        onMoveNote(null);
                        onClose();
                    }}
                >
                    <FolderTree size={12} className="opacity-50" />
                    Root (No Folder)
                </button>
                {folders.map(folder => (
                    <button
                        key={folder}
                        className={clsx(
                            "w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2",
                            noteFolder === folder ? "text-primary-600 dark:text-primary-400 font-medium bg-primary-50/30 dark:bg-primary-900/10" : "text-gray-600 dark:text-gray-300"
                        )}
                        onClick={(e) => {
                            e.stopPropagation();
                            onMoveNote(folder);
                            onClose();
                        }}
                    >
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />
                        <span className="truncate">{folder}</span>
                    </button>
                ))}
            </div>

            {/* Mobile Bottom Sheet Backdrop */}
            <div
                className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 md:hidden animate-in fade-in duration-200"
                onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                }}
            />

            {/* Mobile Bottom Sheet Drawer */}
            <div
                className="fixed inset-x-0 bottom-0 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl p-6 pb-[calc(1.5rem+var(--safe-bottom,0vh))] z-50 md:hidden border-t border-gray-100 dark:border-gray-800 folder-dropdown-menu max-h-[80vh] flex flex-col animate-in slide-in-from-bottom duration-300 origin-bottom"
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
                    <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-3" />
                    <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 text-center">
                        Move Note to Folder
                    </h3>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 py-1 pr-1 custom-scrollbar">
                    <button
                        className={clsx(
                            "w-full text-left px-4 py-3.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-xl transition-all flex items-center gap-3 border border-transparent active:scale-[0.99]",
                            !noteFolder
                                ? "text-primary-600 dark:text-primary-400 font-semibold bg-primary-50 dark:bg-primary-950/40 border-primary-100 dark:border-primary-900/30"
                                : "text-gray-600 dark:text-gray-300 border-gray-100 dark:border-gray-800/80 bg-gray-50/50 dark:bg-gray-800/20"
                        )}
                        onClick={(e) => {
                            e.stopPropagation();
                            onMoveNote(null);
                            onClose();
                        }}
                    >
                        <FolderTree size={16} className={clsx(!noteFolder ? "text-primary-500" : "text-gray-400 dark:text-gray-500")} />
                        <span className="flex-1">Root (No Folder)</span>
                        {!noteFolder && <div className="w-2 h-2 rounded-full bg-primary-500" />}
                    </button>
                    {folders.map(folder => (
                        <button
                            key={folder}
                            className={clsx(
                                "w-full text-left px-4 py-3.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-xl transition-all flex items-center gap-3 border border-transparent active:scale-[0.99]",
                                noteFolder === folder
                                    ? "text-primary-600 dark:text-primary-400 font-semibold bg-primary-50 dark:bg-primary-950/40 border-primary-100 dark:border-primary-900/30"
                                    : "text-gray-600 dark:text-gray-300 border-gray-100 dark:border-gray-800/80 bg-gray-50/50 dark:bg-gray-800/20"
                        )}
                        onClick={(e) => {
                            e.stopPropagation();
                            onMoveNote(folder);
                            onClose();
                        }}
                    >
                        <FolderTree size={16} className={clsx(noteFolder === folder ? "text-primary-500" : "text-gray-400 dark:text-gray-500")} />
                        <span className="flex-1 truncate">{folder}</span>
                        {noteFolder === folder && <div className="w-2 h-2 rounded-full bg-primary-500" />}
                    </button>
                ))}
                </div>
            </div>
        </>
    );
}

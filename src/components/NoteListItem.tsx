import { memo, useMemo } from 'react';
import { Trash2, Pin, FolderTree } from 'lucide-react';
import clsx from 'clsx';
import type { Note } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { stripMarkdown } from '../utils/markdown';
import { useNoteSwipe } from '../hooks/useNoteSwipe';
import { FolderMoveMenu } from './FolderMoveMenu';

interface NoteListItemProps {
    note: Note;
    isSelected: boolean;
    isNextSelected: boolean;
    isPinned: boolean;
    isCompact: boolean;
    noteId: string;
    dropdownOpenId: string | null;
    setDropdownOpenId: (id: string | null) => void;
    onSelectNote: (note: Note) => void;
    onTogglePin: (note: Note) => void;
    onDeleteNote: (id: string) => void;
    onMoveNote: (id: string, folder: string | null) => void;
    folders: string[];
}

export const NoteListItem = memo(({
    note,
    isSelected,
    isNextSelected,
    isPinned,
    isCompact,
    noteId,
    dropdownOpenId,
    setDropdownOpenId,
    onSelectNote,
    onTogglePin,
    onDeleteNote,
    onMoveNote,
    folders
}: NoteListItemProps) => {
    const {
        swipeOffset,
        setSwipeOffset,
        isSnapping,
        isDragging,
        cardRef,
        isSwipedRef,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
        closeSwipe
    } = useNoteSwipe({ isSelected });

    const previewText = useMemo(() => {
        const stripped = note.content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trimStart();
        return stripMarkdown(stripped.replace(/^#\s.*?\r?\n/, '').trim()) || 'No additional content';
    }, [note.content]);

    const timeString = useMemo(() => {
        return formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })
            .replace('less than a minute', '< 1 min')
            .replace('about ', '');
    }, [note.updatedAt]);

    const title = useMemo(() => {
        const withoutFrontmatter = note.content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trimStart();
        const firstLine = withoutFrontmatter.split(/\r?\n/)[0] || '';
        const extractedTitle = firstLine.replace(/^#\s*/, '').trim();
        return extractedTitle || note.filename.replace('.md', '');
    }, [note.content, note.filename]);

    const handleMoveNote = (folder: string | null) => {
        onMoveNote(noteId, folder);
        setSwipeOffset(0);
        isSwipedRef.current = false;
    };

    return (
        <div>
            <div className="relative mb-0.5 rounded-xl border-2 border-transparent overflow-visible">
                {/* Swipe Actions (Behind) */}
                <div className="absolute inset-y-[2px] right-[2px] left-[2px] ml-auto flex items-center justify-end bg-gray-100 dark:bg-gray-800/80 max-w-[192px] z-0 h-[calc(100%-4px)] rounded-r-[10px] pointer-events-auto overflow-hidden">
                    <button
                        onClick={(e) => { e.stopPropagation(); onTogglePin(note); closeSwipe(); }}
                        className={clsx(
                            "flex items-center justify-center w-16 h-full text-white transition-colors shrink-0",
                            isPinned ? "bg-primary-600 hover:bg-primary-700" : "bg-gray-400 hover:bg-gray-500 dark:bg-gray-600 dark:hover:bg-gray-500"
                        )}
                        title={isPinned ? "Unpin Note" : "Pin Note"}
                    >
                        <Pin size={18} fill={isPinned ? "currentColor" : "none"} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); setDropdownOpenId(dropdownOpenId === noteId ? null : noteId); closeSwipe(); }}
                        className="flex items-center justify-center w-16 h-full bg-blue-500 hover:bg-blue-600 text-white transition-colors shrink-0 folder-dropdown-trigger"
                        title="Move to Folder"
                    >
                        <FolderTree size={18} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDeleteNote(noteId); closeSwipe(); }}
                        className="flex items-center justify-center w-16 h-full bg-red-500 hover:bg-red-600 text-white transition-colors shrink-0 rounded-r-[10px]"
                        title="Delete Note"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>

                {/* Foreground Card */}
                <div
                    ref={cardRef}
                    onClick={() => {
                        if (isSwipedRef.current) {
                            setSwipeOffset(0);
                            isSwipedRef.current = false;
                        } else {
                            if (!isDragging) onSelectNote(note);
                        }
                    }}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onMouseLeave={() => {
                        if (isSwipedRef.current) {
                            setSwipeOffset(0);
                            isSwipedRef.current = false;
                        }
                    }}
                    style={{ 
                        transform: `translate3d(${swipeOffset}px, 0px, 0px)`,
                        backgroundColor: !isSelected ? 'var(--app-bg)' : undefined
                    }}
                    className={clsx(
                        "group relative p-2.5 rounded-xl cursor-pointer z-10 w-full border-2 overflow-hidden no-sidebar-drag",
                        isSnapping && "transition-transform duration-200",
                        isSelected
                            ? "bg-primary-50 dark:bg-primary-950 border-primary-500 shadow-sm"
                            : "hover:bg-gray-100 border-transparent dark:hover:bg-gray-800"
                    )}
                >
                    <div className="flex flex-col min-w-0 gap-1.5 w-full pointer-events-none sm:pointer-events-auto">
                        <div className="flex items-start justify-between min-w-0 gap-2 w-full">
                            <h3 className={clsx(
                                "font-bold truncate dark:text-gray-100",
                                isCompact ? "text-sm" : "text-base mb-1"
                            )}>
                                {title}
                            </h3>
                            {/* Pin indicator (Mobile) */}
                            {isPinned && (
                                <div className="sm:hidden shrink-0 text-primary-500">
                                    <Pin size={13} fill="currentColor" />
                                </div>
                            )}
                            {/* Hover Actions (Desktop) */}
                            <div className="hidden sm:flex items-center shrink-0">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onTogglePin(note);
                                    }}
                                    className={clsx(
                                        "p-1 rounded-md transition-all pointer-events-auto",
                                        isPinned
                                            ? "text-primary-500 bg-primary-50 dark:bg-primary-900/30 opacity-100"
                                            : "text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700"
                                    )}
                                    title={isPinned ? "Unpin Note" : "Pin Note"}
                                >
                                    {isPinned ? <Pin size={14} fill="currentColor" /> : <Pin size={14} />}
                                </button>
                            </div>
                        </div>

                        {!isCompact && (
                            <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-2 leading-5 h-10 overflow-hidden">
                                {previewText}
                            </p>
                        )}

                        <div className="flex items-center justify-between text-[10px] font-medium text-gray-500 uppercase tracking-tight relative pointer-events-auto">
                            <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                <span className="shrink-0">{timeString}</span>
                                {note.folder && (
                                    <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded truncate">
                                        {note.folder}
                                    </span>
                                )}
                            </div>
                            {/* Hover Actions (Desktop) */}
                            <div className="hidden sm:flex items-center gap-0.5 relative z-20">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setDropdownOpenId(dropdownOpenId === noteId ? null : noteId);
                                    }}
                                    className={clsx(
                                        "p-1 rounded transition-all pointer-events-auto folder-dropdown-trigger",
                                        dropdownOpenId === noteId
                                            ? "bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 opacity-100"
                                            : "opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                    )}
                                    title="Move to Folder"
                                >
                                    <FolderTree size={12} />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteNote(noteId);
                                    }}
                                    className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 rounded transition-all pointer-events-auto"
                                    title="Delete Note"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {dropdownOpenId === noteId && (
                    <FolderMoveMenu
                        noteFolder={note.folder}
                        folders={folders}
                        onMoveNote={handleMoveNote}
                        onClose={() => setDropdownOpenId(null)}
                    />
                )}
            </div>
            {isNextSelected !== undefined && (
                <div className={clsx(
                    "border-b mx-2 my-1 transition-colors",
                    (isSelected || isNextSelected) ? "border-transparent" : "border-gray-200 dark:border-gray-700"
                )} />
            )}
        </div>
    );
});

NoteListItem.displayName = 'NoteListItem';

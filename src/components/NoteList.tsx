import { useState, memo, useMemo, useRef, useEffect } from 'react';
import {
    Search, List, LayoutList, Trash2, Pin, FolderTree
} from 'lucide-react';
import clsx from 'clsx';
import type { Note } from '../types';
import { formatDistanceToNow } from 'date-fns';

interface NoteListProps {
    className?: string;
    notes: Note[];
    folders: string[];
    selectedNote: Note | null;
    onSelectNote: (note: Note) => void;
    searchTerm: string;
    onSearchChange: (value: string) => void;
    onDeleteNote: (id: string) => void;
    onMoveNote: (id: string, folder: string | null) => void;
    onTogglePin: (note: Note) => void;
    isNotePinned: (note: Note) => boolean;
    getNoteId: (note: Note) => string;
    selectedCategory: string | null;
}
const stripMarkdown = (text: string) => {
    if (!text) return '';
    return text
        .split(/\r?\n/)[0] // Only preview the first line
        .replace(/^#+\s+/, '') // Remove markdown headers
        .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '$1') // Remove image syntax
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove link syntax
        // Strip syntax symbols if they appear at word boundaries
        .replace(/(^|\s)[#*`_~]+|[#*`_~]+(\s|$)/g, '$1$2')
        .replace(/\[[x ]\]/g, '') // Remove task list checkboxes
        .replace(/<[^>]*>/g, '') // Remove HTML
        .trim();
};

/**
 * NoteListItem Component
 * Memoized row for the note list to prevent unnecessary re-renders.
 */
const NoteListItem = memo(({
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
}: {
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
}) => {
    const previewText = useMemo(() => {
        return stripMarkdown(note.content.replace(/^#\s.*?\r?\n/, '').trim()) || 'No additional content';
    }, [note.content]);

    const timeString = useMemo(() => {
        return formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })
            .replace('less than a minute', '< 1 min')
            .replace('about ', '');
    }, [note.updatedAt]);

    const title = useMemo(() => {
        const firstLine = note.content.split(/\r?\n/)[0] || '';
        const extractedTitle = firstLine.replace(/^#\s*/, '').trim();
        return extractedTitle || note.filename.replace('.md', '');
    }, [note.content, note.filename]);

    const [swipeOffset, setSwipeOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const touchStartX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);
    const isSwipedRef = useRef(false);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        setIsDragging(false);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (touchStartX.current === null || touchStartY.current === null) return;
        
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const diffX = currentX - touchStartX.current;
        const diffY = currentY - touchStartY.current;
        
        // If scrolling vertically, ignore swipe
        if (Math.abs(diffY) > Math.abs(diffX)) return;
        
        if (Math.abs(diffX) > 5) {
            setIsDragging(true);
        }

        if (diffX < 0 && !isSwipedRef.current) {
            setSwipeOffset(Math.max(diffX, -160));
        } else if (diffX > 0 && isSwipedRef.current) {
            setSwipeOffset(Math.min(-160 + diffX, 0));
        }
    };

    const handleTouchEnd = () => {
        if (touchStartX.current !== null) {
            if (swipeOffset < -60) {
                setSwipeOffset(-160);
                isSwipedRef.current = true;
            } else {
                setSwipeOffset(0);
                isSwipedRef.current = false;
            }
        }
        setTimeout(() => setIsDragging(false), 50);
        touchStartX.current = null;
        touchStartY.current = null;
    };

    // Auto-close swipe when another note is selected or dropdown is open
    useEffect(() => {
        if (isSelected && isSwipedRef.current) {
            setSwipeOffset(0);
            isSwipedRef.current = false;
        }
    }, [isSelected]);

    return (
        <div style={{ contain: 'paint' }}>
            <div className="relative mb-0.5 rounded-xl border-2 border-transparent overflow-visible">
                {/* Swipe Actions (Behind) */}
                <div className="absolute inset-y-0 right-0 flex items-center justify-end px-3 gap-2 bg-gray-100 dark:bg-gray-800/80 w-full z-0 h-full rounded-xl pointer-events-auto">
                    <button
                        onClick={(e) => { e.stopPropagation(); onTogglePin(note); setSwipeOffset(0); isSwipedRef.current = false; }}
                        className={clsx("p-2 rounded-lg text-white font-medium transition-colors", isPinned ? "bg-primary-600 hover:bg-primary-700" : "bg-gray-400 hover:bg-gray-500 dark:bg-gray-600 dark:hover:bg-gray-500")}
                        title={isPinned ? "Unpin Note" : "Pin Note"}
                    >
                        <Pin size={18} fill={isPinned ? "currentColor" : "none"} />
                    </button>
                    <div className="relative">
                        <button
                            onClick={(e) => { e.stopPropagation(); setDropdownOpenId(dropdownOpenId === noteId ? null : noteId); }}
                            className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                            title="Move to Folder"
                        >
                            <FolderTree size={18} />
                        </button>
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDeleteNote(noteId); setSwipeOffset(0); isSwipedRef.current = false; }}
                        className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                        title="Delete Note"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>

                {/* Foreground Card */}
                <div
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
                    style={{ transform: `translateX(${swipeOffset}px)` }}
                    className={clsx(
                        "group relative p-2.5 rounded-xl cursor-pointer transition-all z-10 w-full border-2",
                        !isDragging && "duration-200",
                        isSelected
                            ? "bg-primary-50 dark:bg-primary-900/30 border-primary-500 shadow-sm"
                            : "bg-white dark:bg-gray-900 hover:bg-gray-50 border-transparent dark:hover:bg-gray-800"
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
                                            : "text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700"
                                    )}
                                    title={isPinned ? "Unpin Note" : "Pin Note"}
                                >
                                    {isPinned ? <Pin size={14} fill="currentColor" /> : <Pin size={14} />}
                                </button>
                            </div>
                        </div>

                        {!isCompact && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-2 leading-5 h-10 overflow-hidden">
                                {previewText}
                            </p>
                        )}

                        <div className="flex items-center justify-between text-[10px] font-medium text-gray-400 uppercase tracking-tight relative pointer-events-auto">
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
                                        "p-1 rounded transition-all pointer-events-auto",
                                        dropdownOpenId === noteId
                                            ? "bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 opacity-100"
                                            : "opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-300 hover:text-gray-600 dark:hover:text-gray-200"
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
                                    className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-300 hover:text-red-500 rounded transition-all pointer-events-auto"
                                    title="Delete Note"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {dropdownOpenId === noteId && (
                    <div
                        className="absolute right-2 top-10 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-200 z-50 pointer-events-auto origin-top-right"
                        style={{ maxHeight: '12rem' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider sticky top-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-700">
                            Move to...
                        </div>
                        <button
                            className={clsx(
                                "w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2",
                                !note.folder ? "text-primary-600 dark:text-primary-400 font-medium bg-primary-50/30 dark:bg-primary-900/10" : "text-gray-600 dark:text-gray-300"
                            )}
                            onClick={(e) => {
                                e.stopPropagation();
                                onMoveNote(noteId, null);
                                setDropdownOpenId(null);
                                setSwipeOffset(0);
                                isSwipedRef.current = false;
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
                                    note.folder === folder ? "text-primary-600 dark:text-primary-400 font-medium bg-primary-50/30 dark:bg-primary-900/10" : "text-gray-600 dark:text-gray-300"
                                )}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onMoveNote(noteId, folder);
                                    setDropdownOpenId(null);
                                    setSwipeOffset(0);
                                    isSwipedRef.current = false;
                                }}
                            >
                                <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />
                                <span className="truncate">{folder}</span>
                            </button>
                        ))}
                    </div>
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

/**
 * NoteList Component
 * Renders the searchable list of notes. Handles sorting (pins first), compact vs detailed views,
 * and inline note actions like moving to folders or deleting.
 */
export function NoteList({
    className,
    notes,
    folders,
    selectedNote,
    onSelectNote,
    searchTerm,
    onSearchChange,
    onDeleteNote,
    onMoveNote,
    onTogglePin,
    isNotePinned,
    getNoteId,
    selectedCategory,
}: NoteListProps) {
    /**
     * --- LOCAL STATE ---
     */

    // View preference state (persisted in localStorage)
    const [isCompact, setIsCompact] = useState(() => {
        return localStorage.getItem('notelist-compact') === 'true';
    });

    // Tracks which note's folder selection menu is currently open
    const [dropdownOpenId, setDropdownOpenId] = useState<string | null>(null);

    // Toggles between Detailed (with preview) and Compact (titles only) view
    const toggleView = () => {
        const newState = !isCompact;
        setIsCompact(newState);
        localStorage.setItem('notelist-compact', String(newState));
    };

    return (
        <div className={clsx(
            "flex flex-col h-full bg-white dark:bg-gray-900 md:border-r border-gray-100 dark:border-gray-800",
            // Add significant padding on mobile so it doesn't touch the screen edge
            "pr-6 md:pr-0",
            className
        )}>

            {/* --- HEADER: SEARCH & FILTER --- */}
            <div
                className="p-3 space-y-2"
            >
                <div className="flex items-center gap-3">
                    <div className="relative group flex-1">
                        <Search className="absolute left-3 top-2.5 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Search notes..."
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-primary-500/20 rounded-xl outline-none transition-all dark:text-gray-100 text-base"
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                        />
                    </div>
                </div>

                {/* CURRENT CONTEXT INFO */}
                <div className="flex items-center justify-between px-1">
                    <div className="flex flex-col min-w-0">
                        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 truncate">
                            {folders.includes(selectedCategory || '') ? selectedCategory : 'All Notes'}
                        </h2>
                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                            {notes.length} {notes.length === 1 ? 'Note' : 'Notes'}
                        </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            onClick={toggleView}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 transition-colors"
                            title={isCompact ? "Detail View" : "Compact View"}
                        >
                            {isCompact ? <LayoutList size={18} /> : <List size={18} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* --- NOTES SCROLL AREA --- */}
            <div className="flex-1 overflow-y-auto px-2 pb-[calc(1rem+var(--safe-bottom,0vh))] custom-scrollbar">
                {notes.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">
                        No notes found.
                    </div>
                ) : (
                    notes.map((note, index) => {
                        const noteId = getNoteId(note);
                        const isSelected = selectedNote ? getNoteId(selectedNote) === noteId : false;
                        const isNextSelected = index < notes.length - 1 && selectedNote ? getNoteId(selectedNote) === getNoteId(notes[index + 1]) : false;
                        const isPinned = isNotePinned(note);

                        return (
                            <NoteListItem
                                key={noteId}
                                note={note}
                                isSelected={isSelected}
                                isNextSelected={isNextSelected}
                                isPinned={isPinned}
                                isCompact={isCompact}
                                noteId={noteId}
                                dropdownOpenId={dropdownOpenId}
                                setDropdownOpenId={setDropdownOpenId}
                                onSelectNote={onSelectNote}
                                onTogglePin={onTogglePin}
                                onDeleteNote={onDeleteNote}
                                onMoveNote={onMoveNote}
                                folders={folders}
                            />
                        );
                    })
                )}
            </div>
        </div>
    );
}

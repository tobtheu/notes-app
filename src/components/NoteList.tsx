import { useState, memo, useMemo, useRef, useEffect, useCallback } from 'react';
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
    isIOS?: boolean;
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

    const [swipeOffset, setSwipeOffset] = useState(0);
    const [isSnapping, setIsSnapping] = useState(false);
    const isDraggingRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);
    const touchStartX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);
    const isSwipedRef = useRef(false);

    const cardRef = useRef<HTMLDivElement>(null);
    const swipeOffsetRef = useRef(0);
    const rafIdRef = useRef<number | null>(null);

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
            setDropdownOpenId(null);
        }
        setDragY(0);
        dragStartY.current = null;
    };

    const closeSwipe = () => {
        isSwipedRef.current = false;
        swipeOffsetRef.current = 0;
        if (cardRef.current) {
            cardRef.current.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
            cardRef.current.style.transform = 'translate3d(0px, 0px, 0px)';
        }
        setTimeout(() => {
            setSwipeOffset(0);
            if (cardRef.current) {
                cardRef.current.style.transition = '';
                cardRef.current.style.willChange = '';
            }
        }, 200);
    };

    // Sync React state updates back to mutable refs & clear manual styles if reset to 0
    useEffect(() => {
        swipeOffsetRef.current = swipeOffset;
        if (swipeOffset === 0 && cardRef.current) {
            cardRef.current.style.transform = '';
        }
    }, [swipeOffset]);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        isDraggingRef.current = false;
        setIsDragging(false);
        setIsSnapping(false);

        if (cardRef.current) {
            cardRef.current.style.transition = 'none';
            cardRef.current.style.willChange = 'transform';
        }

        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (touchStartX.current === null || touchStartY.current === null) return;

        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const diffX = currentX - touchStartX.current;
        const diffY = currentY - touchStartY.current;

        // If scrolling vertically, ignore swipe
        if (!isDraggingRef.current && Math.abs(diffY) > Math.abs(diffX)) return;

        if (Math.abs(diffX) > 5) {
            isDraggingRef.current = true;
            if (!isDragging) setIsDragging(true);
        }

        if (!isDraggingRef.current) return;

        let newOffset = 0;
        if (diffX < 0 && !isSwipedRef.current) {
            newOffset = Math.max(diffX, -192);
        } else if (diffX > 0 && isSwipedRef.current) {
            newOffset = Math.min(-192 + diffX, 0);
        } else {
            return;
        }

        swipeOffsetRef.current = newOffset;

        if (rafIdRef.current === null) {
            rafIdRef.current = requestAnimationFrame(() => {
                rafIdRef.current = null;
                if (cardRef.current) {
                    cardRef.current.style.transform = `translate3d(${swipeOffsetRef.current}px, 0px, 0px)`;
                }
            });
        }
    };

    const handleTouchEnd = () => {
        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }

        if (touchStartX.current !== null) {
            const finalOffset = swipeOffsetRef.current < -70 ? -192 : 0;
            isSwipedRef.current = finalOffset === -192;
            swipeOffsetRef.current = finalOffset;

            if (cardRef.current) {
                // Apply hardware accelerated transition directly to the element
                cardRef.current.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
                cardRef.current.style.transform = `translate3d(${finalOffset}px, 0px, 0px)`;
            }

            // Sync React state after animation finishes
            setTimeout(() => {
                setSwipeOffset(finalOffset);
                if (cardRef.current) {
                    cardRef.current.style.transition = '';
                    cardRef.current.style.willChange = '';
                }
            }, 200);
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
        <div>
            <div className="relative mb-0.5 rounded-xl border-2 border-transparent overflow-visible">
                {/* Swipe Actions (Behind) */}
                <div className="absolute inset-y-[2px] right-[2px] flex items-center justify-end bg-gray-100 dark:bg-gray-800/80 w-[192px] z-0 h-[calc(100%-4px)] rounded-r-[10px] pointer-events-auto overflow-hidden">
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
                    <>
                        {/* Desktop click-interception backdrop */}
                        <div
                            className="hidden md:block fixed inset-0 z-40 bg-transparent"
                            onClick={(e) => {
                                e.stopPropagation();
                                setDropdownOpenId(null);
                            }}
                        />

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

                        {/* Mobile Bottom Sheet Backdrop */}
                        <div
                            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 md:hidden animate-in fade-in duration-200"
                            onClick={(e) => {
                                e.stopPropagation();
                                setDropdownOpenId(null);
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
                                        !note.folder
                                            ? "text-primary-600 dark:text-primary-400 font-semibold bg-primary-50 dark:bg-primary-950/40 border-primary-100 dark:border-primary-900/30"
                                            : "text-gray-600 dark:text-gray-300 border-gray-100 dark:border-gray-800/80 bg-gray-50/50 dark:bg-gray-800/20"
                                    )}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onMoveNote(noteId, null);
                                        setDropdownOpenId(null);
                                        setSwipeOffset(0);
                                        isSwipedRef.current = false;
                                    }}
                                >
                                    <FolderTree size={16} className={clsx(!note.folder ? "text-primary-500" : "text-gray-400 dark:text-gray-500")} />
                                    <span className="flex-1">Root (No Folder)</span>
                                    {!note.folder && <div className="w-2 h-2 rounded-full bg-primary-500" />}
                                </button>
                                {folders.map(folder => (
                                    <button
                                        key={folder}
                                        className={clsx(
                                            "w-full text-left px-4 py-3.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-xl transition-all flex items-center gap-3 border border-transparent active:scale-[0.99]",
                                            note.folder === folder
                                                ? "text-primary-600 dark:text-primary-400 font-semibold bg-primary-50 dark:bg-primary-950/40 border-primary-100 dark:border-primary-900/30"
                                                : "text-gray-600 dark:text-gray-300 border-gray-100 dark:border-gray-800/80 bg-gray-50/50 dark:bg-gray-800/20"
                                        )}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onMoveNote(noteId, folder);
                                            setDropdownOpenId(null);
                                            setSwipeOffset(0);
                                            isSwipedRef.current = false;
                                        }}
                                    >
                                        <FolderTree size={16} className={clsx(note.folder === folder ? "text-primary-500" : "text-gray-400 dark:text-gray-500")} />
                                        <span className="flex-1 truncate">{folder}</span>
                                        {note.folder === folder && <div className="w-2 h-2 rounded-full bg-primary-500" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
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
    isIOS = false,
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

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.folder-dropdown-trigger') && !target.closest('.folder-dropdown-menu')) {
                setDropdownOpenId(null);
            }
        };
        
        if (dropdownOpenId) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [dropdownOpenId]);

    // On iOS, search bar is hidden by default and revealed by scrolling up.
    // isIOS starts as false (async detection in App.tsx), so we init to true and
    // immediately hide once isIOS is confirmed — avoids the visible flash.
    const [searchVisible, setSearchVisible] = useState(!isIOS);
    const prevScrollTop = useRef(0);
    const iosDetectedRef = useRef(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isIOS && !iosDetectedRef.current) {
            iosDetectedRef.current = true;
            if (!searchTerm) setSearchVisible(false);
        }
    }, [isIOS, searchTerm]);

    useEffect(() => {
        if (searchTerm) setSearchVisible(true);
    }, [searchTerm]);

    useEffect(() => {
        if (!isIOS) return;
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
        prevScrollTop.current = 0;
        if (!searchTerm) setSearchVisible(false);
    }, [selectedCategory, isIOS, searchTerm]);

    const handleNotesScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        if (!isIOS) return;
        const scrollTop = e.currentTarget.scrollTop;
        if (scrollTop < prevScrollTop.current && scrollTop <= 20) setSearchVisible(true);
        else if (scrollTop > prevScrollTop.current && scrollTop > 60 && !searchTerm) setSearchVisible(false);
        prevScrollTop.current = scrollTop;
    }, [isIOS, searchTerm]);

    // Toggles between Detailed (with preview) and Compact (titles only) view
    const toggleView = () => {
        const newState = !isCompact;
        setIsCompact(newState);
        localStorage.setItem('notelist-compact', String(newState));
    };

    return (
        <div className={clsx(
            "flex flex-col h-full w-full md:border-r border-gray-100 dark:border-gray-800 transition-colors duration-300",
            className
        )} style={{ backgroundColor: 'var(--app-bg)' }}>

            {/* --- HEADER: SEARCH & FILTER --- */}
            <div>
                <div className={clsx(
                    "overflow-hidden transition-all duration-200",
                    (searchVisible || !isIOS) ? "max-h-16 px-3 pt-3 pb-1" : "max-h-0"
                )}>
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
                </div>

                {/* CURRENT CONTEXT INFO */}
                <div className={clsx("flex items-center justify-between px-4 pb-1", (searchVisible || !isIOS) ? "pt-2" : "pt-3")}>
                    <div className="flex flex-col min-w-0">
                        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 truncate">
                            {folders.includes(selectedCategory || '') ? selectedCategory : 'All Notes'}
                        </h2>
                        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {notes.length} {notes.length === 1 ? 'Note' : 'Notes'}
                        </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            type="button"
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
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-2 pb-[calc(1rem+var(--safe-bottom,0vh))] custom-scrollbar" onScroll={handleNotesScroll}>
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

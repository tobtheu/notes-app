import { memo, useMemo, useState, useRef, useEffect } from 'react';
import { Trash2, Pin, FolderTree, MoreVertical } from 'lucide-react';
import clsx from 'clsx';
import type { Note } from '../types';
import { extractNoteTitle, extractNotePreview } from '../utils/markdown';
import { useNoteSwipe } from '../hooks/useNoteSwipe';
import { FolderMoveMenu } from './FolderMoveMenu';

interface NoteListItemProps {
    note: Note;
    isSelected: boolean;
    isPinned: boolean;
    noteId: string;
    dropdownOpenId: string | null;
    setDropdownOpenId: (id: string | null) => void;
    onSelectNote: (note: Note) => void;
    onTogglePin: (note: Note) => void;
    onDeleteNote: (id: string) => void;
    onMoveNote: (id: string, folder: string | null) => void;
    folders: string[];
    isExiting?: boolean;
    isNew?: boolean;
    registerItemRef?: (id: string, el: HTMLElement | null) => void;
}

export const NoteListItem = memo(({
    note,
    isSelected,
    isPinned,
    noteId,
    dropdownOpenId,
    setDropdownOpenId,
    onSelectNote,
    onTogglePin,
    onDeleteNote,
    onMoveNote,
    folders,
    isExiting = false,
    isNew = false,
    registerItemRef
}: NoteListItemProps) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

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

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        if (isMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isMenuOpen]);

    const previewText = useMemo(() => {
        return extractNotePreview(note.content);
    }, [note.content]);

    const title = useMemo(() => {
        return extractNoteTitle(note.content, note.filename);
    }, [note.content, note.filename]);

    const handleMoveNote = (folder: string | null) => {
        onMoveNote(noteId, folder);
        setSwipeOffset(0);
        isSwipedRef.current = false;
    };

    return (
        <div
            ref={(el) => {
                (menuRef as any).current = el;
                registerItemRef?.(noteId, el);
            }}
            className={clsx(
                "relative mb-1 rounded-xl note-item-wrapper",
                isExiting && "note-item-exit",
                isNew && "note-item-enter",
                (isMenuOpen || dropdownOpenId === noteId) && "z-30"
            )}
        >
            {/* Swipe Actions (Behind - only visible during active swipe gesture) */}
            <div
                style={{
                    opacity: swipeOffset !== 0 ? 1 : 0,
                    pointerEvents: swipeOffset !== 0 ? 'auto' : 'none'
                }}
                className="absolute inset-y-[2px] right-[2px] left-[2px] ml-auto flex items-center justify-end max-w-[192px] z-0 h-[calc(100%-4px)] rounded-r-xl overflow-hidden transition-opacity duration-150"
            >
                <button
                    onClick={(e) => { e.stopPropagation(); onTogglePin(note); closeSwipe(); }}
                    className={clsx(
                        "flex items-center justify-center w-14 h-full text-white transition-colors shrink-0",
                        isPinned ? "bg-[var(--accent-color)]" : "bg-gray-400 dark:bg-gray-600"
                    )}
                    title={isPinned ? "Unpin Note" : "Pin Note"}
                >
                    <Pin size={16} fill={isPinned ? "currentColor" : "none"} />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); setDropdownOpenId(dropdownOpenId === noteId ? null : noteId); closeSwipe(); }}
                    className="flex items-center justify-center w-14 h-full bg-blue-500 hover:bg-blue-600 text-white transition-colors shrink-0 folder-dropdown-trigger"
                    title="Move to Folder"
                >
                    <FolderTree size={16} />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onDeleteNote(noteId); closeSwipe(); }}
                    className="flex items-center justify-center w-14 h-full bg-red-500 hover:bg-red-600 text-white transition-colors shrink-0 rounded-r-xl"
                    title="Delete Note"
                >
                    <Trash2 size={16} />
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
                    transform: `translate3d(${swipeOffset}px, 0px, 0px)`
                }}
                className={clsx(
                    "group group/note relative p-2.5 rounded-xl cursor-pointer z-10 w-full overflow-hidden no-sidebar-drag note-card-animated border",
                    isSnapping && "transition-transform duration-200",
                    isSelected
                        ? "bg-[var(--card-active)] border-[var(--border-subtle)] shadow-sm text-[var(--text-main)]"
                        : "bg-[var(--canvas-bg)] hover:bg-[var(--card-hover)] border-transparent text-[var(--text-main)]"
                )}
            >
                <div className="flex flex-col min-w-0 gap-0.5 w-full pointer-events-none sm:pointer-events-auto">
                    <div className="flex items-start justify-between min-w-0 gap-1.5 w-full">
                        <h3 className="text-xs font-semibold text-[var(--text-main)] truncate flex-1">
                            {title}
                        </h3>
                        
                        {/* Pin indicator & 3-Dots Menu Button */}
                        <div className="flex items-center gap-1 shrink-0 relative w-4 h-4 justify-end">
                            {isPinned && (
                                <Pin size={12} className="text-[var(--accent-color)] fill-current shrink-0 group-hover/note:opacity-0 transition-opacity duration-200" />
                            )}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (dropdownOpenId === noteId) {
                                        setDropdownOpenId(null);
                                    }
                                    setIsMenuOpen(prev => !prev);
                                }}
                                className={clsx(
                                    "smooth-transition absolute p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95",
                                    isMenuOpen ? "opacity-100 bg-black/5 dark:bg-white/10 text-[var(--text-main)]" : "opacity-0 group-hover/note:opacity-100 pointer-events-none group-hover/note:pointer-events-auto"
                                )}
                                title="Note Options"
                            >
                                <MoreVertical size={13} />
                            </button>
                        </div>
                    </div>

                    <p className="text-[11px] text-[var(--text-muted)] line-clamp-1 leading-normal">
                        {previewText}
                    </p>
                </div>
            </div>

            {/* 3-Dots Popover Menu */}
            {isMenuOpen && (
                <div
                    className="absolute right-2 top-8 z-50 bg-[var(--canvas-bg)] border border-[var(--border-subtle)] shadow-xl rounded-2xl py-1.5 w-40 text-xs font-medium animate-popover-expand backdrop-blur-xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        type="button"
                        onClick={() => {
                            onTogglePin(note);
                            setIsMenuOpen(false);
                        }}
                        className="smooth-transition w-full text-left px-3 py-1.5 hover:bg-[var(--card-hover)] flex items-center gap-2 text-[var(--text-main)] active:scale-95"
                    >
                        <Pin size={13} className={clsx("text-[var(--text-muted)]", isPinned && "fill-current text-[var(--accent-color)]")} />
                        <span>{isPinned ? 'Unpin Note' : 'Pin Note'}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setIsMenuOpen(false);
                            setDropdownOpenId(dropdownOpenId === noteId ? null : noteId);
                        }}
                        className="smooth-transition w-full text-left px-3 py-1.5 hover:bg-[var(--card-hover)] flex items-center gap-2 text-[var(--text-main)] active:scale-95 folder-dropdown-trigger"
                    >
                        <FolderTree size={13} className="text-[var(--text-muted)]" />
                        <span>Move to...</span>
                    </button>
                    <div className="h-px bg-[var(--border-subtle)] my-1 mx-2" />
                    <button
                        type="button"
                        onClick={() => {
                            setIsMenuOpen(false);
                            onDeleteNote(noteId);
                        }}
                        className="smooth-transition w-full text-left px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 flex items-center gap-2 active:scale-95"
                    >
                        <Trash2 size={13} />
                        <span>Delete</span>
                    </button>
                </div>
            )}

            {/* Folder Move Menu */}
            {dropdownOpenId === noteId && (
                <FolderMoveMenu
                    noteFolder={note.folder}
                    folders={folders}
                    onMoveNote={handleMoveNote}
                    onClose={() => setDropdownOpenId(null)}
                />
            )}
        </div>
    );
});

NoteListItem.displayName = 'NoteListItem';

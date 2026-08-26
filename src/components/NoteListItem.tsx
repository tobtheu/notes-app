import { memo, useMemo, useState, useRef, useEffect } from 'react';
import { Pin, MoreVertical } from 'lucide-react';
import clsx from 'clsx';
import type { Note } from '../types';
import { extractNoteTitle, extractNotePreview } from '../utils/markdown';
import { useNoteSwipe } from '../hooks/useNoteSwipe';
import { FolderMoveMenu } from './FolderMoveMenu';
import { NoteSwipeActions, NoteMenuPopover } from './NoteItemActions';
import { useTranslation } from '../i18n';

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
    const { t } = useTranslation();
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
            {/* Swipe Actions (Behind) */}
            <NoteSwipeActions
                note={note}
                noteId={noteId}
                isPinned={isPinned}
                swipeOffset={swipeOffset}
                dropdownOpenId={dropdownOpenId}
                setDropdownOpenId={setDropdownOpenId}
                onTogglePin={onTogglePin}
                onDeleteNote={onDeleteNote}
                closeSwipe={closeSwipe}
            />

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
                                title={t('common.more')}
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
            <NoteMenuPopover
                isOpen={isMenuOpen}
                onClose={() => setIsMenuOpen(false)}
                note={note}
                noteId={noteId}
                isPinned={isPinned}
                dropdownOpenId={dropdownOpenId}
                setDropdownOpenId={setDropdownOpenId}
                onTogglePin={onTogglePin}
                onDeleteNote={onDeleteNote}
            />

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

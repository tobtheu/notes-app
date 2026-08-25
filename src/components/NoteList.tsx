import { useState, useRef, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import { Plus } from 'lucide-react';
import type { Note } from '../types';
import { NoteListItem } from './NoteListItem';
import { NoteListHeader } from './NoteListHeader';
import { useNoteListAnimations } from '../hooks/useNoteListAnimations';

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
    onCreateNote?: () => void;
}

/**
 * NoteList Component
 * Renders notes divided into PINNED and Category/All Notes sections matching the Mockup.
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
    onCreateNote,
}: NoteListProps) {
    // Tracks which note's folder selection menu is currently open
    const [dropdownOpenId, setDropdownOpenId] = useState<string | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.folder-dropdown-trigger') && !target.closest('.folder-dropdown-menu')) {
                setDropdownOpenId(null);

                const blockClick = (clickEvent: MouseEvent) => {
                    clickEvent.stopPropagation();
                    clickEvent.preventDefault();
                    document.removeEventListener('click', blockClick, { capture: true });
                };
                document.addEventListener('click', blockClick, { capture: true });

                setTimeout(() => {
                    if (typeof document !== 'undefined') {
                        document.removeEventListener('click', blockClick, { capture: true });
                    }
                }, 50);
            }
        };
        
        if (dropdownOpenId) {
            document.addEventListener('mousedown', handleClickOutside, { capture: true });
            document.addEventListener('touchstart', handleClickOutside, { capture: true });
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside, { capture: true });
            document.removeEventListener('touchstart', handleClickOutside, { capture: true });
        };
    }, [dropdownOpenId]);

    const [searchVisible, setSearchVisible] = useState(!isIOS);
    const prevScrollTop = useRef(0);
    const iosDetectedRef = useRef(false);

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

    // FLIP layout, Delete & Enter animations
    const {
        exitingNoteIds,
        newlyCreatedNoteIds,
        registerItemRef,
        handleDeleteNoteWithAnimation,
    } = useNoteListAnimations({
        notes,
        selectedCategory,
        isNotePinned,
        getNoteId,
        onDeleteNote,
        scrollContainerRef,
    });

    // Separate notes into Pinned and Unpinned
    const pinnedNotes = notes.filter(n => isNotePinned(n));
    const unpinnedNotes = notes.filter(n => !isNotePinned(n));
    const categoryTitle = (selectedCategory || 'All Notes').toUpperCase();

    return (
        <div className={clsx(
            "flex flex-col h-full w-full bg-[var(--canvas-bg)] transition-colors duration-300",
            className
        )}>
            {/* --- SEARCH BAR --- */}
            <NoteListHeader
                searchVisible={searchVisible}
                isIOS={isIOS}
                searchTerm={searchTerm}
                onSearchChange={onSearchChange}
            />

            {/* --- NOTES SCROLL AREA --- */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-3 pb-[calc(1rem+var(--safe-bottom,0vh))] custom-scrollbar space-y-3" onScroll={handleNotesScroll}>
                {notes.length === 0 ? (
                    <div className="p-8 text-center text-[var(--text-muted)] text-xs">
                        No notes found.
                    </div>
                ) : (
                    <>
                        {/* SECTION 1: PINNED NOTES */}
                        {pinnedNotes.length > 0 && (
                            <div>
                                <div className="flex items-center justify-between px-1 mb-1.5 text-[10px] font-semibold tracking-wider text-[var(--text-muted)] uppercase select-none">
                                    <span>PINNED</span>
                                    <span className="text-[9px] text-[var(--text-muted)] font-mono">{pinnedNotes.length}</span>
                                </div>
                                <div className="space-y-1">
                                    {pinnedNotes.map((note) => {
                                        const noteId = getNoteId(note);
                                        const isSelected = selectedNote ? getNoteId(selectedNote) === noteId : false;

                                        return (
                                            <NoteListItem
                                                key={noteId}
                                                note={note}
                                                isSelected={isSelected}
                                                isPinned={true}
                                                noteId={noteId}
                                                dropdownOpenId={dropdownOpenId}
                                                setDropdownOpenId={setDropdownOpenId}
                                                onSelectNote={onSelectNote}
                                                onTogglePin={onTogglePin}
                                                onDeleteNote={handleDeleteNoteWithAnimation}
                                                onMoveNote={onMoveNote}
                                                folders={folders}
                                                isExiting={exitingNoteIds.has(noteId)}
                                                isNew={newlyCreatedNoteIds.has(noteId)}
                                                registerItemRef={registerItemRef}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* SECTION 2: CATEGORY / UNPINNED NOTES */}
                        <div>
                            <div className="flex items-center justify-between px-1 mb-1.5 text-[10px] font-semibold tracking-wider text-[var(--text-muted)] uppercase select-none">
                                <span className="truncate">{categoryTitle}</span>
                                {onCreateNote && (
                                    <button
                                        type="button"
                                        onClick={onCreateNote}
                                        className="smooth-transition text-[var(--text-muted)] hover:text-[var(--text-main)] p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 active:scale-95"
                                        title="New Note"
                                    >
                                        <Plus size={13} />
                                    </button>
                                )}
                            </div>
                            <div className="space-y-1">
                                {unpinnedNotes.map((note) => {
                                    const noteId = getNoteId(note);
                                    const isSelected = selectedNote ? getNoteId(selectedNote) === noteId : false;

                                    return (
                                        <NoteListItem
                                            key={noteId}
                                            note={note}
                                            isSelected={isSelected}
                                            isPinned={false}
                                            noteId={noteId}
                                            dropdownOpenId={dropdownOpenId}
                                            setDropdownOpenId={setDropdownOpenId}
                                            onSelectNote={onSelectNote}
                                            onTogglePin={onTogglePin}
                                            onDeleteNote={handleDeleteNoteWithAnimation}
                                            onMoveNote={onMoveNote}
                                            folders={folders}
                                            isExiting={exitingNoteIds.has(noteId)}
                                            isNew={newlyCreatedNoteIds.has(noteId)}
                                            registerItemRef={registerItemRef}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* --- NOTE LIST FOOTER --- */}
            {onCreateNote && (
                <div className="p-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-muted)] px-3 select-none shrink-0 bg-[var(--canvas-bg)]">
                    <span className="font-mono">{notes.length} Notes</span>
                    <button
                        type="button"
                        onClick={onCreateNote}
                        className="smooth-transition hover:text-[var(--text-main)] font-medium flex items-center gap-1 active:scale-95 text-[11px]"
                    >
                        <span>New Note ({typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘N' : 'Ctrl+N'})</span>
                    </button>
                </div>
            )}
        </div>
    );
}

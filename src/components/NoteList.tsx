import { useState, useRef, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import type { Note } from '../types';
import { NoteListItem } from './NoteListItem';
import { NoteListHeader } from './NoteListHeader';

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

/**
 * NoteList Component
 * Renders the searchable list of notes. Handles scroll visibility of the search bar,
 * compact vs detailed view toggles, and coordinates note list rows.
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

                // Create a temporary click blocker to absorb the subsequent 'click' event
                const blockClick = (clickEvent: MouseEvent) => {
                    clickEvent.stopPropagation();
                    clickEvent.preventDefault();
                    document.removeEventListener('click', blockClick, { capture: true });
                };
                document.addEventListener('click', blockClick, { capture: true });

                setTimeout(() => {
                    document.removeEventListener('click', blockClick, { capture: true });
                }, 1000);
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
            <NoteListHeader
                searchVisible={searchVisible}
                isIOS={isIOS}
                searchTerm={searchTerm}
                onSearchChange={onSearchChange}
                selectedCategory={selectedCategory}
                folders={folders}
                notesCount={notes.length}
                isCompact={isCompact}
                toggleView={toggleView}
            />

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

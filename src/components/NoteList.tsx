import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import clsx from 'clsx';
import { Plus } from 'lucide-react';
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

    // Animation states
    const [exitingNoteIds, setExitingNoteIds] = useState<Set<string>>(new Set());
    const [newlyCreatedNoteIds, setNewlyCreatedNoteIds] = useState<Set<string>>(new Set());
    const hasMountedRef = useRef(false);
    const prevCategoryRef = useRef(selectedCategory);
    const prevNoteIdsRef = useRef<Set<string>>(new Set(notes.map(n => getNoteId(n))));

    // FLIP animation tracking for smooth Pin / Unpin and reorder transitions
    const itemElementsRef = useRef<Map<string, HTMLElement>>(new Map());
    const prevTopsRef = useRef<Map<string, number>>(new Map());
    const isInitialRenderRef = useRef(true);

    useLayoutEffect(() => {
        const prevTops = prevTopsRef.current;
        const currentTops = new Map<string, number>();
        const scrollParent = scrollContainerRef.current;
        const scrollTop = scrollParent ? scrollParent.scrollTop : 0;

        const categoryChanged = prevCategoryRef.current !== selectedCategory;
        if (categoryChanged) {
            prevCategoryRef.current = selectedCategory;
        }

        // Measure all connected elements (scroll-invariant)
        itemElementsRef.current.forEach((el, id) => {
            if (el && el.isConnected) {
                currentTops.set(id, el.getBoundingClientRect().top + scrollTop);
            }
        });

        // Initialize positions quietly without FLIP animations on initial load, category switch, or empty prevTops
        if (categoryChanged || prevTops.size === 0 || isInitialRenderRef.current) {
            if (currentTops.size > 0) {
                isInitialRenderRef.current = false;
            }
            prevTopsRef.current = currentTops;
            return;
        }

        // Apply FLIP only for elements whose position moved dynamically (e.g. Pin/Unpin, Reorder)
        itemElementsRef.current.forEach((el, id) => {
            if (el && el.isConnected) {
                const elementTop = currentTops.get(id);
                const oldTop = prevTops.get(id);
                if (elementTop !== undefined && oldTop !== undefined && Math.abs(oldTop - elementTop) > 2 && !exitingNoteIds.has(id)) {
                    const deltaY = oldTop - elementTop;
                    el.style.transform = `translate3d(0, ${deltaY}px, 0)`;
                    el.style.transition = 'none';

                    requestAnimationFrame(() => {
                        el.style.transition = 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)';
                        el.style.transform = 'translate3d(0, 0, 0)';
                        const cleanUp = () => {
                            el.style.transition = '';
                            el.style.transform = '';
                            el.removeEventListener('transitionend', cleanUp);
                        };
                        el.addEventListener('transitionend', cleanUp);
                    });
                }
            }
        });

        prevTopsRef.current = currentTops;
    }, [notes, isNotePinned, selectedCategory, exitingNoteIds]);

    const registerItemRef = useCallback((id: string, el: HTMLElement | null) => {
        if (el) {
            itemElementsRef.current.set(id, el);
        } else {
            itemElementsRef.current.delete(id);
        }
    }, []);

    useEffect(() => {
        const currentIds = new Set(notes.map(n => getNoteId(n)));

        // Skip animation on initial mount or category switch
        if (!hasMountedRef.current || prevCategoryRef.current !== selectedCategory) {
            hasMountedRef.current = true;
            prevCategoryRef.current = selectedCategory;
            prevNoteIdsRef.current = currentIds;
            return;
        }

        const addedIds: string[] = [];
        for (const id of currentIds) {
            if (!prevNoteIdsRef.current.has(id)) {
                addedIds.push(id);
            }
        }
        prevNoteIdsRef.current = currentIds;

        if (addedIds.length > 0) {
            setNewlyCreatedNoteIds(prev => {
                const next = new Set(prev);
                addedIds.forEach(id => next.add(id));
                return next;
            });
            const timer = setTimeout(() => {
                setNewlyCreatedNoteIds(prev => {
                    const next = new Set(prev);
                    addedIds.forEach(id => next.delete(id));
                    return next;
                });
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [notes, getNoteId, selectedCategory]);

    // Delete animation: smoothly collapse height over 220ms, pre-sample positions, then delete in DB
    const handleDeleteNoteWithAnimation = useCallback((id: string) => {
        setExitingNoteIds(prev => new Set(prev).add(id));
        setTimeout(() => {
            // Re-sample positions of remaining items right after CSS height collapse has completed
            // so FLIP doesn't perform a duplicate jump/twitch
            const scrollParent = scrollContainerRef.current;
            const scrollTop = scrollParent ? scrollParent.scrollTop : 0;
            const updatedTops = new Map<string, number>();
            itemElementsRef.current.forEach((el, noteId) => {
                if (el && el.isConnected && noteId !== id) {
                    updatedTops.set(noteId, el.getBoundingClientRect().top + scrollTop);
                }
            });
            prevTopsRef.current = updatedTops;
            onDeleteNote(id);
        }, 220);
    }, [onDeleteNote]);

    useEffect(() => {
        if (exitingNoteIds.size === 0) return;
        const currentIds = new Set(notes.map(n => getNoteId(n)));
        setExitingNoteIds(prev => {
            let changed = false;
            const next = new Set(prev);
            for (const id of prev) {
                if (!currentIds.has(id)) {
                    next.delete(id);
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, [notes, getNoteId, exitingNoteIds]);

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

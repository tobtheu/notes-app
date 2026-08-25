import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import type { Note } from '../types';

interface UseNoteListAnimationsProps {
    notes: Note[];
    selectedCategory: string | null;
    isNotePinned: (note: Note) => boolean;
    getNoteId: (note: Note) => string;
    onDeleteNote: (id: string) => void;
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

export function useNoteListAnimations({
    notes,
    selectedCategory,
    isNotePinned,
    getNoteId,
    onDeleteNote,
    scrollContainerRef,
}: UseNoteListAnimationsProps) {
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
    }, [notes, isNotePinned, selectedCategory, exitingNoteIds, scrollContainerRef]);

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
    }, [onDeleteNote, scrollContainerRef]);

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

    return {
        exitingNoteIds,
        newlyCreatedNoteIds,
        registerItemRef,
        handleDeleteNoteWithAnimation,
    };
}

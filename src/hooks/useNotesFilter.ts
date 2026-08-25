import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Note, AppMetadata } from '../types';
import { normalizeStr } from '../utils/path';

interface UseNotesFilterProps {
    notes: Note[];
    searchTerm: string;
    selectedCategory: string | null;
    selectedNoteId: string | null;
    metadata: AppMetadata;
    getNoteId: (note: Note) => string;
}

export function useNotesFilter({
    notes,
    searchTerm,
    selectedCategory,
    selectedNoteId,
    metadata,
    getNoteId
}: UseNotesFilterProps) {
    const pinnedSet = useMemo(
        () => new Set((metadata.pinnedNotes ?? []).map(normalizeStr)),
        [metadata.pinnedNotes],
    );

    const isNotePinned = useCallback(
        (note: Note) => pinnedSet.has(normalizeStr(getNoteId(note))),
        [getNoteId, pinnedSet],
    );

    // Debounce the search term so every keystroke doesn't trigger a full re-filter
    const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchTerm), 150);
        return () => clearTimeout(t);
    }, [searchTerm]);

    // ── Derived state — filtering & sorting ───────────────────────────────────
    const filteredNotes = useMemo(() => {
        const searchLower = debouncedSearch.toLowerCase();
        const normalizedCategory = selectedCategory ? normalizeStr(selectedCategory) : null;

        // Pre-filter notes
        const matching: Note[] = [];
        for (let i = 0; i < notes.length; i++) {
            const note = notes[i];
            if (debouncedSearch && !note.content.toLowerCase().includes(searchLower) && !note.filename.toLowerCase().includes(searchLower)) {
                continue;
            }
            if (normalizedCategory && normalizeStr(note.folder) !== normalizedCategory) {
                continue;
            }
            matching.push(note);
        }

        // If selectedNoteId is newly created and not yet in notes rows, inject it at the top
        if (selectedNoteId && !notes.some(n => getNoteId(n) === selectedNoteId)) {
            const lastSlash = selectedNoteId.lastIndexOf('/');
            const filename = lastSlash >= 0 ? selectedNoteId.slice(lastSlash + 1) : selectedNoteId;
            const folder = lastSlash >= 0 ? selectedNoteId.slice(0, lastSlash) : '';
            if (!normalizedCategory || normalizeStr(folder) === normalizedCategory) {
                matching.unshift({
                    filename,
                    folder,
                    content: '# ',
                    updatedAt: new Date().toISOString(),
                });
            }
        }

        return matching.sort((a, b) => {
            const aPinned = isNotePinned(a);
            const bPinned = isNotePinned(b);
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;
            const dateCompare = b.updatedAt.localeCompare(a.updatedAt);
            if (dateCompare !== 0) return dateCompare;
            return a.filename.localeCompare(b.filename);
        });
    }, [notes, debouncedSearch, selectedCategory, isNotePinned, selectedNoteId, getNoteId]);

    const lastValidSelectedNote = useRef<Note | null>(null);
    const selectedNote = useMemo(() => {
        if (!selectedNoteId) return null;
        const found = notes.find(n => getNoteId(n) === selectedNoteId);
        if (found) return found;

        // If not found in DB rows yet (freshly created note), return optimistic draft instantly
        const lastSlash = selectedNoteId.lastIndexOf('/');
        const filename = lastSlash >= 0 ? selectedNoteId.slice(lastSlash + 1) : selectedNoteId;
        const folder = lastSlash >= 0 ? selectedNoteId.slice(0, lastSlash) : '';
        return {
            filename,
            folder,
            content: '# ',
            updatedAt: new Date().toISOString(),
        };
    }, [selectedNoteId, notes, getNoteId]);

    // Commit the resolved selection to the ref only after render (not during)
    useEffect(() => {
        if (!selectedNoteId) {
            lastValidSelectedNote.current = null;
            return;
        }
        if (selectedNote && (!lastValidSelectedNote.current
            || getNoteId(selectedNote) !== getNoteId(lastValidSelectedNote.current)
            || selectedNote.content !== lastValidSelectedNote.current.content)) {
            lastValidSelectedNote.current = selectedNote;
        }
    }, [selectedNoteId, selectedNote, getNoteId]);

    return {
        filteredNotes,
        selectedNote,
        isNotePinned,
        pinnedSet,
    };
}

import { describe, it, expect } from 'vitest'
import { getPathId, normalizeStr } from '../utils/path'
import type { Note } from '../types'

/**
 * Tests for the filename collision resolution logic from useNotes.tsx.
 *
 * The logic extracted here mirrors what saveNote does:
 * When a note is being renamed (e.g. "Untitled note.md" → "Anpassungen.md"),
 * if "Anpassungen.md" already exists in the same folder, it should become
 * "Anpassungen 2.md" instead of silently keeping "Untitled note.md".
 */

function makeNote(filename: string, folder: string = ''): Note {
    return { filename, folder, content: `# ${filename}`, updatedAt: new Date().toISOString() }
}

function getNoteId(note: Note): string {
    return getPathId(note.filename, note.folder || '')
}

/**
 * Resolves filename collisions — identical logic to useNotes.tsx saveNote.
 * If the target filename is already taken by a different note, the rename is
 * blocked and the current filename is returned unchanged.
 */
function resolveCollision(
    targetFilename: string,
    currentId: string,
    currentFilename: string,
    folder: string,
    currentNotes: Note[],
): string {
    const collision = currentNotes.some((n) =>
        normalizeStr(n.filename) === normalizeStr(targetFilename) &&
        normalizeStr(n.folder) === normalizeStr(folder || '') &&
        getNoteId(n) !== currentId
    )
    return collision ? currentFilename : targetFilename
}

// ---------------------------------------------------------------------------
// Collision resolution
// ---------------------------------------------------------------------------
describe('filename collision resolution', () => {
    it('returns target filename when no collision exists', () => {
        const notes = [makeNote('Other.md')]
        const result = resolveCollision('Anpassungen.md', 'untitled note.md', 'Untitled note.md', '', notes)
        expect(result).toBe('Anpassungen.md')
    })

    it('blocks rename and keeps current filename when target collides', () => {
        const notes = [
            makeNote('Anpassungen.md'),
            makeNote('Untitled note.md'),
        ]
        const currentId = getNoteId(notes[1])
        const result = resolveCollision('Anpassungen.md', currentId, 'Untitled note.md', '', notes)
        expect(result).toBe('Untitled note.md')
    })

    it('allows rename when the only matching note IS the current note (same ID)', () => {
        // A note saving its own current filename should not be blocked
        const notes = [makeNote('Anpassungen.md')]
        const currentId = getNoteId(notes[0])
        const result = resolveCollision('Anpassungen.md', currentId, 'Anpassungen.md', '', notes)
        expect(result).toBe('Anpassungen.md')
    })

    it('handles case-insensitive collision', () => {
        const notes = [
            makeNote('anpassungen.md'),
            makeNote('Untitled note.md'),
        ]
        const currentId = getNoteId(notes[1])
        const result = resolveCollision('Anpassungen.md', currentId, 'Untitled note.md', '', notes)
        expect(result).toBe('Untitled note.md')
    })

    it('blocks rename in subfolder scope', () => {
        const notes = [
            makeNote('Note.md', 'Work'),
            makeNote('Note.md', 'Personal'), // same name, different folder — NOT a collision
            makeNote('Untitled note.md', 'Work'),
        ]
        const currentId = getNoteId(notes[2])
        const result = resolveCollision('Note.md', currentId, 'Untitled note.md', 'Work', notes)
        expect(result).toBe('Untitled note.md')
    })

    it('does NOT block rename across different folders', () => {
        const notes = [
            makeNote('Note.md', 'Work'),
            makeNote('Untitled note.md', 'Personal'),
        ]
        const currentId = getNoteId(notes[1])
        const result = resolveCollision('Note.md', currentId, 'Untitled note.md', 'Personal', notes)
        expect(result).toBe('Note.md') // No collision — different folder
    })
})

// ---------------------------------------------------------------------------
// Note ID consistency
// ---------------------------------------------------------------------------
describe('note ID generation consistency', () => {
    it('two notes with same filename and folder get the same ID', () => {
        const a = makeNote('Test.md', 'Work')
        const b = makeNote('Test.md', 'Work')
        expect(getNoteId(a)).toBe(getNoteId(b))
    })

    it('ID changes when a note is moved to a different folder', () => {
        const note = makeNote('Test.md', 'Work')
        const movedNote = { ...note, folder: 'Personal' }
        expect(getNoteId(note)).not.toBe(getNoteId(movedNote))
    })

    it('ID changes when a note is renamed', () => {
        const note = makeNote('Old.md', '')
        const renamedNote = { ...note, filename: 'New.md' }
        expect(getNoteId(note)).not.toBe(getNoteId(renamedNote))
    })

    it('ID is case-insensitive', () => {
        const a = makeNote('Note.md', 'Work')
        const b = makeNote('note.md', 'work')
        expect(getNoteId(a)).toBe(getNoteId(b))
    })
})

// ---------------------------------------------------------------------------
// Stale pin cleanup logic (mirrors loadNotes pin cleanup)
// ---------------------------------------------------------------------------

/**
 * Simulates the pin cleanup logic from useNotes.tsx loadNotes.
 * Removes pinned entries for notes that no longer exist on disk.
 */
function cleanupPins(pinnedNotes: string[], existingNotes: Note[]): string[] {
    const noteIds = new Set(existingNotes.map(n => getNoteId(n)))
    return pinnedNotes.filter(p => noteIds.has(p))
}

describe('stale pin cleanup', () => {
    it('keeps pins for existing notes', () => {
        const notes = [
            makeNote('Ideen.md', 'App Development'),
            makeNote('Bugs.md', 'App Development'),
        ]
        const pins = ['app development/ideen.md', 'app development/bugs.md']
        const cleaned = cleanupPins(pins, notes)
        expect(cleaned).toEqual(pins)
    })

    it('removes pins for notes that no longer exist', () => {
        const notes = [makeNote('Ideen.md', 'App Development')]
        const pins = [
            'app development/ideen.md',
            'app development/deleted-note.md', // no longer on disk
        ]
        const cleaned = cleanupPins(pins, notes)
        expect(cleaned).toEqual(['app development/ideen.md'])
    })

    it('removes stale "Untitled note.md" pin that would affect new notes', () => {
        // This is the exact bug scenario: a previously pinned "Untitled note.md"
        // was deleted, but its pin entry remained. When a new note is created with
        // the same default filename, it incorrectly appears pinned.
        const existingNotes = [
            makeNote('Ideen.md', 'App Development'),
        ]
        const pins = [
            'app development/ideen.md',
            'app development/untitled note.md', // stale pin from deleted note
        ]
        const cleaned = cleanupPins(pins, existingNotes)
        expect(cleaned).toEqual(['app development/ideen.md'])
        expect(cleaned).not.toContain('app development/untitled note.md')
    })

    it('new note with reused filename is NOT pinned after cleanup', () => {
        // Simulate: stale pin exists, new note created with same filename
        const notesBeforeCreation = [makeNote('Ideen.md', 'App Development')]
        const pins = ['app development/ideen.md', 'app development/untitled note.md']

        // Cleanup runs during loadNotes (before new note is created)
        const cleanedPins = cleanupPins(pins, notesBeforeCreation)
        expect(cleanedPins).not.toContain('app development/untitled note.md')

        // Now user creates new note — it should NOT be pinned
        const newNote = makeNote('Untitled note.md', 'App Development')
        const newNoteId = getNoteId(newNote)
        expect(cleanedPins.includes(newNoteId)).toBe(false)
    })

    it('handles empty pins array', () => {
        const notes = [makeNote('Note.md')]
        expect(cleanupPins([], notes)).toEqual([])
    })

    it('handles empty notes array', () => {
        const pins = ['note.md']
        expect(cleanupPins(pins, [])).toEqual([])
    })

    it('preserves pin order after cleanup', () => {
        const notes = [
            makeNote('A.md'),
            makeNote('C.md'),
        ]
        const pins = ['a.md', 'b.md', 'c.md'] // b.md doesn't exist
        const cleaned = cleanupPins(pins, notes)
        expect(cleaned).toEqual(['a.md', 'c.md']) // order preserved
    })
})

// ---------------------------------------------------------------------------
// Zombie Protection — mirrors saveNote ID-first lookup guard
//
// Root cause of the "Bugs.md gets Ideen.md content" bug:
// saveNote had a fallback that matched notes by filename when ID lookup failed.
// If a sync renamed "Bugs.md" → "Ideen2.md" and state was stale, the fallback
// found the wrong note by filename and wrote content into the wrong file.
//
// The fix: abort if ID not found. No filename fallback.
// ---------------------------------------------------------------------------

/**
 * Simulates the saveNote ID lookup + zombie guard from useNotes.tsx.
 * Returns the note found by ID, or null if not found (save should be aborted).
 * The filename parameter is intentionally NOT used as a fallback.
 */
function lookupNoteById(currentId: string, notes: Note[]): Note | null {
    return notes.find(n => getNoteId(n) === currentId) ?? null
}

function shouldAbortSave(
    currentId: string,
    filename: string,
    skipRename: boolean,
    notes: Note[],
): boolean {
    const found = lookupNoteById(currentId, notes)
    if (found) return false
    // Quick Note creation exception: allowed through when skipRename=true
    if (filename === 'Quick Note.md' && skipRename) return false
    return true
}

describe('zombie protection — ID-first save guard', () => {
    it('proceeds when note is found by ID', () => {
        const notes = [makeNote('Bugs.md', 'App Development')]
        const id = getNoteId(notes[0])
        expect(shouldAbortSave(id, 'Bugs.md', false, notes)).toBe(false)
    })

    it('aborts when note ID is not in state (sync deleted/renamed it)', () => {
        // This is the "Bugs.md gets Ideen content" scenario:
        // Editor still holds old ID "app development/bugs.md" but sync renamed the file.
        const notes = [makeNote('Ideen.md', 'App Development')] // Bugs.md is gone
        const staleId = getPathId('Bugs.md', 'App Development')
        expect(shouldAbortSave(staleId, 'Bugs.md', false, notes)).toBe(true)
    })

    it('does NOT fall back to filename match when ID is missing', () => {
        // The old buggy behavior would find "Bugs.md" by filename even though the
        // ID was stale. This test ensures we never do that.
        const notes = [makeNote('Bugs.md', 'App Development')]
        const staleId = 'app development/bugs-old.md' // wrong ID
        // Even though "Bugs.md" exists in state, the ID doesn't match → abort
        expect(shouldAbortSave(staleId, 'Bugs.md', false, notes)).toBe(true)
    })

    it('allows Quick Note creation when note is not yet in state (skipRename=true)', () => {
        const notes = [makeNote('Other.md')]
        expect(shouldAbortSave('quick note.md', 'Quick Note.md', true, notes)).toBe(false)
    })

    it('aborts Quick Note save when skipRename=false (not a creation path)', () => {
        const notes = [makeNote('Other.md')]
        // Without skipRename=true this is not the creation path — should abort
        expect(shouldAbortSave('quick note.md', 'Quick Note.md', false, notes)).toBe(true)
    })

    it('proceeds for Quick Note when it already exists in state', () => {
        const notes = [makeNote('Quick Note.md')]
        const id = getNoteId(notes[0])
        expect(shouldAbortSave(id, 'Quick Note.md', false, notes)).toBe(false)
    })

    it('aborts when ID is empty string', () => {
        // Empty ID means the note was never properly created
        const notes = [makeNote('Bugs.md', 'App Development')]
        // Empty currentId → currentNotes.find returns undefined → abort
        // (In production, currentId is never truly empty for a created note,
        //  but guard should hold regardless)
        const found = lookupNoteById('', notes)
        expect(found).toBeNull()
    })
})

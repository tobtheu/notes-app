import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNotesOperations } from '../hooks/useNotesOperations';
import type { Note, AppMetadata } from '../types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('createNote & CRUD — UUID Database-First Operations', () => {
    let mockDb: any;
    let dbRef: { current: any };
    let metadataRef: { current: AppMetadata };
    let writeNote: any;
    let writeConfig: any;
    const userId = 'user-test-123';

    beforeEach(() => {
        mockDb = {
            query: vi.fn().mockResolvedValue({ rows: [] }),
        };
        dbRef = { current: mockDb };
        metadataRef = { current: { folders: {}, pinnedNotes: [] } };
        writeNote = vi.fn().mockResolvedValue(undefined);
        writeConfig = vi.fn().mockResolvedValue(undefined);
    });

    it('creates a note with a canonical UUIDv4 in the selected folder without overwriting existing notes', async () => {
        const existingNoteId = '11111111-1111-4111-8111-111111111111';
        const existingNotes: Note[] = [
            {
                id: existingNoteId,
                folder: 'Work',
                content: '# My Important Meeting\nDo not delete me!',
                updatedAt: '2026-08-24T12:00:00Z',
            },
        ];
        const setSelectedNoteId = vi.fn();

        const { result } = renderHook(() =>
            useNotesOperations({
                dbRef,
                userId,
                metadataRef,
                notes: existingNotes,
                sortedFolders: ['Work'],
                selectedNoteId: existingNoteId,
                setSelectedNoteId,
                selectedCategory: 'Work',
                setSelectedCategory: vi.fn(),
                writeNote,
                writeConfig,
            })
        );

        await act(async () => {
            await result.current.createNote();
        });

        // 1. Must have called setSelectedNoteId with a valid UUID
        expect(setSelectedNoteId).toHaveBeenCalledWith(expect.stringMatching(UUID_REGEX));
        const createdId = setSelectedNoteId.mock.calls[0][0];

        // 2. Created ID must be distinct from existing note ID
        expect(createdId).not.toBe(existingNoteId);

        // 3. writeNote called with (id, folder, content, updatedAt, deleted)
        expect(writeNote).toHaveBeenCalledWith(
            createdId,
            'Work',
            '# ',
            expect.any(String),
            false
        );

        // Existing note was never touched or overwritten
        expect(writeNote).not.toHaveBeenCalledWith(
            existingNoteId,
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything()
        );
    });

    it('creates a note with root folder ("") when no category is selected', async () => {
        const setSelectedNoteId = vi.fn();

        const { result } = renderHook(() =>
            useNotesOperations({
                dbRef,
                userId,
                metadataRef,
                notes: [],
                sortedFolders: [],
                selectedNoteId: null,
                setSelectedNoteId,
                selectedCategory: null,
                setSelectedCategory: vi.fn(),
                writeNote,
                writeConfig,
            })
        );

        await act(async () => {
            await result.current.createNote();
        });

        expect(setSelectedNoteId).toHaveBeenCalledWith(expect.stringMatching(UUID_REGEX));
        const createdId = setSelectedNoteId.mock.calls[0][0];

        expect(writeNote).toHaveBeenCalledWith(
            createdId,
            '',
            '# ',
            expect.any(String),
            false
        );
    });

    it('prevents collision on rapid consecutive calls by generating distinct UUIDs', async () => {
        const setSelectedNoteId = vi.fn();

        const { result } = renderHook(() =>
            useNotesOperations({
                dbRef,
                userId,
                metadataRef,
                notes: [],
                sortedFolders: ['Work'],
                selectedNoteId: null,
                setSelectedNoteId,
                selectedCategory: 'Work',
                setSelectedCategory: vi.fn(),
                writeNote,
                writeConfig,
            })
        );

        await act(async () => {
            const p1 = result.current.createNote();
            const p2 = result.current.createNote();
            await Promise.all([p1, p2]);
        });

        const createdIds = setSelectedNoteId.mock.calls.map(c => c[0]);
        expect(createdIds.length).toBe(2);
        expect(createdIds[0]).toMatch(UUID_REGEX);
        expect(createdIds[1]).toMatch(UUID_REGEX);
        expect(createdIds[0]).not.toBe(createdIds[1]);
        expect(writeNote).toHaveBeenCalledTimes(2);
    });

    it('moves a note in-place without changing its UUID', async () => {
        const noteId = '22222222-2222-4222-8222-222222222222';
        const notes: Note[] = [
            {
                id: noteId,
                folder: 'Work',
                content: '# Project Plan',
                updatedAt: '2026-08-24T12:00:00Z',
            },
        ];

        const { result } = renderHook(() =>
            useNotesOperations({
                dbRef,
                userId,
                metadataRef,
                notes,
                sortedFolders: ['Work', 'Personal'],
                selectedNoteId: noteId,
                setSelectedNoteId: vi.fn(),
                selectedCategory: 'Work',
                setSelectedCategory: vi.fn(),
                writeNote,
                writeConfig,
            })
        );

        await act(async () => {
            await result.current.moveNote(noteId, 'Personal');
        });

        // writeNote should be called with the SAME noteId and new folder 'Personal'
        expect(writeNote).toHaveBeenCalledWith(
            noteId,
            'Personal',
            '# Project Plan',
            expect.any(String),
            false
        );
    });

    it('renames a folder without altering note UUIDs', async () => {
        const noteId1 = '33333333-3333-4333-8333-333333333333';
        const noteId2 = '44444444-4444-4444-8444-444444444444';
        const notes: Note[] = [
            {
                id: noteId1,
                folder: 'OldFolder',
                content: '# Note 1',
                updatedAt: '2026-08-24T12:00:00Z',
            },
            {
                id: noteId2,
                folder: 'OldFolder',
                content: '# Note 2',
                updatedAt: '2026-08-24T12:00:00Z',
            },
        ];

        const { result } = renderHook(() =>
            useNotesOperations({
                dbRef,
                userId,
                metadataRef,
                notes,
                sortedFolders: ['OldFolder'],
                selectedNoteId: noteId1,
                setSelectedNoteId: vi.fn(),
                selectedCategory: 'OldFolder',
                setSelectedCategory: vi.fn(),
                writeNote,
                writeConfig,
            })
        );

        await act(async () => {
            await result.current.renameFolder('OldFolder', 'NewFolder');
        });

        // Notes retain their UUIDs and are updated with 'NewFolder'
        expect(writeNote).toHaveBeenCalledWith(
            noteId1,
            'NewFolder',
            '# Note 1',
            expect.any(String),
            false
        );
        expect(writeNote).toHaveBeenCalledWith(
            noteId2,
            'NewFolder',
            '# Note 2',
            expect.any(String),
            false
        );
        // DB batch query was also issued
        expect(mockDb.query).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE notes SET folder = $1 WHERE folder = $2 AND user_id = $3'),
            ['NewFolder', 'OldFolder', userId]
        );
    });
});

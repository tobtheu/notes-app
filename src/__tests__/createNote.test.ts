import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNotesOperations } from '../hooks/useNotesOperations';
import type { Note, AppMetadata } from '../types';
import { getPathId } from '../utils/path';

describe('createNote — Note Creation & Collision Prevention', () => {
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

    const getNoteId = (n: Note) => getPathId(n.filename, n.folder);

    it('does NOT overwrite existing note in folder when creating a new note', async () => {
        const existingNotes: Note[] = [
            {
                filename: 'untitled note.md',
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
                selectedNoteId: 'work/untitled note.md',
                setSelectedNoteId,
                selectedCategory: 'Work',
                setSelectedCategory: vi.fn(),
                writeNote,
                writeConfig,
                getNoteId,
            })
        );

        await act(async () => {
            await result.current.createNote();
        });

        // The new note MUST have a distinct ID and not overwrite the old one
        expect(writeNote).not.toHaveBeenCalledWith('work/untitled note.md', '# ', expect.any(String), false);
        expect(writeNote).toHaveBeenCalledWith('work/untitled note 1.md', '# ', expect.any(String), false);
        expect(setSelectedNoteId).toHaveBeenCalledWith('work/untitled note 1.md');
    });

    it('does NOT overwrite existing note in root when creating a new note', async () => {
        const existingNotes: Note[] = [
            {
                filename: 'untitled note.md',
                folder: '',
                content: '# Root Note Content',
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
                sortedFolders: [],
                selectedNoteId: 'untitled note.md',
                setSelectedNoteId,
                selectedCategory: null,
                setSelectedCategory: vi.fn(),
                writeNote,
                writeConfig,
                getNoteId,
            })
        );

        await act(async () => {
            await result.current.createNote();
        });

        expect(writeNote).not.toHaveBeenCalledWith('untitled note.md', '# ', expect.any(String), false);
        expect(writeNote).toHaveBeenCalledWith('untitled note 1.md', '# ', expect.any(String), false);
        expect(setSelectedNoteId).toHaveBeenCalledWith('untitled note 1.md');
    });

    it('increments counter properly when multiple untitled notes exist', async () => {
        const existingNotes: Note[] = [
            {
                filename: 'untitled note.md',
                folder: 'Work',
                content: '# Note 0',
                updatedAt: '2026-08-24T12:00:00Z',
            },
            {
                filename: 'untitled note 1.md',
                folder: 'Work',
                content: '# Note 1',
                updatedAt: '2026-08-24T12:01:00Z',
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
                selectedNoteId: 'work/untitled note 1.md',
                setSelectedNoteId,
                selectedCategory: 'Work',
                setSelectedCategory: vi.fn(),
                writeNote,
                writeConfig,
                getNoteId,
            })
        );

        await act(async () => {
            await result.current.createNote();
        });

        expect(writeNote).toHaveBeenCalledWith('work/untitled note 2.md', '# ', expect.any(String), false);
        expect(setSelectedNoteId).toHaveBeenCalledWith('work/untitled note 2.md');
    });

    it('does not overwrite notes present in the database / trash', async () => {
        // Database contains a soft-deleted note with id 'work/untitled note.md'
        mockDb.query.mockImplementation(async (sql: string) => {
            if (sql.includes('SELECT id FROM notes')) {
                return {
                    rows: [
                        { id: 'work/untitled note.md' },
                    ],
                };
            }
            return { rows: [] };
        });

        const setSelectedNoteId = vi.fn();

        const { result } = renderHook(() =>
            useNotesOperations({
                dbRef,
                userId,
                metadataRef,
                notes: [], // active notes in memory is empty, but DB has the row
                sortedFolders: ['Work'],
                selectedNoteId: null,
                setSelectedNoteId,
                selectedCategory: 'Work',
                setSelectedCategory: vi.fn(),
                writeNote,
                writeConfig,
                getNoteId,
            })
        );

        await act(async () => {
            await result.current.createNote();
        });

        expect(writeNote).not.toHaveBeenCalledWith('work/untitled note.md', expect.any(String), expect.any(String), false);
        expect(writeNote).toHaveBeenCalledWith('work/untitled note 1.md', '# ', expect.any(String), false);
        expect(setSelectedNoteId).toHaveBeenCalledWith('work/untitled note 1.md');
    });

    it('prevents collision on rapid consecutive calls before DB state updates', async () => {
        const existingNotes: Note[] = [
            {
                filename: 'untitled note.md',
                folder: 'Work',
                content: '# Note 0',
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
                selectedNoteId: null,
                setSelectedNoteId,
                selectedCategory: 'Work',
                setSelectedCategory: vi.fn(),
                writeNote,
                writeConfig,
                getNoteId,
            })
        );

        // Rapid consecutive calls without waiting for re-render / DB update
        await act(async () => {
            const p1 = result.current.createNote();
            const p2 = result.current.createNote();
            await Promise.all([p1, p2]);
        });

        const writtenIds = writeNote.mock.calls.map((call: any[]) => call[0]);
        // Two distinct IDs must have been created, neither being the existing note
        expect(writtenIds).not.toContain('work/untitled note.md');
        expect(new Set(writtenIds).size).toBe(2);
        expect(writtenIds).toContain('work/untitled note 1.md');
        expect(writtenIds).toContain('work/untitled note 2.md');
    });
});

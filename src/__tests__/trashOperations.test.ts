import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNotesOperations } from '../hooks/useNotesOperations';
import type { Note, AppMetadata } from '../types';
import { getPathId } from '../utils/path';

describe('useNotesOperations — Trash Features', () => {
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

    it('soft-deletes a note by calling writeNote with deleted = true', async () => {
        const notes: Note[] = [
            { filename: 'meeting.md', folder: 'Work', content: '# Meeting', updatedAt: '2026-08-24T12:00:00Z' },
        ];
        const setSelectedNoteId = vi.fn();

        const { result } = renderHook(() =>
            useNotesOperations({
                dbRef,
                userId,
                metadataRef,
                notes,
                sortedFolders: ['Work'],
                selectedNoteId: 'work/meeting.md',
                setSelectedNoteId,
                selectedCategory: null,
                setSelectedCategory: vi.fn(),
                writeNote,
                writeConfig,
                getNoteId,
            })
        );

        await act(async () => {
            await result.current.deleteNote('work/meeting.md');
        });

        expect(setSelectedNoteId).toHaveBeenCalledWith(null);
        expect(writeNote).toHaveBeenCalledWith('work/meeting.md', '# Meeting', expect.any(String), true);
    });

    it('restores a soft-deleted note by querying content and calling writeNote with deleted = false', async () => {
        mockDb.query.mockResolvedValueOnce({
            rows: [{ content: '# Restored note content' }],
        });

        const { result } = renderHook(() =>
            useNotesOperations({
                dbRef,
                userId,
                metadataRef,
                notes: [],
                sortedFolders: [],
                selectedNoteId: null,
                setSelectedNoteId: vi.fn(),
                selectedCategory: null,
                setSelectedCategory: vi.fn(),
                writeNote,
                writeConfig,
                getNoteId,
            })
        );

        await act(async () => {
            await result.current.restoreNote('work/meeting.md');
        });

        expect(mockDb.query).toHaveBeenCalledWith(
            expect.stringContaining('SELECT content FROM notes WHERE id = $1 AND user_id = $2'),
            ['work/meeting.md', userId]
        );
        expect(writeNote).toHaveBeenCalledWith('work/meeting.md', '# Restored note content', expect.any(String), false);
    });

    it('permanently deletes a note by deleting from PGlite notes and pending_writes, and queuing delete', async () => {
        const { result } = renderHook(() =>
            useNotesOperations({
                dbRef,
                userId,
                metadataRef,
                notes: [],
                sortedFolders: [],
                selectedNoteId: null,
                setSelectedNoteId: vi.fn(),
                selectedCategory: null,
                setSelectedCategory: vi.fn(),
                writeNote,
                writeConfig,
                getNoteId,
            })
        );

        await act(async () => {
            await result.current.permanentlyDeleteNote('work/meeting.md');
        });

        expect(mockDb.query).toHaveBeenCalledWith(
            expect.stringContaining('DELETE FROM notes WHERE id = $1 AND user_id = $2'),
            ['work/meeting.md', userId]
        );
        expect(mockDb.query).toHaveBeenCalledWith(
            expect.stringContaining('DELETE FROM pending_writes WHERE id = $1'),
            ['notes:work/meeting.md']
        );
        expect(mockDb.query).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO pending_writes'),
            expect.arrayContaining(['notes:work/meeting.md', 'notes', 'delete'])
        );
    });

    it('empties trash by permanently deleting all notes with deleted = true', async () => {
        mockDb.query.mockResolvedValueOnce({
            rows: [{ id: 'note1.md' }, { id: 'Folder/note2.md' }],
        });

        const { result } = renderHook(() =>
            useNotesOperations({
                dbRef,
                userId,
                metadataRef,
                notes: [],
                sortedFolders: [],
                selectedNoteId: null,
                setSelectedNoteId: vi.fn(),
                selectedCategory: null,
                setSelectedCategory: vi.fn(),
                writeNote,
                writeConfig,
                getNoteId,
            })
        );

        await act(async () => {
            await result.current.emptyTrash();
        });

        expect(mockDb.query).toHaveBeenCalledWith(
            expect.stringContaining('SELECT id FROM notes WHERE user_id = $1 AND deleted = true'),
            [userId]
        );
        // Deletes note1.md and Folder/note2.md
        expect(mockDb.query).toHaveBeenCalledWith(
            expect.stringContaining('DELETE FROM notes WHERE id = $1 AND user_id = $2'),
            ['note1.md', userId]
        );
        expect(mockDb.query).toHaveBeenCalledWith(
            expect.stringContaining('DELETE FROM notes WHERE id = $1 AND user_id = $2'),
            ['folder/note2.md', userId]
        );
    });

    it('cleans expired trash notes older than 30 days', async () => {
        mockDb.query.mockResolvedValueOnce({
            rows: [{ id: 'expired-note.md' }],
        });

        const { result } = renderHook(() =>
            useNotesOperations({
                dbRef,
                userId,
                metadataRef,
                notes: [],
                sortedFolders: [],
                selectedNoteId: null,
                setSelectedNoteId: vi.fn(),
                selectedCategory: null,
                setSelectedCategory: vi.fn(),
                writeNote,
                writeConfig,
                getNoteId,
            })
        );

        await act(async () => {
            await result.current.cleanExpiredTrashNotes();
        });

        expect(mockDb.query).toHaveBeenCalledWith(
            expect.stringContaining('SELECT id FROM notes WHERE user_id = $1 AND deleted = true AND CAST(updated_at AS timestamptz) < CAST($2 AS timestamptz)'),
            [userId, expect.any(String)]
        );
        expect(mockDb.query).toHaveBeenCalledWith(
            expect.stringContaining('DELETE FROM notes WHERE id = $1 AND user_id = $2'),
            ['expired-note.md', userId]
        );
    });
});

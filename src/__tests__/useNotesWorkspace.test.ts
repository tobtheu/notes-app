import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNotesWorkspace, type ImportProgress } from '../hooks/useNotesWorkspace';

const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
vi.mock('../lib/electric', () => ({
    getDb: vi.fn().mockResolvedValue({
        query: (...args: any[]) => mockQuery(...args),
    }),
}));

describe('useNotesWorkspace', () => {
    beforeEach(() => {
        mockQuery.mockClear();
        let store: Record<string, string> = {};
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => store[key] || null,
            setItem: (key: string, value: string) => { store[key] = value.toString(); },
            removeItem: (key: string) => { delete store[key]; },
            clear: () => { store = {}; }
        });
    });

    it('starts instantly in goLocalOnly without opening folder picker', async () => {
        const dbRef = { current: null as any };
        const setUserId = vi.fn();
        const setCurrentFolder = vi.fn();
        const setSyncStatus = vi.fn();
        const writeNote = vi.fn();

        (window as any).tauriAPI = {
            selectFolder: vi.fn(),
            getDocumentDir: vi.fn().mockResolvedValue('/Users/test/Documents'),
            createFolder: vi.fn().mockResolvedValue(undefined),
        };

        const { result } = renderHook(() =>
            useNotesWorkspace({
                dbRef,
                userId: null,
                setUserId,
                setCurrentFolder,
                setSyncStatus,
                writeNote,
            })
        );

        await act(async () => {
            await result.current.goLocalOnly();
        });

        // selectFolder must NOT be called
        expect((window as any).tauriAPI.selectFolder).not.toHaveBeenCalled();
        expect((window as any).tauriAPI.createFolder).toHaveBeenCalledWith('/Users/test/Documents', '/Users/test/Documents/Lama Notes');
        expect(setCurrentFolder).toHaveBeenCalledWith('/Users/test/Documents/Lama Notes');
        expect(setUserId).toHaveBeenCalledWith('local');
        expect(setSyncStatus).toHaveBeenCalledWith('offline');
        expect(localStorage.getItem('lama-mode')).toBe('local');
    });

    it('reports progress events during importFolder', async () => {
        const dbRef = { current: { query: mockQuery } as any };
        const setUserId = vi.fn();
        const setCurrentFolder = vi.fn();
        const setSyncStatus = vi.fn();
        const writeNote = vi.fn().mockResolvedValue(undefined);

        (window as any).tauriAPI = {
            selectFolder: vi.fn().mockResolvedValue('/mock/path/notes'),
            scanImportFolder: vi.fn().mockResolvedValue([
                { relPath: 'folder1/Note1.md', content: '# Note 1', updatedAt: '2026-08-22T20:00:00Z' },
                { relPath: 'Note2.md', content: '# Note 2', updatedAt: '2026-08-22T20:00:00Z' },
            ]),
        };

        const { result } = renderHook(() =>
            useNotesWorkspace({
                dbRef,
                userId: 'local',
                setUserId,
                setCurrentFolder,
                setSyncStatus,
                writeNote,
            })
        );

        const progressUpdates: ImportProgress[] = [];
        let count = 0;
        await act(async () => {
            count = await result.current.importFolder((prog) => {
                progressUpdates.push(prog);
            });
        });

        expect(count).toBe(2);
        expect(progressUpdates).toEqual([
            { stage: 'selecting', current: 0, total: 0 },
            { stage: 'scanning', current: 0, total: 0 },
            { stage: 'importing', current: 0, total: 2 },
            { stage: 'importing', current: 1, total: 2, currentFile: 'Note1.md' },
            { stage: 'importing', current: 2, total: 2, currentFile: 'Note2.md' },
            { stage: 'done', current: 2, total: 2 },
        ]);
        expect(writeNote).toHaveBeenCalledTimes(2);
    });

    it('resets local database queries in resetDatabase', async () => {
        const dbRef = { current: null as any };
        const setUserId = vi.fn();
        const setCurrentFolder = vi.fn();
        const setSyncStatus = vi.fn();
        const writeNote = vi.fn();

        const { result } = renderHook(() =>
            useNotesWorkspace({
                dbRef,
                userId: 'local',
                setUserId,
                setCurrentFolder,
                setSyncStatus,
                writeNote,
            })
        );

        await act(async () => {
            await result.current.resetDatabase();
        });

        expect(mockQuery).toHaveBeenCalledWith('DELETE FROM notes');
        expect(mockQuery).toHaveBeenCalledWith('DELETE FROM app_config');
        expect(mockQuery).toHaveBeenCalledWith('DELETE FROM pending_writes');
    });
});

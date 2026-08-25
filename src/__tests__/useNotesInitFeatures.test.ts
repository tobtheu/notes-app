import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useNotesInit } from '../hooks/useNotesInit';

vi.mock('../lib/electric', () => ({
    getDb: vi.fn().mockResolvedValue({}),
    startElectricSync: vi.fn(),
}));

vi.mock('../lib/syncSupabase', () => ({
    pullFromSupabase: vi.fn().mockResolvedValue({ notesCount: 0, configUpdated: false }),
}));

vi.mock('../lib/offlineQueue', () => ({
    flushQueue: vi.fn().mockResolvedValue(undefined),
}));

describe('useNotesInit in offline mode', () => {
    it('sets userId to local and status to offline without invoking remote auth', async () => {
        const setUserId = vi.fn();
        const setUserEmail = vi.fn();
        const setSyncStatus = vi.fn();
        const setSyncError = vi.fn();
        const dbRef = { current: null };

        renderHook(() => useNotesInit({
            dbRef,
            userId: null,
            setUserId,
            setUserEmail,
            setSyncStatus,
            setSyncError,
        }));

        await waitFor(() => {
            expect(setUserId).toHaveBeenCalledWith('local');
            expect(setSyncStatus).toHaveBeenCalledWith('offline');
        });
    });
});

import { renderHook, waitFor } from '@testing-library/react';
import { useNotes } from '../hooks/useNotes';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@electric-sql/pglite-react', () => ({
  useLiveQuery: vi.fn().mockReturnValue({ rows: [] }),
}));

vi.mock('../lib/electric', () => ({
  getDb: vi.fn().mockResolvedValue({
    query: vi.fn().mockResolvedValue({ rows: [] }),
  }),
  startElectricSync: vi.fn(),
  stopElectricSync: vi.fn(),
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            expires_at: 0,
            user: { id: 'test-user' },
          },
        },
      }),
    },
  },
  setSupabaseSession: vi.fn(),
  clearSupabaseSession: vi.fn(),
}));

describe('useNotes Session Validation', () => {
  beforeEach(() => {
    // Mock localStorage
    const localStorageMock = (() => {
      let store: Record<string, string> = {};
      return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value.toString(); },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; }
      };
    })();
    vi.stubGlobal('localStorage', localStorageMock);
  });

  it('sets syncStatus to error if token refresh fails on startup', async () => {
    // Mock credentials exists
    window.tauriAPI = {
      ...window.tauriAPI,
      getSupabaseCredentials: vi.fn().mockResolvedValue({
        userId: 'test-user',
        email: 'test@example.com',
        accessToken: 'old-access',
        refreshToken: 'old-refresh',
      }),
      refreshSupabaseToken: vi.fn().mockRejectedValue(new Error('Invalid refresh token')),
    } as any;

    const { result } = renderHook(() => useNotes());

    await waitFor(() => {
      expect(result.current.syncStatus).toBe('error');
    });

    expect(result.current.syncError).toBe('session_expired');
  });
});

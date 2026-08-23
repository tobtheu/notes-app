import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pullFromSupabase } from '../lib/syncSupabase';

const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
const mockSupabaseFrom = vi.fn();

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: (...args: any[]) => mockSupabaseFrom(...args),
  },
}));

describe('syncSupabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pulls remote notes and config from Supabase and upserts into PGlite', async () => {
    const mockDb = { query: mockQuery } as any;

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'notes') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: 'work/plan.md', user_id: 'user-123', content: '# Plan', updated_at: '2026-08-22T20:00:00Z', deleted: false },
                { id: 'deleted-note.md', user_id: 'user-123', content: '', updated_at: '2026-08-22T20:00:00Z', deleted: true },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'app_config') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { user_id: 'user-123', metadata: { folders: { work: { icon: 'briefcase' } } }, updated_at: '2026-08-22T20:00:00Z' },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    const result = await pullFromSupabase(mockDb, 'user-123');

    expect(result.notesCount).toBe(2);
    expect(result.configUpdated).toBe(true);

    // Verify PGlite upsert queries
    expect(mockQuery).toHaveBeenCalledTimes(3); // 2 notes + 1 config
  });
});

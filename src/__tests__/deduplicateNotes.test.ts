import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { DB_SCHEMA } from '../lib/db';
import { deduplicateNotes } from '../lib/deduplicateNotes';

describe('deduplicateNotes', () => {
  let db: PGlite;
  const USER_ID = 'test-user-123';

  beforeEach(async () => {
    db = new PGlite();
    await db.exec(DB_SCHEMA);
  });

  it('keeps only the latest copy when multiple duplicate notes exist with same folder and content', async () => {
    const enqueuedDeletes: string[] = [];
    const mockEnqueue = async (id: string) => {
      enqueuedDeletes.push(id);
    };

    // Insert 3 identical copies with different UUIDs
    await db.query(
      `INSERT INTO notes (id, user_id, folder, content, updated_at, deleted) VALUES
       ('uuid-old-1', $1, 'App Development', '# Ideen\nMeine Notiz', '2026-10-01T10:00:00Z', false),
       ('uuid-newest-2', $1, 'App Development', '# Ideen\nMeine Notiz', '2026-10-20T12:00:00Z', false),
       ('uuid-mid-3', $1, 'App Development', '# Ideen\nMeine Notiz', '2026-10-10T11:00:00Z', false)`,
      [USER_ID]
    );

    // Also insert a legacy .md row
    await db.query(
      `INSERT INTO notes (id, user_id, folder, content, updated_at, deleted) VALUES
       ('app development/ideen.md', $1, 'App Development', '# Ideen\nMeine Notiz', '2026-09-01T10:00:00Z', false)`,
      [USER_ID]
    );

    // Insert an unrelated note in the same folder that should NOT be touched
    await db.query(
      `INSERT INTO notes (id, user_id, folder, content, updated_at, deleted) VALUES
       ('uuid-other', $1, 'App Development', '# Andere Notiz', '2026-10-15T10:00:00Z', false)`,
      [USER_ID]
    );

    const result = await deduplicateNotes(db as any, USER_ID, mockEnqueue);

    expect(result.deduplicatedCount).toBe(3); // 2 duplicate UUIDs + 1 legacy .md

    // Query active notes
    const activeNotes = await db.query<{ id: string; content: string; deleted: boolean }>(
      `SELECT id, content, deleted FROM notes WHERE user_id = $1 AND deleted = false ORDER BY id ASC`,
      [USER_ID]
    );

    expect(activeNotes.rows).toHaveLength(2);
    const activeIds = activeNotes.rows.map(r => r.id);
    expect(activeIds).toContain('uuid-newest-2');
    expect(activeIds).toContain('uuid-other');

    // Verify deleted flags
    expect(enqueuedDeletes).toContain('uuid-old-1');
    expect(enqueuedDeletes).toContain('uuid-mid-3');
    expect(enqueuedDeletes).toContain('app development/ideen.md');
  });

  it('preserves distinct notes in different folders even if content is identical', async () => {
    await db.query(
      `INSERT INTO notes (id, user_id, folder, content, updated_at, deleted) VALUES
       ('uuid-folder-a', $1, 'Ordner A', '# Inhalt', '2026-10-01T10:00:00Z', false),
       ('uuid-folder-b', $1, 'Ordner B', '# Inhalt', '2026-10-01T10:00:00Z', false)`,
      [USER_ID]
    );

    const result = await deduplicateNotes(db as any, USER_ID);
    expect(result.deduplicatedCount).toBe(0);

    const active = await db.query(
      `SELECT id FROM notes WHERE user_id = $1 AND deleted = false`,
      [USER_ID]
    );
    expect(active.rows).toHaveLength(2);
  });
});

import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { initSchema } from '../lib/db';

describe('db migration — UUID & folder column', () => {
    it('migrates legacy path-based notes to UUIDs and extracts folder', async () => {
        const db = new PGlite();
        
        // Setup initial schema with legacy notes
        await db.exec(`
            CREATE TABLE notes (
                id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL DEFAULT (NOW()),
                deleted BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TEXT NOT NULL DEFAULT (NOW()),
                PRIMARY KEY (id, user_id)
            );
            CREATE TABLE app_config (
                user_id TEXT NOT NULL PRIMARY KEY,
                metadata JSONB NOT NULL DEFAULT '{}',
                updated_at TEXT NOT NULL DEFAULT (NOW())
            );
            INSERT INTO notes (id, user_id, content) VALUES ('work/meeting.md', 'user-1', '# Meeting Notes');
            INSERT INTO notes (id, user_id, content) VALUES ('root.md', 'user-1', '# Root Note');
            INSERT INTO app_config (user_id, metadata) VALUES ('user-1', '{"pinnedNotes":["work/meeting.md"]}');
        `);

        // Run updated initSchema which includes migration
        await initSchema(db);

        const notes = await db.query<{ id: string; folder: string; content: string }>(
            `SELECT id, folder, content FROM notes ORDER BY content ASC`
        );
        expect(notes.rows.length).toBe(2);

        // Verify meeting note
        const meetingNote = notes.rows.find(n => n.content.includes('Meeting'));
        expect(meetingNote).toBeDefined();
        expect(meetingNote?.folder).toBe('work');
        expect(meetingNote?.id).not.toContain('.md');
        expect(meetingNote?.id).toMatch(/^[0-9a-f-]{36}$/i);

        // Verify root note
        const rootNote = notes.rows.find(n => n.content.includes('Root'));
        expect(rootNote).toBeDefined();
        expect(rootNote?.folder).toBe('');
        expect(rootNote?.id).not.toContain('.md');
        expect(rootNote?.id).toMatch(/^[0-9a-f-]{36}$/i);

        // Verify pinned notes remapped in metadata
        const config = await db.query<{ metadata: any }>(`SELECT metadata FROM app_config WHERE user_id = 'user-1'`);
        const pinned = config.rows[0].metadata.pinnedNotes;
        expect(pinned).toContain(meetingNote?.id);
        expect(pinned).not.toContain('work/meeting.md');
    });
});

import { describe, it, expect, vi } from 'vitest';
import { exportNotesToDirectory, sanitizeFilename } from '../utils/exportBackup';
import type { Note } from '../types';

describe('exportBackup', () => {
    it('sanitizes filenames properly', () => {
        expect(sanitizeFilename('Project/Ideas: 2024?*')).toBe('Project-Ideas- 2024--');
        expect(sanitizeFilename('   ')).toBe('Untitled note');
    });

    it('exports all notes to target directory structure using display title filenames', async () => {
        const mockWrite = vi.fn().mockResolvedValue(undefined);
        (window as any).tauriAPI = { writeMirrorFile: mockWrite };

        const notes: Note[] = [
            { filename: 'note-123.md', folder: '', content: '# Meeting Notes\nSome content', updatedAt: '2026-08-20T10:00:00Z' },
            { filename: 'note-456.md', folder: 'Work', content: '# Project Roadmaps\nRoadmap details', updatedAt: '2026-08-20T11:00:00Z' },
            { filename: 'note-789.md', folder: 'Work', content: '# Project Roadmaps\nDuplicate name note', updatedAt: '2026-08-20T12:00:00Z' }
        ];

        const count = await exportNotesToDirectory(notes, '/backup/folder');
        expect(count).toBe(3);
        expect(mockWrite).toHaveBeenCalledTimes(3);

        expect(mockWrite).toHaveBeenNthCalledWith(1, {
            mirrorFolder: '/backup/folder',
            note: {
                ...notes[0],
                filename: 'Meeting Notes.md',
                folder: '',
                content: notes[0].content,
                updatedAt: notes[0].updatedAt
            }
        });

        expect(mockWrite).toHaveBeenNthCalledWith(2, {
            mirrorFolder: '/backup/folder',
            note: {
                ...notes[1],
                filename: 'Project Roadmaps.md',
                folder: 'Work',
                content: notes[1].content,
                updatedAt: notes[1].updatedAt
            }
        });

        // Duplicate title in same folder should be deduplicated with (2)
        expect(mockWrite).toHaveBeenNthCalledWith(3, {
            mirrorFolder: '/backup/folder',
            note: {
                ...notes[2],
                filename: 'Project Roadmaps (2).md',
                folder: 'Work',
                content: notes[2].content,
                updatedAt: notes[2].updatedAt
            }
        });
    });
});

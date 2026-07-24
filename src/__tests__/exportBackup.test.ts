import { describe, it, expect, vi } from 'vitest';
import { exportNotesToDirectory } from '../utils/exportBackup';
import type { Note } from '../types';

describe('exportBackup', () => {
    it('exports all notes to target directory structure using writeMirrorFile', async () => {
        const mockWrite = vi.fn().mockResolvedValue(undefined);
        (window as any).tauriAPI = { writeMirrorFile: mockWrite };

        const notes: Note[] = [
            { filename: 'Note 1.md', folder: '', content: '# Note 1', updatedAt: new Date().toISOString() },
            { filename: 'Note 2.md', folder: 'Work', content: '# Note 2', updatedAt: new Date().toISOString() }
        ];

        const count = await exportNotesToDirectory(notes, '/backup/folder');
        expect(count).toBe(2);
        expect(mockWrite).toHaveBeenCalledTimes(2);
        expect(mockWrite).toHaveBeenNthCalledWith(1, { mirrorFolder: '/backup/folder', note: notes[0] });
        expect(mockWrite).toHaveBeenNthCalledWith(2, { mirrorFolder: '/backup/folder', note: notes[1] });
    });
});

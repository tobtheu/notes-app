import type { Note } from '../types';
import { extractNoteTitle } from './markdown';

/**
 * Sanitizes a string so it is valid and safe as a filename across Windows, macOS, and Linux.
 */
export function sanitizeFilename(name: string): string {
    return name
        .replace(/[/\\?%*:|"<>]/g, '-')
        .replace(/\s+/g, ' ')
        .trim() || 'Untitled note';
}

/**
 * Exports all given active notes into a target local directory with their folder structure.
 * Filenames are based on the actual note title displayed in the app.
 */
export async function exportNotesToDirectory(notes: Note[], mirrorFolder: string): Promise<number> {
    if (!mirrorFolder || !notes || notes.length === 0) return 0;

    let count = 0;
    const usedPaths = new Set<string>();

    for (const note of notes) {
        try {
            const rawTitle = extractNoteTitle(note.content, note.filename);
            const safeTitle = sanitizeFilename(rawTitle);

            let exportFilename = `${safeTitle}.md`;
            let fullRelPath = note.folder ? `${note.folder}/${exportFilename}` : exportFilename;

            // Handle collisions if two notes in the same folder have identical titles
            let dedupeCounter = 2;
            while (usedPaths.has(fullRelPath.toLowerCase())) {
                exportFilename = `${safeTitle} (${dedupeCounter}).md`;
                fullRelPath = note.folder ? `${note.folder}/${exportFilename}` : exportFilename;
                dedupeCounter++;
            }
            usedPaths.add(fullRelPath.toLowerCase());

            await window.tauriAPI.writeMirrorFile({
                mirrorFolder,
                note: {
                    ...note,
                    filename: exportFilename,
                    folder: note.folder || '',
                    content: note.content,
                    updatedAt: note.updatedAt || new Date().toISOString()
                }
            });
            count++;
        } catch (e) {
            console.error(`Failed to export note:`, e);
        }
    }
    return count;
}

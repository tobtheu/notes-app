import type { Note } from '../types';

/**
 * Exports all given active notes into a target local directory with their folder structure.
 */
export async function exportNotesToDirectory(notes: Note[], mirrorFolder: string): Promise<number> {
    if (!mirrorFolder || !notes || notes.length === 0) return 0;

    let count = 0;
    for (const note of notes) {
        try {
            await window.tauriAPI.writeMirrorFile({ mirrorFolder, note });
            count++;
        } catch (e) {
            console.error(`Failed to export note ${note.filename}:`, e);
        }
    }
    return count;
}

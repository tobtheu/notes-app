/**
 * Path & ID Utilities
 * Centralizes normalization and ID generation for notes and folders.
 */

/**
 * Normalizes a string to NFC and lowercases it.
 * NFC normalization is critical for cross-platform file system consistency (macOS vs Windows/Linux).
 */
export const normalizeStr = (s: string) => s.normalize('NFC').toLowerCase();

/**
 * Generates a consistent unique identifier for a note based on its relative path.
 * 
 * @param filename - The basename of the file (e.g. "Note.md")
 * @param folder - The relative folder path (e.g. "Work/Project")
 * @returns A normalized string ID (e.g. "work/project/note.md")
 */
export const getPathId = (filename: string, folder: string = "") => {
    const f = folder ? folder.replace(/\\/g, '/') : '';
    const path = f ? `${f}/${filename}` : filename;
    return normalizeStr(path);
};

/**
 * Markdown Utilities for Note Title and Content Previews
 */

/**
 * Strips common markdown formatting from a text snippet to produce clean plain text.
 */
export const stripMarkdown = (text: string): string => {
    if (!text) return '';
    return text
        .split(/\r?\n/)[0] // Only preview the first line
        .replace(/^#+\s+/, '') // Remove markdown headers
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1') // Remove image syntax
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove link syntax
        .replace(/(^|\s)[#*`_~]+|[#*`_~]+(\s|$)/g, '$1$2')
        .replace(/\[[x ]\]/g, '') // Remove task list checkboxes
        .replace(/<[^>]*>/g, '') // Remove HTML
        .trim();
};

/**
 * Extracts the title of a note from its first markdown heading (# Title).
 * Falls back to the filename (without .md) if no heading exists.
 */
export const extractNoteTitle = (content: string, fallbackFilename = 'Untitled note'): string => {
    if (!content) return 'Untitled note';
    const firstLine = content.trimStart().split(/\r?\n/)[0] || '';
    const extracted = firstLine.replace(/^#+\s*/, '').trim();
    if (extracted) return extracted;
    if (fallbackFilename && !fallbackFilename.startsWith('note-')) {
        return fallbackFilename.replace(/\.md$/, '') || 'Untitled note';
    }
    return 'Untitled note';
};

/**
 * Extracts the body preview of a note (content after the first title line).
 */
export const extractNotePreview = (content: string): string => {
    if (!content) return 'No additional content';
    const lines = content.trimStart().split(/\r?\n/);
    const bodyContent = lines.slice(1).join('\n').trim();
    if (!bodyContent) return 'No additional content';

    const plain = stripMarkdown(bodyContent);
    return plain || 'No additional content';
};

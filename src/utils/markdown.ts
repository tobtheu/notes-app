/**
 * stripMarkdown Helper
 * Parses and strips common markdown formatting to produce a clean text preview of the note.
 */
export const stripMarkdown = (text: string): string => {
    if (!text) return '';
    return text
        .split(/\r?\n/)[0] // Only preview the first line
        .replace(/^#+\s+/, '') // Remove markdown headers
        .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '$1') // Remove image syntax
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove link syntax
        .replace(/(^|\s)[#*`_~]+|[#*`_~]+(\s|$)/g, '$1$2')
        .replace(/\[[x ]\]/g, '') // Remove task list checkboxes
        .replace(/<[^>]*>/g, '') // Remove HTML
        .trim();
};

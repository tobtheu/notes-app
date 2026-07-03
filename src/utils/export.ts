/**
 * Escape a string for safe embedding in HTML. Used for PDF export where
 * user-controlled values (e.g. note title) are interpolated into a template
 * before being written via innerHTML.
 */
export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Parses markdown to HTML and exports it as a PDF using Tauri API.
 */
export async function exportNoteToPdf(title: string, body: string): Promise<void> {
    // Parse markdown to HTML
    let parsedBody = body;
    try {
        const { marked } = await import('marked');
        parsedBody = await marked.parse(body);
    } catch (e) {
        console.error('Failed to parse markdown with marked:', e);
        // Fallback: simple newline conversion if marked fails
        parsedBody = escapeHtml(body).replace(/\n/g, '<br>');
    }

    // Title is user input → always escape before embedding in HTML.
    const safeTitle = escapeHtml(title);
    const htmlContent = `
        <div class="note-export">
            <h1 class="note-title">${safeTitle}</h1>
            <div class="note-body">${parsedBody}</div>
        </div>
        <style>
            .note-export {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
                padding: 40px;
                max-width: 850px;
                margin: auto;
                color: #1a1a1a;
            }
            .note-title {
                font-size: 2.5rem;
                color: #111827;
                border-bottom: 2px solid #E5E7EB;
                padding-bottom: 0.75rem;
                margin-bottom: 2rem;
                margin-top: 0;
            }
            .note-body {
                line-height: 1.6;
                font-size: 11pt;
            }
            .note-body h1 { font-size: 1.8rem; margin-top: 1.5rem; margin-bottom: 1rem; }
            .note-body h2 { font-size: 1.4rem; border-bottom: 1px solid #EEE; padding-bottom: 0.3rem; margin-top: 1.5rem; margin-bottom: 1rem; }
            .note-body h3 { font-size: 1.2rem; margin-top: 1.2rem; margin-bottom: 0.8rem; }
            .note-body p { margin-bottom: 1rem; }
            .note-body ul, .note-body ol { padding-left: 1.5rem; margin-bottom: 1rem; }
            .note-body li { margin-bottom: 0.4rem; }
            
            /* Task lists - hide bullets when checkbox is present */
            .note-body li:has(input[type="checkbox"]) {
                list-style-type: none;
                margin-left: -1rem;
            }
            .note-body input[type="checkbox"] {
                margin-right: 0.5rem;
                width: 0.9rem;
                height: 0.9rem;
                position: relative;
                top: -1px; /* Nudge it up slightly to align with text */
                vertical-align: middle;
                accent-color: #2563eb;
            }

            .note-body pre { background: #F3F4F6; padding: 1rem; border-radius: 6px; overflow-x: auto; font-family: monospace; font-size: 0.9rem; }
            .note-body code { background: #F3F4F6; padding: 0.2rem 0.4rem; border-radius: 4px; font-family: monospace; font-size: 0.9rem; }
            .note-body blockquote { border-left: 4px solid #E5E7EB; padding-left: 1rem; color: #6B7280; font-style: italic; margin: 1.5rem 0; }
            .note-body img { max-width: 100%; height: auto; border-radius: 8px; margin: 1.5rem 0; }
            .note-body table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
            .note-body th, .note-body td { border: 1px solid #E5E7EB; padding: 0.75rem; text-align: left; }
            .note-body th { background: #F9FAFB; font-weight: 600; }
            
            @media print {
                .note-export { padding: 0; }
            }
        </style>
    `;
    await window.tauriAPI.exportPdf(htmlContent);
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportNoteToPdf, escapeHtml } from '../utils/export';

describe('exportNoteToPdf security sanitization', () => {
    beforeEach(() => {
        (window as any).tauriAPI = {
            exportPdf: vi.fn().mockResolvedValue(undefined),
        };
    });

    it('escapes user titles properly', () => {
        expect(escapeHtml('<script>alert("xss")</script>')).toBe(
            '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
        );
    });

    it('sanitizes dangerous script and onerror attributes in markdown body before calling exportPdf', async () => {
        const maliciousBody = `
# Normal Heading
Some normal content with **bold** text.

<script>alert("danger")</script>
<img src="x" onerror="alert('xss')" />
<a href="javascript:alert(1)">Click me</a>
        `;

        await exportNoteToPdf('Safe Title', maliciousBody);

        expect(window.tauriAPI.exportPdf).toHaveBeenCalledTimes(1);
        const htmlSent = (window.tauriAPI.exportPdf as any).mock.calls[0][0] as string;

        // Verify normal formatting remains intact
        expect(htmlSent).toContain('<h1 class="note-title">Safe Title</h1>');
        expect(htmlSent).toContain('Some normal content with');
        expect(htmlSent).toContain('<strong>bold</strong>');

        // Verify dangerous execution vectors are sanitized away
        expect(htmlSent).not.toContain('<script>');
        expect(htmlSent).not.toContain('alert("danger")');
        expect(htmlSent).not.toContain('onerror=');
        expect(htmlSent).not.toContain('javascript:');
    });
});

import { describe, it, expect } from 'vitest';

export function isSafeExternalUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (trimmed.startsWith('note://') || trimmed.startsWith('id:') || trimmed.startsWith('#')) {
        return true;
    }
    try {
        const parsed = new URL(trimmed);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:';
    } catch {
        return false;
    }
}

describe('Link security validation', () => {
    it('allows valid web URLs and mailto', () => {
        expect(isSafeExternalUrl('https://example.com')).toBe(true);
        expect(isSafeExternalUrl('http://sub.domain.org/path?q=1')).toBe(true);
        expect(isSafeExternalUrl('mailto:test@example.com')).toBe(true);
    });

    it('blocks dangerous protocol handlers', () => {
        expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
        expect(isSafeExternalUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
        expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false);
        expect(isSafeExternalUrl('vbscript:msgbox(1)')).toBe(false);
    });
});

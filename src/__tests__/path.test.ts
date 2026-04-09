import { describe, it, expect } from 'vitest'
import { getPathId, normalizeStr } from '../utils/path'

// ---------------------------------------------------------------------------
// normalizeStr
// ---------------------------------------------------------------------------
describe('normalizeStr', () => {
    it('lowercases ASCII strings', () => {
        expect(normalizeStr('Hello')).toBe('hello')
        expect(normalizeStr('FOO')).toBe('foo')
    })

    it('lowercases German umlauts', () => {
        expect(normalizeStr('Über')).toBe('über')
        expect(normalizeStr('Ärger')).toBe('ärger')
        expect(normalizeStr('Öffnung')).toBe('öffnung')
    })

    it('handles NFC normalization (precomposed vs decomposed)', () => {
        // U+00FC (ü precomposed) vs U+0075 U+0308 (u + combining diaeresis)
        const precomposed = '\u00FC' // ü
        const decomposed = '\u0075\u0308' // u + combining ¨
        expect(normalizeStr(precomposed)).toBe(normalizeStr(decomposed))
    })

    it('handles empty string', () => {
        expect(normalizeStr('')).toBe('')
    })

    it('preserves non-letter characters', () => {
        expect(normalizeStr('file-name_2.md')).toBe('file-name_2.md')
        expect(normalizeStr('path/to/file')).toBe('path/to/file')
    })
})

// ---------------------------------------------------------------------------
// getPathId
// ---------------------------------------------------------------------------
describe('getPathId', () => {
    it('joins folder and filename with /', () => {
        expect(getPathId('Note.md', 'Work')).toBe('work/note.md')
    })

    it('returns just lowercased filename when folder is empty', () => {
        expect(getPathId('Anpassungen.md', '')).toBe('anpassungen.md')
        expect(getPathId('Anpassungen.md')).toBe('anpassungen.md')
    })

    it('handles nested folders', () => {
        expect(getPathId('Note.md', 'Work/Projects')).toBe('work/projects/note.md')
    })

    it('handles backslash folder separators (Windows)', () => {
        expect(getPathId('Note.md', 'Work\\Projects')).toBe('work/projects/note.md')
    })

    it('handles umlauts in filename and folder', () => {
        expect(getPathId('Über.md', 'Ordner')).toBe('ordner/über.md')
    })

    it('handles spaces in filename', () => {
        expect(getPathId('My Note.md', 'Personal')).toBe('personal/my note.md')
    })

    it('handles special characters', () => {
        expect(getPathId('Note (1).md', '')).toBe('note (1).md')
    })

    it('generates consistent IDs regardless of input casing', () => {
        expect(getPathId('NOTE.MD', 'WORK')).toBe(getPathId('note.md', 'work'))
    })

    it('generates consistent IDs for NFC vs NFD input', () => {
        const precomposed = '\u00FC' // ü
        const decomposed = '\u0075\u0308' // u + combining ¨
        expect(getPathId(`${precomposed}ber.md`, '')).toBe(getPathId(`${decomposed}ber.md`, ''))
    })
})

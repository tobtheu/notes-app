import { describe, it, expect } from 'vitest';
import { normalizeStr } from '../utils/path';

describe('Folder Deduplication Logic', () => {
    function computeFolders({
        folderOrder = [],
        noteFolders = [],
        metaFolders = {}
    }: {
        folderOrder?: string[];
        noteFolders?: string[];
        metaFolders?: Record<string, any>;
    }) {
        const ordered = folderOrder ?? [];
        const fromNotes = noteFolders.filter(Boolean);
        const fromMeta = Object.keys(metaFolders || {}).filter(Boolean);

        const allSources = [...ordered, ...fromNotes, ...fromMeta];
        const result: string[] = [];
        const seenNormalized = new Set<string>();

        for (const f of allSources) {
            const trimmed = f.trim();
            if (!trimmed) continue;
            const norm = normalizeStr(trimmed);
            if (!seenNormalized.has(norm)) {
                seenNormalized.add(norm);
                result.push(trimmed);
            }
        }

        return result;
    }

    it('deduplicates identical folders appearing in folderOrder, notes, and metadata', () => {
        const result = computeFolders({
            folderOrder: ['Arbeit', 'Privat'],
            noteFolders: ['Arbeit', 'Privat', 'Archiv'],
            metaFolders: { 'Arbeit': { color: 'blue' }, 'Privat': { icon: 'folder' } }
        });

        expect(result).toEqual(['Arbeit', 'Privat', 'Archiv']);
    });

    it('deduplicates case-insensitively and ignores leading/trailing whitespace', () => {
        const result = computeFolders({
            folderOrder: ['Arbeit'],
            noteFolders: ['arbeit', '  Arbeit  '],
            metaFolders: { 'ARBEIT': { color: 'red' } }
        });

        expect(result).toHaveLength(1);
        expect(result[0]).toBe('Arbeit');
    });

    it('preserves user custom order from folderOrder', () => {
        const result = computeFolders({
            folderOrder: ['Zebra', 'Alpha', 'Beta'],
            noteFolders: ['Beta', 'Gamma'],
            metaFolders: {}
        });

        expect(result).toEqual(['Zebra', 'Alpha', 'Beta', 'Gamma']);
    });
});

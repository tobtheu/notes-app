import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FolderItem } from '../components/FolderItem';
import { Sidebar } from '../components/Sidebar';
import type { AppMetadata } from '../types';

describe('FolderItem and Sidebar Note Counts', () => {
    const mockMetadata: AppMetadata = {
        folders: {},
        pinnedNotes: [],
    };

    it('does not render note count in FolderItem when showNoteCounts is false', () => {
        render(
            <FolderItem
                folder="Work"
                metadata={mockMetadata}
                selectedCategory={null}
                isCollapsed={false}
                noteCount={5}
                showNoteCounts={false}
            />
        );

        expect(screen.getByText('Work')).toBeDefined();
        expect(screen.queryByText('5')).toBeNull();
    });

    it('renders note count in FolderItem when showNoteCounts is true', () => {
        render(
            <FolderItem
                folder="Work"
                metadata={mockMetadata}
                selectedCategory={null}
                isCollapsed={false}
                noteCount={5}
                showNoteCounts={true}
            />
        );

        expect(screen.getByText('Work')).toBeDefined();
        expect(screen.getByText('5')).toBeDefined();
    });

    it('does not render All Notes count in Sidebar when showNoteCounts is false', () => {
        render(
            <Sidebar
                folders={['Work']}
                metadata={mockMetadata}
                selectedCategory={null}
                isCollapsed={false}
                allNotes={[
                    { filename: '1.md', folder: 'Work', content: 'c', updatedAt: '2026-08-22' },
                    { filename: '2.md', folder: 'Work', content: 'c', updatedAt: '2026-08-22' },
                ]}
                onCreateNote={vi.fn()}
                onDeleteCategory={vi.fn()}
                onEditCategory={vi.fn()}
                onSelectCategory={vi.fn()}
                showNoteCounts={false}
            />
        );

        expect(screen.getByText('All Notes')).toBeDefined();
        expect(screen.queryByText('2')).toBeNull();
    });

    it('renders All Notes and folder count in Sidebar when showNoteCounts is true', () => {
        render(
            <Sidebar
                folders={['Work']}
                metadata={mockMetadata}
                selectedCategory={null}
                isCollapsed={false}
                allNotes={[
                    { filename: '1.md', folder: 'Work', content: 'c', updatedAt: '2026-08-22' },
                    { filename: '2.md', folder: 'Work', content: 'c', updatedAt: '2026-08-22' },
                ]}
                onCreateNote={vi.fn()}
                onDeleteCategory={vi.fn()}
                onEditCategory={vi.fn()}
                onSelectCategory={vi.fn()}
                showNoteCounts={true}
            />
        );

        expect(screen.getByText('All Notes')).toBeDefined();
        // There should be two "2"s (one for All Notes, one for Work folder)
        const counts = screen.getAllByText('2');
        expect(counts.length).toBe(2);
    });
});

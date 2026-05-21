import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { NoteList } from '../components/NoteList';
import type { Note } from '../types';

const mockNotes: Note[] = [
    {
        filename: 'note1.md',
        content: '# Test Title\nSome content',
        updatedAt: new Date().toISOString(),
        folder: '',
    }
];

describe('NoteList Swipe Gesture', () => {
    beforeEach(() => {
        vi.stubGlobal('innerWidth', 375);
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
            cb(0);
            return 1;
        });
        vi.stubGlobal('cancelAnimationFrame', () => {});

        // Mock localStorage
        const localStorageMock = (() => {
            let store: Record<string, string> = {};
            return {
                getItem: (key: string) => store[key] || null,
                setItem: (key: string, value: string) => { store[key] = value.toString(); },
                clear: () => { store = {}; }
            };
        })();
        vi.stubGlobal('localStorage', localStorageMock);
    });

    it('renders note list and handles swiping left to reveal actions', async () => {
        const onDelete = vi.fn();
        const { container } = render(
            <NoteList
                notes={mockNotes}
                folders={[]}
                selectedNote={null}
                onSelectNote={vi.fn()}
                searchTerm=""
                onSearchChange={vi.fn()}
                onDeleteNote={onDelete}
                onMoveNote={vi.fn()}
                onTogglePin={vi.fn()}
                isNotePinned={() => false}
                getNoteId={(n) => n.filename}
                selectedCategory={null}
            />
        );

        // Find the foreground card of the first note item
        const foregroundCard = container.querySelector('.group.relative.p-2\\.5') as HTMLElement;
        expect(foregroundCard).not.toBeNull();

        // 1. Touch Start
        fireEvent.touchStart(foregroundCard, {
            touches: [{ clientX: 200, clientY: 100 }],
        });

        // 2. Drag left by 80px
        fireEvent.touchMove(foregroundCard, {
            touches: [{ clientX: 120, clientY: 100 }],
        });

        // The card should translate by -80px using translate3d
        expect(foregroundCard.style.transform).toContain('translate3d(-80px, 0px, 0px)');
    });

    it('handles swiping left up to the new -192px limit', async () => {
        const { container } = render(
            <NoteList
                notes={mockNotes}
                folders={[]}
                selectedNote={null}
                onSelectNote={vi.fn()}
                searchTerm=""
                onSearchChange={vi.fn()}
                onDeleteNote={vi.fn()}
                onMoveNote={vi.fn()}
                onTogglePin={vi.fn()}
                isNotePinned={() => false}
                getNoteId={(n) => n.filename}
                selectedCategory={null}
            />
        );

        const foregroundCard = container.querySelector('.group.relative.p-2\\.5') as HTMLElement;

        fireEvent.touchStart(foregroundCard, { touches: [{ clientX: 300, clientY: 100 }] });
        fireEvent.touchMove(foregroundCard, { touches: [{ clientX: 50, clientY: 100 }] }); // Drag by 250px left

        // Card should be clamped to -192px (new swipe maximum)
        expect(foregroundCard.style.transform).toContain('translate3d(-192px, 0px, 0px)');
    });

    it('closes move-to-folder dropdown when clicking outside', async () => {
        const { container } = render(
            <NoteList
                notes={mockNotes}
                folders={['Work', 'Personal']}
                selectedNote={null}
                onSelectNote={vi.fn()}
                searchTerm=""
                onSearchChange={vi.fn()}
                onDeleteNote={vi.fn()}
                onMoveNote={vi.fn()}
                onTogglePin={vi.fn()}
                isNotePinned={() => false}
                getNoteId={(n) => n.filename}
                selectedCategory={null}
            />
        );

        // Verify dropdown is closed initially
        expect(container.querySelector('.folder-dropdown-menu')).toBeNull();

        // Open the dropdown by clicking folder trigger
        const trigger = container.querySelector('[title="Move to Folder"]') as HTMLElement;
        expect(trigger).not.toBeNull();
        fireEvent.click(trigger);

        // Dropdown menu should be visible
        const dropdown = container.querySelector('.folder-dropdown-menu') as HTMLElement;
        expect(dropdown).not.toBeNull();

        // Click outside on the document body
        fireEvent.mouseDown(document.body);

        // Dropdown menu should now be closed
        expect(container.querySelector('.folder-dropdown-menu')).toBeNull();
    });
});

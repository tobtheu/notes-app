import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TrashSection } from '../components/TrashSection';
import type { Note } from '../types';

describe('TrashSection', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const mockTrashNotes: Note[] = [
        {
            filename: 'Old Project Ideas.md',
            folder: 'Ideas',
            content: '# Old Project Ideas\nSome old brainstorming notes...',
            updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago (25 days left)
        },
        {
            filename: 'Grocery list.md',
            folder: '',
            content: '# Grocery list\nApples, Oranges, Bananas',
            updatedAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString(), // 29 days ago (1 day left)
        },
    ];

    it('renders empty state when trash has no notes', () => {
        render(
            <TrashSection
                trashNotes={[]}
                onRestoreNote={vi.fn()}
                onPermanentlyDeleteNote={vi.fn()}
                onEmptyTrash={vi.fn()}
            />
        );

        expect(screen.getByText('Trash is empty')).toBeDefined();
        expect(screen.getByText('0 deleted notes')).toBeDefined();
        expect(screen.queryByText('Empty Trash')).toBeNull();
    });

    it('renders list of notes with titles, folders, and remaining days', () => {
        render(
            <TrashSection
                trashNotes={mockTrashNotes}
                onRestoreNote={vi.fn()}
                onPermanentlyDeleteNote={vi.fn()}
                onEmptyTrash={vi.fn()}
            />
        );

        expect(screen.getByText('2 deleted notes')).toBeDefined();
        expect(screen.getByText('Old Project Ideas')).toBeDefined();
        expect(screen.getByText('Grocery list')).toBeDefined();
        expect(screen.getByText('Ideas')).toBeDefined();
        expect(screen.getByText('25 days remaining')).toBeDefined();
        expect(screen.getByText('1 day remaining')).toBeDefined();
    });

    it('handles restore with exit animation and triggers onRestoreNote', async () => {
        const onRestore = vi.fn().mockResolvedValue(undefined);

        render(
            <TrashSection
                trashNotes={mockTrashNotes}
                onRestoreNote={onRestore}
                onPermanentlyDeleteNote={vi.fn()}
                onEmptyTrash={vi.fn()}
            />
        );

        const restoreButtons = screen.getAllByRole('button', { name: /Restore/i });
        fireEvent.click(restoreButtons[0]);

        // Verify animation delay (220ms) before onRestore is called
        expect(onRestore).not.toHaveBeenCalled();

        await act(async () => {
            vi.advanceTimersByTime(250);
        });

        expect(onRestore).toHaveBeenCalledWith('ideas/old project ideas.md');
    });

    it('handles permanent delete with confirmation step and animation', async () => {
        const onDeletePermanently = vi.fn().mockResolvedValue(undefined);

        render(
            <TrashSection
                trashNotes={mockTrashNotes}
                onRestoreNote={vi.fn()}
                onPermanentlyDeleteNote={onDeletePermanently}
                onEmptyTrash={vi.fn()}
            />
        );

        const deleteButtons = screen.getAllByTitle('Delete permanently');
        fireEvent.click(deleteButtons[0]);

        // Confirmation buttons appear
        const confirmBtn = screen.getByRole('button', { name: /^Delete$/i });
        const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
        expect(confirmBtn).toBeDefined();
        expect(cancelBtn).toBeDefined();

        // Click confirm
        fireEvent.click(confirmBtn);

        expect(onDeletePermanently).not.toHaveBeenCalled();

        await act(async () => {
            vi.advanceTimersByTime(250);
        });

        expect(onDeletePermanently).toHaveBeenCalledWith('ideas/old project ideas.md');
    });

    it('handles empty trash with confirmation step and calls onEmptyTrash', async () => {
        const onEmptyTrash = vi.fn().mockResolvedValue(undefined);

        render(
            <TrashSection
                trashNotes={mockTrashNotes}
                onRestoreNote={vi.fn()}
                onPermanentlyDeleteNote={vi.fn()}
                onEmptyTrash={onEmptyTrash}
            />
        );

        const emptyBtn = screen.getByRole('button', { name: /Empty Trash/i });
        fireEvent.click(emptyBtn);

        const confirmBtn = screen.getByRole('button', { name: /Empty Trash/i });
        expect(confirmBtn).toBeDefined();

        fireEvent.click(confirmBtn);
        expect(onEmptyTrash).toHaveBeenCalledTimes(1);
    });

    it('filters trash notes by search term when search input is used', () => {
        const manyNotes: Note[] = [
            ...mockTrashNotes,
            {
                filename: 'Random note.md',
                folder: 'Archive',
                content: '# Random\nTesting content',
                updatedAt: new Date().toISOString(),
            },
            {
                filename: 'Work Meeting.md',
                folder: 'Work',
                content: '# Work Meeting\nDiscuss Q3 metrics',
                updatedAt: new Date().toISOString(),
            }
        ];

        render(
            <TrashSection
                trashNotes={manyNotes}
                onRestoreNote={vi.fn()}
                onPermanentlyDeleteNote={vi.fn()}
                onEmptyTrash={vi.fn()}
            />
        );

        const searchInput = screen.getByPlaceholderText('Search notes...');
        fireEvent.change(searchInput, { target: { value: 'Grocery' } });

        expect(screen.getByText('Grocery list')).toBeDefined();
        expect(screen.queryByText('Old Project Ideas')).toBeNull();
        expect(screen.queryByText('Work Meeting')).toBeNull();
    });
});


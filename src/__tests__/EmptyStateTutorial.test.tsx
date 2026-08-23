import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyStateTutorial } from '../components/EmptyStateTutorial';

describe('EmptyStateTutorial', () => {
    it('renders the welcome title, logo image, and action button', () => {
        const onCreateNote = vi.fn();
        render(<EmptyStateTutorial onCreateNote={onCreateNote} />);

        expect(screen.getByText('Willkommen bei LamaNotes')).toBeDefined();
        expect(screen.getByText('Neue Notiz erstellen')).toBeDefined();
        const logoImg = screen.getByAltText('LamaNotes');
        expect(logoImg).toBeDefined();
    });

    it('renders the organisation guide with drag handle and 3-dots icons separated by a slash instead of plain text 3-Punkte', () => {
        const onCreateNote = vi.fn();
        const { container } = render(<EmptyStateTutorial onCreateNote={onCreateNote} />);

        expect(screen.getByText('Organisation')).toBeDefined();
        // Plain text "3-Punkte" should no longer exist
        expect(screen.queryByText('3-Punkte')).toBeNull();

        // Icons GripVertical and MoreVertical should be rendered
        const gripIcon = container.querySelector('.lucide-grip-vertical, .lucide-grip');
        const moreIcon = container.querySelector('.lucide-more-vertical, .lucide-ellipsis-vertical, .lucide-ellipsis');
        expect(gripIcon).not.toBeNull();
        expect(moreIcon).not.toBeNull();
    });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UrlInputModal } from '../components/UrlInputModal';

describe('UrlInputModal', () => {
    it('renders with external link inputs matching new design without Abbrechen button', () => {
        render(
            <UrlInputModal
                isOpen={true}
                initialUrl="https://github.com"
                initialText="GitHub"
                onClose={vi.fn()}
                onSave={vi.fn()}
            />
        );

        expect(screen.getByText('Link einfügen')).toBeDefined();
        expect(screen.getByPlaceholderText('https://example.com')).toBeDefined();
        expect(screen.getByPlaceholderText('Link-Text...')).toBeDefined();
        expect(screen.getByText('Speichern')).toBeDefined();
        expect(screen.queryByText('Abbrechen')).toBeNull();

        // Verify tabs for internal/external are removed
        expect(screen.queryByText('External')).toBeNull();
        expect(screen.queryByText('Internal Note')).toBeNull();
    });

    it('allows saving an empty URL to delete/remove the link', () => {
        const handleSave = vi.fn();
        render(
            <UrlInputModal
                isOpen={true}
                initialUrl="https://example.com"
                initialText="Some text"
                onClose={vi.fn()}
                onSave={handleSave}
            />
        );

        const urlInput = screen.getByPlaceholderText('https://example.com');
        fireEvent.change(urlInput, { target: { value: '' } });

        const saveButton = screen.getByText('Speichern');
        fireEvent.click(saveButton);

        expect(handleSave).toHaveBeenCalledWith('', 'Some text');
    });

    it('calls onClose when clicking close icon X', () => {
        const handleClose = vi.fn();
        render(
            <UrlInputModal
                isOpen={true}
                initialUrl="https://example.com"
                onClose={handleClose}
                onSave={vi.fn()}
            />
        );

        const closeButton = screen.getByRole('button', { name: '' });
        fireEvent.click(closeButton);
        expect(handleClose).toHaveBeenCalledTimes(1);
    });
});

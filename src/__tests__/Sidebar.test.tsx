import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from '../components/Sidebar';

describe('Sidebar Status Indicator', () => {
    const defaultProps = {
        metadata: { folders: {}, pinned: [], pinnedNotes: [] },
        selectedCategory: null,
        isCollapsed: false,
        onCreateNote: vi.fn(),
        onDeleteCategory: vi.fn(),
        onEditCategory: vi.fn(),
        onSelectCategory: vi.fn(),
        onOpenSettings: vi.fn(),
    };

    it('renders "Lokaler Modus" when in local offline mode', () => {
        render(
            <Sidebar
                {...defaultProps}
                userId="local"
                userEmail={null}
                syncStatus="offline"
            />
        );

        expect(screen.getByText('Lokaler Modus')).toBeDefined();
    });

    it('renders "Cloud Synced" when cloud account is connected and synced', () => {
        render(
            <Sidebar
                {...defaultProps}
                userId="user-123"
                userEmail="test@example.com"
                syncStatus="synced"
            />
        );

        expect(screen.getByText('Cloud Synced')).toBeDefined();
    });

    it('renders "Synchronisiere..." when sync is pending', () => {
        render(
            <Sidebar
                {...defaultProps}
                userId="user-123"
                userEmail="test@example.com"
                syncStatus="pending"
            />
        );

        expect(screen.getByText('Synchronisiere...')).toBeDefined();
    });
});

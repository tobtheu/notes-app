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

    it('renders folder items uniquely without duplicate entries', () => {
        render(
            <Sidebar
                {...defaultProps}
                folders={['Arbeit', 'Privat', 'Projekte']}
                metadata={{
                    folders: {
                        Arbeit: { color: 'blue' },
                    },
                    pinnedNotes: [],
                    folderOrder: ['Arbeit', 'Privat', 'Projekte'],
                }}
            />
        );

        expect(screen.getByText('Arbeit')).toBeDefined();
        expect(screen.getByText('Privat')).toBeDefined();
        expect(screen.getByText('Projekte')).toBeDefined();
        expect(screen.getAllByText('Arbeit')).toHaveLength(1);
    });
});

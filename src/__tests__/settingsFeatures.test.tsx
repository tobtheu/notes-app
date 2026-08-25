import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsNav } from '../components/SettingsNav';

describe('SettingsNav with FEATURES.SYNC disabled', () => {
    it('does not render the Cloud Sync navigation item', () => {
        render(
            <SettingsNav
                activeTab="appearance"
                onSelectTab={vi.fn()}
            />
        );

        expect(screen.queryByText('Cloud Sync')).toBeNull();
        expect(screen.getByText('Appearance')).toBeDefined();
        expect(screen.getByText('Editor')).toBeDefined();
        expect(screen.getByText('Backup & Data')).toBeDefined();
    });
});

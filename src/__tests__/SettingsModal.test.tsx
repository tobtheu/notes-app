import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsModal } from '../components/SettingsModal';

vi.mock('../config/features', () => ({
    FEATURES: { SYNC: true }
}));

describe('SettingsModal', () => {
    it('renders and allows navigating between all 6 tabs without errors', () => {
        const mockClose = vi.fn();
        const mockSetTheme = vi.fn();

        (window as any).tauriAPI = {
            getAppVersion: vi.fn().mockResolvedValue('0.7.12'),
            onUpdateStatus: vi.fn().mockReturnValue(() => {})
        };

        render(
            <SettingsModal
                isOpen={true}
                onClose={mockClose}
                theme="dark"
                setTheme={mockSetTheme}
                markdownEnabled={true}
                onToggleMarkdown={vi.fn()}
                monochromeIcons={false}
                onToggleMonochromeIcons={vi.fn()}
                fontFamily="inter"
                setFontFamily={vi.fn()}
                fontSize="medium"
                setFontSize={vi.fn()}
                spellcheckEnabled={true}
                onToggleSpellcheck={vi.fn()}
                onImportFolder={vi.fn().mockResolvedValue(5)}
                onImportFiles={vi.fn().mockResolvedValue(3)}
                onExportBackup={vi.fn().mockResolvedValue(10)}
                trashNotes={[
                    { filename: 'Deleted Note.md', folder: '', content: '# Deleted\nContent', updatedAt: new Date().toISOString() }
                ]}
            />
        );

        // 1. Appearance tab
        expect(screen.getByText('Theme')).toBeDefined();
        expect(screen.getByText('Typography')).toBeDefined();

        // 2. Switch to Editor tab
        fireEvent.click(screen.getByRole('button', { name: /Editor/i }));
        expect(screen.getByText('Markdown Shortcuts')).toBeDefined();

        // 3. Switch to Cloud Sync tab
        fireEvent.click(screen.getByRole('button', { name: /Cloud Sync/i }));
        expect(screen.getByText('Local Offline Storage')).toBeDefined();

        // 4. Switch to Storage / Backup & Data tab
        fireEvent.click(screen.getByRole('button', { name: /Backup & Data/i }));
        expect(screen.getByText('Export Backup (.zip)')).toBeDefined();
        expect(screen.getAllByText('Import Folder').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Import Files').length).toBeGreaterThan(0);

        // 5. Switch to Trash tab
        fireEvent.click(screen.getByRole('button', { name: /Trash/i }));
        expect(screen.getByText('Deleted')).toBeDefined();
        expect(screen.getByText('1 deleted note')).toBeDefined();

        // 6. Switch to About tab
        fireEvent.click(screen.getByRole('button', { name: /About/i }));
        expect(screen.getByText('LamaNotes')).toBeDefined();
        expect(screen.getByText(/Tobias Theunissen/i)).toBeDefined();
    });

    it('renders note count toggle in Appearance tab and fires onToggleShowNoteCounts', () => {
        const onToggleShowNoteCounts = vi.fn();

        (window as any).tauriAPI = {
            getAppVersion: vi.fn().mockResolvedValue('0.7.12'),
            onUpdateStatus: vi.fn().mockReturnValue(() => {})
        };

        render(
            <SettingsModal
                isOpen={true}
                onClose={vi.fn()}
                theme="dark"
                setTheme={vi.fn()}
                markdownEnabled={true}
                onToggleMarkdown={vi.fn()}
                monochromeIcons={false}
                onToggleMonochromeIcons={vi.fn()}
                showNoteCounts={false}
                onToggleShowNoteCounts={onToggleShowNoteCounts}
                fontFamily="inter"
                setFontFamily={vi.fn()}
                fontSize="medium"
                setFontSize={vi.fn()}
                spellcheckEnabled={true}
                onToggleSpellcheck={vi.fn()}
            />
        );

        expect(screen.getByText('Note Counts beside Folders')).toBeDefined();
        const toggleBtn = screen.getByTitle('Note Counts beside Folders');
        fireEvent.click(toggleBtn);
        expect(onToggleShowNoteCounts).toHaveBeenCalledWith(true);
    });

    it('renders local mode status and Use locally button in Cloud Sync tab when offline/local', () => {
        const onSignOut = vi.fn().mockResolvedValue(undefined);

        render(
            <SettingsModal
                isOpen={true}
                onClose={vi.fn()}
                theme="dark"
                setTheme={vi.fn()}
                markdownEnabled={true}
                onToggleMarkdown={vi.fn()}
                monochromeIcons={false}
                onToggleMonochromeIcons={vi.fn()}
                fontFamily="inter"
                setFontFamily={vi.fn()}
                fontSize="medium"
                setFontSize={vi.fn()}
                spellcheckEnabled={true}
                onToggleSpellcheck={vi.fn()}
                userEmail={null}
                onSignOut={onSignOut}
            />
        );

        // Switch to Cloud Sync tab
        fireEvent.click(screen.getByRole('button', { name: /Cloud Sync/i }));
        expect(screen.getByText('Local Offline Storage')).toBeDefined();

        const exitBtn = screen.getByText('Use Locally Only');
        expect(exitBtn).toBeDefined();
        fireEvent.click(exitBtn);
        expect(onSignOut).toHaveBeenCalledWith(false);
    });

    it('renders database reset option and confirmation in Storage tab', async () => {
        const onResetDatabase = vi.fn().mockResolvedValue(undefined);

        render(
            <SettingsModal
                isOpen={true}
                onClose={vi.fn()}
                theme="dark"
                setTheme={vi.fn()}
                markdownEnabled={true}
                onToggleMarkdown={vi.fn()}
                monochromeIcons={false}
                onToggleMonochromeIcons={vi.fn()}
                fontFamily="inter"
                setFontFamily={vi.fn()}
                fontSize="medium"
                setFontSize={vi.fn()}
                spellcheckEnabled={true}
                onToggleSpellcheck={vi.fn()}
                onResetDatabase={onResetDatabase}
            />
        );

        // Switch to Storage tab
        fireEvent.click(screen.getByRole('button', { name: /Backup & Data/i }));
        const resetElements = screen.getAllByText('Reset Database');
        expect(resetElements.length).toBeGreaterThan(0);

        const resetBtn = resetElements[resetElements.length - 1];
        fireEvent.click(resetBtn);

        // Confirmation step
        expect(screen.getByText('Delete Everything')).toBeDefined();
        const confirmBtn = screen.getByText('Delete Everything');
        fireEvent.click(confirmBtn);

        expect(onResetDatabase).toHaveBeenCalled();
    });
});


import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OnboardingScreen } from '../components/OnboardingScreen';

describe('OnboardingScreen', () => {
    it('renders the welcome title and borderless rounded logo', () => {
        render(
            <OnboardingScreen
                onSelectFolder={vi.fn()}
                onSetupWorkspace={vi.fn().mockResolvedValue(undefined)}
            />
        );

        expect(screen.getByText('Welcome to Lama')).toBeDefined();
        const logoImg = screen.getByAltText('Logo');
        expect(logoImg).toBeDefined();
        expect(logoImg.className).toContain('w-16');
        expect(logoImg.className).toContain('h-16');
        expect(logoImg.className).toContain('rounded-2xl');
    });

    it('triggers onLocalOnly when clicking Use locally only button', async () => {
        const onLocalOnly = vi.fn().mockResolvedValue(undefined);

        render(
            <OnboardingScreen
                onSelectFolder={vi.fn()}
                onSetupWorkspace={vi.fn().mockResolvedValue(undefined)}
                onLocalOnly={onLocalOnly}
            />
        );

        // Click "Use locally only"
        const localBtn = screen.getByText('Use locally only');
        localBtn.click();

        expect(onLocalOnly).toHaveBeenCalled();
    });
});

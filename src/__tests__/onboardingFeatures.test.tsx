import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OnboardingStorageCard } from '../components/OnboardingStorageCard';

describe('OnboardingStorageCard with FEATURES.SYNC disabled', () => {
    it('renders Cloud Sync as disabled with Coming Soon label', () => {
        const onOpenEmailAuth = vi.fn();
        const onLocalOnly = vi.fn().mockResolvedValue(undefined);

        render(
            <OnboardingStorageCard
                onOpenEmailAuth={onOpenEmailAuth}
                onLocalOnly={onLocalOnly}
            />
        );

        const cloudAuthBtn = screen.getByTestId('onboarding-cloud-auth-btn');
        expect(cloudAuthBtn).toBeDefined();
        expect(cloudAuthBtn.getAttribute('disabled')).toBeDefined();
        expect(screen.getByText(/Coming Soon/i)).toBeDefined();

        cloudAuthBtn.click();
        expect(onOpenEmailAuth).not.toHaveBeenCalled();
    });
});

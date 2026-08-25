import { describe, it, expect } from 'vitest';
import { FEATURES } from '../config/features';

describe('Feature Configuration', () => {
    it('defaults SYNC to false when VITE_ENABLE_SYNC is not set to true', () => {
        expect(FEATURES.SYNC).toBe(false);
    });
});

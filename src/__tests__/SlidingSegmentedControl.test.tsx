import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SlidingSegmentedControl } from '../components/SlidingSegmentedControl';

describe('SlidingSegmentedControl', () => {
    it('renders all options and calls onChange when clicked', () => {
        const onChange = vi.fn();
        const options = [
            { value: 'small', label: 'Small' },
            { value: 'medium', label: 'Medium' },
            { value: 'large', label: 'Large' },
        ];

        render(
            <SlidingSegmentedControl
                options={options}
                value="medium"
                onChange={onChange}
            />
        );

        expect(screen.getByText('Small')).toBeDefined();
        expect(screen.getByText('Medium')).toBeDefined();
        expect(screen.getByText('Large')).toBeDefined();

        fireEvent.click(screen.getByText('Large'));
        expect(onChange).toHaveBeenCalledWith('large');

        fireEvent.click(screen.getByText('Small'));
        expect(onChange).toHaveBeenCalledWith('small');
    });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MobileSwipeContainer } from '../components/MobileSwipeContainer';

describe('MobileSwipeContainer', () => {
  beforeEach(() => {
    // Mock window.innerWidth to return a standard mobile size (375px)
    vi.stubGlobal('innerWidth', 375);
    window.dispatchEvent(new Event('resize'));
  });

  it('triggers onBack immediately when drag is released beyond the 30% threshold', () => {
    const onBack = vi.fn();
    
    const { container } = render(
      <MobileSwipeContainer active={true} onBack={onBack}>
        <div>Editor Content</div>
      </MobileSwipeContainer>
    );

    const containerEl = container.firstElementChild as HTMLElement;
    expect(containerEl).not.toBeNull();

    // 1. Start Touch
    fireEvent.touchStart(containerEl, {
      touches: [{ clientX: 10, clientY: 100 }],
    });

    // 2. Drag to the right by 150px (exceeds 375 * 0.3 = 112.5px threshold)
    fireEvent.touchMove(containerEl, {
      touches: [{ clientX: 160, clientY: 100 }],
    });

    // 3. Release touch
    fireEvent.touchEnd(containerEl);

    // Assert that onBack is called immediately upon release, not delayed
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders with fixed positioning on mobile screen', () => {
    const { container } = render(
      <MobileSwipeContainer active={true} onBack={vi.fn()}>
        <div>Editor Content</div>
      </MobileSwipeContainer>
    );

    const containerEl = container.firstElementChild as HTMLElement;
    expect(containerEl).not.toBeNull();
    expect(containerEl.className).toContain('fixed');
    expect(containerEl.className).not.toContain('absolute');
  });
});


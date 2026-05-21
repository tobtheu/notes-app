import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MobileSwipeContainer } from '../components/MobileSwipeContainer';

describe('MobileSwipeContainer', () => {
  beforeEach(() => {
    // Mock window.innerWidth to return a standard mobile size (375px)
    vi.stubGlobal('innerWidth', 375);
    window.dispatchEvent(new Event('resize'));

    // Stub requestAnimationFrame and cancelAnimationFrame for JSDOM
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
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

  it('applies correct iOS paddingTop style and handles background parallax translation', () => {
    // 1. Setup mock `#app-background` element in JSDOM
    const appBg = document.createElement('div');
    appBg.id = 'app-background';
    document.body.appendChild(appBg);

    try {
      const { container } = render(
        <MobileSwipeContainer active={true} onBack={vi.fn()} isIOS={true}>
          <div>Editor Content</div>
        </MobileSwipeContainer>
      );

      const containerEl = container.firstElementChild as HTMLElement;
      expect(containerEl).not.toBeNull();
      // Should have iOS padding-top style applied
      expect(containerEl.style.paddingTop).toBe('calc(24px + var(--safe-top, 0vh))');

      // Simulate dragging
      fireEvent.touchStart(containerEl, {
        touches: [{ clientX: 10, clientY: 100 }],
      });

      // Drag to right by 100px (100px out of 375px is 26.6% swipe)
      fireEvent.touchMove(containerEl, {
        touches: [{ clientX: 110, clientY: 100 }],
      });

      // Background translation should be updated with parallax: -100 + (100 / 375) * 100 = -73.33px
      expect(appBg.style.transform).toContain('translate3d');
      expect(appBg.style.transform).not.toBe('');
    } finally {
      document.body.removeChild(appBg);
    }
  });

  it('calls preventDefault on touchmove to lock vertical scroll when dragging horizontally', () => {
    const { container } = render(
      <MobileSwipeContainer active={true} onBack={vi.fn()}>
        <div>Editor Content</div>
      </MobileSwipeContainer>
    );

    const containerEl = container.firstElementChild as HTMLElement;
    expect(containerEl).not.toBeNull();

    // 1. Start Touch at eligible boundary (clientX < 35)
    fireEvent.touchStart(containerEl, {
      touches: [{ clientX: 10, clientY: 100 }],
    });

    // 2. Dispatch cancelable touchmove event and capture preventDefault call
    const moveEvent = new TouchEvent('touchmove', {
      touches: [{ clientX: 50, clientY: 100 } as any],
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(moveEvent, 'preventDefault');
    containerEl.dispatchEvent(moveEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('renders a plain div fallback on desktop screen', () => {
    // 1. Mock window.innerWidth to return a desktop size (1024px)
    vi.stubGlobal('innerWidth', 1024);
    window.dispatchEvent(new Event('resize'));

    const { container } = render(
      <MobileSwipeContainer active={true} onBack={vi.fn()} className="test-desktop-class">
        <div>Editor Content</div>
      </MobileSwipeContainer>
    );

    const containerEl = container.firstElementChild as HTMLElement;
    expect(containerEl).not.toBeNull();
    // Desktop layout should render standard container without 'fixed' or translate style overrides
    expect(containerEl.className).toContain('test-desktop-class');
    expect(containerEl.className).not.toContain('fixed');
    expect(containerEl.style.transform).toBe('');
  });
});


import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSidebarGestures } from '../hooks/useSidebarGestures';

describe('useSidebarGestures hook', () => {
  it('correctly updates sidebar width and triggers collapse state on swipe right (opening)', () => {
    const setIsSidebarCollapsed = vi.fn();
    
    const { result } = renderHook(() => useSidebarGestures({
      isSidebarCollapsed: true,
      setIsSidebarCollapsed,
      activeView: 'notelist',
      isFocusMode: false,
    }));

    const container = document.createElement('div');
    const sidebar = document.createElement('div');
    
    // Assign references using the callback ref and manual assignment
    act(() => {
      result.current.containerRef(container);
      (result.current.sidebarRef as any).current = sidebar;
    });

    // Simulate TouchStart
    const startEvent = new TouchEvent('touchstart', {
      touches: [{ clientX: 20, clientY: 100 } as any],
    });
    container.dispatchEvent(startEvent);

    // Simulate TouchMove (drag horizontally right by 100px)
    const moveEvent = new TouchEvent('touchmove', {
      touches: [{ clientX: 120, clientY: 100 } as any],
      cancelable: true,
    });
    container.dispatchEvent(moveEvent);

    // Sidebar width should be updated during dragging
    expect(sidebar.style.width).toBe('164px'); // 64px initial collapsed + 100px drag delta

    // Simulate TouchEnd
    const endEvent = new TouchEvent('touchend', {
      touches: [],
    });
    container.dispatchEvent(endEvent);

    // Snap open should be triggered
    expect(setIsSidebarCollapsed).toHaveBeenCalledWith(false);
  });
});

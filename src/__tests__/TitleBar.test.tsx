import { render } from '@testing-library/react';
import { TitleBar } from '../components/TitleBar';
import { describe, it, expect, vi } from 'vitest';

// Mock getCurrentWindow
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    startDragging: vi.fn(),
    minimize: vi.fn(),
    maximize: vi.fn(),
    unmaximize: vi.fn(),
    isMaximized: vi.fn().mockResolvedValue(false),
    close: vi.fn(),
  }),
}));

// Mock type from @tauri-apps/plugin-os
vi.mock('@tauri-apps/plugin-os', () => ({
  type: () => 'macos',
}));

describe('TitleBar Component', () => {
  it('renders with sidebar background color regardless of activeView', () => {
    const { rerender } = render(
      <TitleBar
        isSidebarCollapsed={false}
        onToggleCollapse={vi.fn()}
        activeView="notelist"
      />
    );
    const titleBar = document.getElementById('titlebar');
    expect(titleBar?.style.backgroundColor).toBe('var(--sidebar-bg)');

    // Rerender with activeView as editor
    rerender(
      <TitleBar
        isSidebarCollapsed={false}
        onToggleCollapse={vi.fn()}
        activeView="editor"
      />
    );
    expect(titleBar?.style.backgroundColor).toBe('var(--sidebar-bg)');
  });
});

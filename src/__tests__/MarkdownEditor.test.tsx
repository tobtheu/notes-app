import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { MarkdownEditor } from '../components/MarkdownEditor';

vi.mock('@tauri-apps/plugin-os', () => ({
    platform: () => 'macos',
}));

vi.mock('@tauri-apps/api/core', () => ({
    convertFileSrc: (path: string) => path,
}));

(window as any).tauriAPI = {};

(window as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
} as any;

describe('MarkdownEditor toolbar visibility animation', () => {
    it('applies toolbar-static-visible on initial load when toolbarVisible is true', () => {
        const { container } = render(
            <MarkdownEditor
                content="# Hello"
                onChange={vi.fn()}
                workspacePath="/mock/workspace"
                toolbarVisible={true}
            />
        );

        const toolbarWrapper = container.querySelector('.origin-bottom');
        expect(toolbarWrapper).not.toBeNull();
        expect(toolbarWrapper?.classList.contains('toolbar-static-visible')).toBe(true);
    });

    it('triggers animate-toolbar-enter spring bounce when toggled to visible', () => {
        const { container, rerender } = render(
            <MarkdownEditor
                content="# Hello"
                onChange={vi.fn()}
                workspacePath="/mock/workspace"
                toolbarVisible={false}
            />
        );

        const toolbarWrapper = container.querySelector('.origin-bottom');
        expect(toolbarWrapper?.classList.contains('toolbar-static-hidden')).toBe(true);

        act(() => {
            rerender(
                <MarkdownEditor
                    content="# Hello"
                    onChange={vi.fn()}
                    workspacePath="/mock/workspace"
                    toolbarVisible={true}
                />
            );
        });

        expect(toolbarWrapper?.classList.contains('animate-toolbar-enter')).toBe(true);
    });

    it('triggers animate-toolbar-exit when toggled to hidden', () => {
        const { container, rerender } = render(
            <MarkdownEditor
                content="# Hello"
                onChange={vi.fn()}
                workspacePath="/mock/workspace"
                toolbarVisible={true}
            />
        );

        const toolbarWrapper = container.querySelector('.origin-bottom');
        expect(toolbarWrapper?.classList.contains('toolbar-static-visible')).toBe(true);

        act(() => {
            rerender(
                <MarkdownEditor
                    content="# Hello"
                    onChange={vi.fn()}
                    workspacePath="/mock/workspace"
                    toolbarVisible={false}
                />
            );
        });

        expect(toolbarWrapper?.classList.contains('animate-toolbar-exit')).toBe(true);
    });
});

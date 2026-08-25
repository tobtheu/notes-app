import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMarkdownEditor } from '../hooks/useMarkdownEditor';

vi.mock('@tauri-apps/plugin-os', () => ({
    platform: () => 'macos',
}));

vi.mock('@tauri-apps/api/core', () => ({
    convertFileSrc: (path: string) => path,
}));

// Mock window.tauriAPI
(window as any).tauriAPI = {};

describe('useMarkdownEditor paste behavior', () => {
    it('parses pasted markdown text into formatted nodes instead of raw codeBlock', () => {
        const onChange = vi.fn();
        const { result } = renderHook(() =>
            useMarkdownEditor({
                content: '',
                onChange,
                workspacePath: '/mock/workspace',
            })
        );

        const editor = result.current.editor;
        expect(editor).not.toBeNull();

        if (!editor) return;

        // Simulate pasting multi-line markdown or indented markdown text
        const markdownToPaste = '    # Heading\n    Paragraph line 1\n    Paragraph line 2';

        act(() => {
            const pasteEvent = new Event('paste', { bubbles: true, cancelable: true }) as any;
            pasteEvent.clipboardData = {
                getData: (format: string) => {
                    if (format === 'text/plain') return markdownToPaste;
                    return '';
                },
                types: ['text/plain'],
            };
            editor.view.dom.dispatchEvent(pasteEvent);
        });

        // The editor content should contain a heading and a paragraph, NOT a codeBlock node
        const json = editor.getJSON();
        const topNodeTypes = json.content?.map((n: any) => n.type);
        
        expect(topNodeTypes).not.toContain('codeBlock');
    });

    it('transforms pasted markdown text into markdown slice using tiptap-markdown parser', () => {
        const onChange = vi.fn();
        const { result } = renderHook(() =>
            useMarkdownEditor({
                content: '',
                onChange,
                workspacePath: '/mock/workspace',
            })
        );

        const editor = result.current.editor;
        expect(editor).not.toBeNull();

        if (!editor) return;

        const markdownText = '## Section Title\n\n- Item 1\n- Item 2\n\n> A quote';

        act(() => {
            const pasteEvent = new Event('paste', { bubbles: true, cancelable: true }) as any;
            pasteEvent.clipboardData = {
                getData: (format: string) => {
                    if (format === 'text/plain') return markdownText;
                    return '';
                },
                types: ['text/plain'],
            };
            editor.view.dom.dispatchEvent(pasteEvent);
        });

        const json = editor.getJSON();
        const topNodeTypes = json.content?.map((n: any) => n.type);

        expect(topNodeTypes).toContain('heading');
        expect(topNodeTypes).toContain('bulletList');
        expect(topNodeTypes).toContain('blockquote');
        expect(topNodeTypes).not.toContain('codeBlock');
    });

    it('preserves codeBlock node when text explicitly starts with triple backticks', () => {
        const onChange = vi.fn();
        const { result } = renderHook(() =>
            useMarkdownEditor({
                content: '',
                onChange,
                workspacePath: '/mock/workspace',
            })
        );

        const editor = result.current.editor;
        expect(editor).not.toBeNull();

        if (!editor) return;

        const codeBlockText = '```js\nconsole.log("hello");\n```';

        act(() => {
            const pasteEvent = new Event('paste', { bubbles: true, cancelable: true }) as any;
            pasteEvent.clipboardData = {
                getData: (format: string) => {
                    if (format === 'text/plain') return codeBlockText;
                    return '';
                },
                types: ['text/plain'],
            };
            editor.view.dom.dispatchEvent(pasteEvent);
        });

        const json = editor.getJSON();
        const topNodeTypes = json.content?.map((n: any) => n.type);

        expect(topNodeTypes).toContain('codeBlock');
    });
});

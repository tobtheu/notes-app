import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { buildToolbarItems } from '../utils/toolbarItems';
import { toggleSmartMark } from '../utils/editor';
import { BubbleToolbarContent } from '../components/BubbleToolbarContent';

describe('Underline Toolbar and Formatting', () => {
    it('buildToolbarItems includes the underline button with localized label', () => {
        const mockEditor = {
            isActive: vi.fn((name: string) => name === 'underline'),
            chain: vi.fn().mockReturnValue({
                focus: vi.fn().mockReturnThis(),
                toggleUnderline: vi.fn().mockReturnThis(),
                run: vi.fn(),
            }),
            state: {
                selection: { from: 5, empty: false },
                doc: { resolve: vi.fn() },
            },
        } as any;

        const t = (key: string) => (key === 'editor.underline' ? 'Unterstrichen' : key);
        const items = buildToolbarItems({ editor: mockEditor, t });

        const underlineItem = items.find((i) => i.id === 'underline');
        expect(underlineItem).toBeDefined();
        expect(underlineItem?.type).toBe('button');
        expect(underlineItem?.label).toBe('Unterstrichen');
        expect(underlineItem?.isActive).toBe(true);

        // Trigger action
        underlineItem?.action?.();
        expect(mockEditor.chain().toggleUnderline().run).toHaveBeenCalled();
    });

    it('toggleSmartMark handles underline on selection', () => {
        const runMock = vi.fn();
        const toggleUnderlineMock = vi.fn().mockReturnValue({ run: runMock });
        const mockEditor = {
            chain: vi.fn().mockReturnValue({
                focus: vi.fn().mockReturnValue({
                    toggleUnderline: toggleUnderlineMock,
                }),
            }),
            state: {
                selection: { from: 2, empty: false },
                doc: { resolve: vi.fn() },
            },
        } as any;

        toggleSmartMark(mockEditor, 'underline');
        expect(toggleUnderlineMock).toHaveBeenCalled();
        expect(runMock).toHaveBeenCalled();
    });

    it('BubbleToolbarContent renders Underline button and handles click', () => {
        const runMock = vi.fn();
        const toggleUnderlineMock = vi.fn().mockReturnValue({ run: runMock });
        const mockEditor = {
            on: vi.fn(),
            off: vi.fn(),
            isActive: vi.fn((mark: string) => mark === 'underline'),
            getAttributes: vi.fn().mockReturnValue({}),
            chain: vi.fn().mockReturnValue({
                focus: vi.fn().mockReturnValue({
                    toggleUnderline: toggleUnderlineMock,
                }),
            }),
            state: {
                selection: { from: 0, empty: false },
                doc: { resolve: vi.fn() },
            },
        };

        render(
            <BubbleToolbarContent
                editor={mockEditor}
                onLinkClick={vi.fn()}
            />
        );

        // Find Underline button by its title or text 'U'
        const underlineBtn = screen.getByTitle('Underline');
        expect(underlineBtn).toBeDefined();

        fireEvent.click(underlineBtn);
        expect(toggleUnderlineMock).toHaveBeenCalled();
    });
});

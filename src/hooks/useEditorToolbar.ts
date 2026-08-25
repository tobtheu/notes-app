import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import type { Editor } from '@tiptap/react';
import { buildToolbarItems, type ToolbarItem } from '../utils/toolbarItems';

export type { ToolbarItem };

interface UseEditorToolbarProps {
    editor: Editor | null;
    mode?: 'full' | 'compact';
    onLinkClick?: () => void;
    mobile?: boolean;
}

export function useEditorToolbar({
    editor,
    mode = 'full',
    onLinkClick,
    mobile = false
}: UseEditorToolbarProps) {
    const [, setUpdateCount] = useState(0);
    const [visibleCount, setVisibleCount] = useState<number>(99);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const hiddenContainerRef = useRef<HTMLDivElement>(null);
    const hiddenOverflowRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Subscribe to transaction changes to update active button states
    useEffect(() => {
        if (!editor) return;

        const updateHandler = () => {
            setUpdateCount(prev => prev + 1);
        };

        editor.on('transaction', updateHandler);

        return () => {
            editor.off('transaction', updateHandler);
        };
    }, [editor]);

    // Handle clicks outside the overflow dropdown to close it
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const isCompact = mode === 'compact';
    const iconSize = mobile ? 20 : 16;
    const btnPadding = mobile ? "p-2.5" : "p-1.5";

    const items = buildToolbarItems({ editor, onLinkClick });

    const filteredItems = items.filter(item => !isCompact || item.showInCompact);

    // Dynamic width calculation effect
    useLayoutEffect(() => {
        if (typeof ResizeObserver === 'undefined') return;
        if (!containerRef.current || !hiddenContainerRef.current || !hiddenOverflowRef.current) return;

        // Find the outermost editor viewport to measure available width stably without transform interference
        const editorArea = containerRef.current.closest('.flex-1') || document.body;

        const measure = () => {
            if (!hiddenContainerRef.current || !hiddenOverflowRef.current) return;
            const containerWidth = (editorArea instanceof HTMLElement ? editorArea.clientWidth : window.innerWidth) - 32;
            const hiddenChildren = Array.from(hiddenContainerRef.current.children) as HTMLElement[];
            const overflowBtnWidth = hiddenOverflowRef.current.offsetWidth || 28;

            if (hiddenChildren.length === 0) return;

            const gap = 4;
            let totalWidth = 0;
            let fitCount = 0;

            // Use offsetWidth which is immune to CSS transform: scale() during animations
            const childWidths = hiddenChildren.map(c => c.offsetWidth || 28);

            for (let i = 0; i < hiddenChildren.length; i++) {
                const itemWidth = childWidths[i];
                const nextTotal = totalWidth + itemWidth + (i > 0 ? gap : 0);

                if (nextTotal <= containerWidth) {
                    totalWidth = nextTotal;
                    fitCount++;
                } else {
                    break;
                }
            }

            if (fitCount < hiddenChildren.length) {
                totalWidth = 0;
                fitCount = 0;
                for (let i = 0; i < hiddenChildren.length; i++) {
                    const itemWidth = childWidths[i];
                    const nextTotal = totalWidth + itemWidth + (i > 0 ? gap : 0);

                    if (nextTotal + overflowBtnWidth + gap <= containerWidth) {
                        totalWidth = nextTotal;
                        fitCount++;
                    } else {
                        break;
                    }
                }
            }

            setVisibleCount(prev => (prev === fitCount ? prev : fitCount));
        };

        const observer = new ResizeObserver(() => {
            measure();
        });

        observer.observe(editorArea);
        measure();
        return () => observer.disconnect();
    }, [filteredItems.length]);

    const visibleItems = filteredItems.slice(0, visibleCount);
    const overflowItems = filteredItems.slice(visibleCount);

    return {
        isCompact,
        iconSize,
        btnPadding,
        visibleItems,
        overflowItems,
        filteredItems,
        isDropdownOpen,
        setIsDropdownOpen,
        containerRef,
        hiddenContainerRef,
        hiddenOverflowRef,
        dropdownRef
    };
}

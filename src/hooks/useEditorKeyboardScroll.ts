import { useState, useEffect, useRef, useCallback } from 'react';
import type { Editor } from '@tiptap/react';

/**
 * Hook for tracking mobile keyboard height via visualViewport
 * and automatically scrolling the active cursor above the keyboard.
 */
export function useEditorKeyboardScroll(isIOS: boolean) {
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const keyboardHeightRef = useRef(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const scrollCursorAboveKeyboard = useCallback((editorInstance: Editor | null) => {
        if (!editorInstance || keyboardHeightRef.current <= 0) return;
        const container = scrollContainerRef.current;
        if (!container) return;
        try {
            const { from } = editorInstance.state.selection;
            const coords = editorInstance.view.coordsAtPos(from);
            // Use window.innerHeight - keyboardHeight as the true visible bottom
            const visibleBottom = window.innerHeight - keyboardHeightRef.current - 16;
            if (coords.bottom > visibleBottom) {
                container.scrollTop += coords.bottom - visibleBottom;
            }
        } catch { }
    }, []);

    useEffect(() => {
        const vv = window.visualViewport;
        if (!vv) return;

        if (isIOS) {
            const onResize = () => {
                window.scrollTo(0, 0);
                const kbHeight = window.innerHeight - vv.height - vv.offsetTop;
                const h = kbHeight > 50 ? kbHeight : 0;
                keyboardHeightRef.current = h;
                setKeyboardHeight(h);
            };
            vv.addEventListener('resize', onResize);
            return () => {
                vv.removeEventListener('resize', onResize);
            };
        }

        const update = () => {
            const kbHeight = window.innerHeight - vv.height;
            if (kbHeight > 100) {
                setKeyboardHeight(kbHeight);
            } else {
                setKeyboardHeight(0);
            }
        };
        vv.addEventListener('resize', update);
        vv.addEventListener('scroll', update);
        update();
        return () => {
            vv.removeEventListener('resize', update);
            vv.removeEventListener('scroll', update);
        };
    }, [isIOS]);

    return {
        keyboardHeight,
        keyboardHeightRef,
        scrollContainerRef,
        scrollCursorAboveKeyboard,
    };
}

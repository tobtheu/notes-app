import type { Editor } from '@tiptap/react';

/**
 * toggleSmartMark Utility
 * Enhances standard Tiptap mark toggling (bold, italic, etc.).
 * 
 * Logic:
 * - Selection is NOT empty: Toggle mark on the current selection.
 * - Selection IS empty: Intelligently expand selection to the whole word 
 *   under the cursor before toggling.
 * 
 * This provides a more fluid typing experience across different devices.
 */
export const toggleSmartMark = (editor: Editor, markType: string, options?: any, focus = true) => {
    if (!editor) return;

    const chain = () => focus ? editor.chain().focus() : editor.chain();

    const { selection, doc } = editor.state;
    const { from, empty } = selection;

    if (!empty) {
        // Standard behavior for existing selection
        if (markType === 'bold') chain().toggleBold().run();
        else if (markType === 'italic') chain().toggleItalic().run();
        else if (markType === 'highlight') chain().toggleHighlight(options).run();
        return;
    }

    /**
     * --- WORD BOUNDARY DETECTION ---
     * Resolves the current position in the ProseMirror doc and scans backwards/forwards
     * for word characters (\w).
     */
    const $pos = doc.resolve(from);
    const text = $pos.parent.textContent;
    const offset = $pos.parentOffset;

    let start = offset;
    let end = offset;

    // Find start of word (scan left)
    while (start > 0 && /\w/.test(text[start - 1])) {
        start--;
    }

    // Find end of word (scan right)
    while (end < text.length && /\w/.test(text[end])) {
        end++;
    }

    /**
     * Stellschraube: Word Expansion Selection
     * If we found a contiguous block of word characters, we select it.
     */
    if (start < end) {
        const absoluteStart = from - offset + start;
        const absoluteEnd = from - offset + end;

        chain().setTextSelection({ from: absoluteStart, to: absoluteEnd }).run();

        // Apply toggling to the newly selected word
        if (markType === 'bold') chain().toggleBold().run();
        else if (markType === 'italic') chain().toggleItalic().run();
        else if (markType === 'highlight') chain().toggleHighlight(options).run();
    } else {
        // Fallback: cursor in whitespace/special char — toggle at cursor for future typing.
        if (markType === 'bold') chain().toggleBold().run();
        else if (markType === 'italic') chain().toggleItalic().run();
        else if (markType === 'highlight') chain().toggleHighlight(options).run();
    }
};

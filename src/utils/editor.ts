import type { Editor } from '@tiptap/react';

/**
 * Toggles a mark (like bold, italic, highlight) on the current selection.
 * If no text is selected, it automatically expands the selection to the current word
 * before applying the mark.
 */
export const toggleSmartMark = (editor: Editor, markType: string, options?: any) => {
    if (!editor) return;

    const { selection, doc } = editor.state;
    const { from, empty } = selection;

    if (!empty) {
        // If text is already selected, just toggle the mark as usual
        if (markType === 'bold') editor.chain().focus().toggleBold().run();
        else if (markType === 'italic') editor.chain().focus().toggleItalic().run();
        else if (markType === 'highlight') editor.chain().focus().toggleHighlight(options).run();
        return;
    }

    // If no text is selected, find the word boundaries
    const $pos = doc.resolve(from);
    const text = $pos.parent.textContent;
    const offset = $pos.parentOffset;

    let start = offset;
    let end = offset;

    // Find start of word
    while (start > 0 && /\w/.test(text[start - 1])) {
        start--;
    }

    // Find end of word
    while (end < text.length && /\w/.test(text[end])) {
        end++;
    }

    // If we found a word, select it and toggle the mark
    if (start < end) {
        const absoluteStart = from - offset + start;
        const absoluteEnd = from - offset + end;

        editor.chain()
            .focus()
            .setTextSelection({ from: absoluteStart, to: absoluteEnd })
            .run();

        // Toggle the mark on the new selection
        if (markType === 'bold') editor.chain().focus().toggleBold().run();
        else if (markType === 'italic') editor.chain().focus().toggleItalic().run();
        else if (markType === 'highlight') editor.chain().focus().toggleHighlight(options).run();
    } else {
        // Fallback: if no word found (e.g. between spaces), just toggle at cursor (standard Tiptap behavior)
        if (markType === 'bold') editor.chain().focus().toggleBold().run();
        else if (markType === 'italic') editor.chain().focus().toggleItalic().run();
        else if (markType === 'highlight') editor.chain().focus().toggleHighlight(options).run();
    }
};

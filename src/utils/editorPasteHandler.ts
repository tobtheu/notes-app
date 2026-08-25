import type { EditorView } from 'prosemirror-view';
import type { Editor } from '@tiptap/react';

/**
 * Custom paste handler for markdown editor.
 * Prevents unwanted codeblock indentation wrapping and parses clean markdown directly.
 */
export function handleEditorPaste(
    view: EditorView,
    event: ClipboardEvent,
    editor: Editor | null
): boolean {
    const clipboardData = event.clipboardData;
    if (!clipboardData) return false;

    const text = clipboardData.getData('text/plain');
    const html = clipboardData.getData('text/html');

    // If HTML is present in clipboard (e.g. copied rich text from a browser), let default Tiptap/ProseMirror handle it
    if (html && html.trim().length > 0) {
        return false;
    }

    if (!text || !text.trim()) return false;

    // Check if user is currently inside a code block node
    const { $from } = view.state.selection;
    let inCodeBlock = false;
    for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === 'codeBlock') {
            inCodeBlock = true;
            break;
        }
    }
    if (inCodeBlock) return false;

    // Check if the text itself explicitly starts with a fence (```)
    const isExplicitCodeBlock = /^\s*```/.test(text);

    // Clean up leading line indents if the pasted text isn't an explicit code block fenced with ```
    // Standard markdown parsers treat 4-space indented lines as indented code blocks.
    let processedText = text;
    if (!isExplicitCodeBlock) {
        const lines = text.split('\n');
        const hasConsistent4SpaceIndent = lines.every(line => line.trim() === '' || line.startsWith('    ') || line.startsWith('\t'));
        if (hasConsistent4SpaceIndent) {
            processedText = lines.map(line => line.replace(/^(    |\t)/, '')).join('\n');
        }
    }

    const markdownStorage = (editor?.storage as any)?.markdown;
    if (markdownStorage?.parser && editor) {
        try {
            const parsedNode = markdownStorage.parser.parse(processedText);
            if (parsedNode) {
                event.preventDefault();
                event.stopPropagation();
                editor.commands.insertContent(processedText);
                return true;
            }
        } catch (err) {
            console.error('Failed to parse pasted markdown:', err);
        }
    }

    return false;
}

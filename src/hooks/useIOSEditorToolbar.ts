import { useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { toggleSmartMark } from '../utils/editor';

interface UseIOSEditorToolbarProps {
    isIOS: boolean;
    editor: Editor | null;
    keyboardHeight: number;
    scrollCursorAboveKeyboard: (editor: Editor | null) => void;
    openLinkModal: () => void;
}

/**
 * Hook for iOS native accessory toolbar integration via WebKit message handlers.
 */
export function useIOSEditorToolbar({
    isIOS,
    editor,
    keyboardHeight,
    scrollCursorAboveKeyboard,
    openLinkModal,
}: UseIOSEditorToolbarProps) {
    const openLinkModalRef = useRef(openLinkModal);
    useEffect(() => { openLinkModalRef.current = openLinkModal; }, [openLinkModal]);

    useEffect(() => {
        if (!isIOS || !editor || keyboardHeight <= 0) return;
        const t1 = setTimeout(() => scrollCursorAboveKeyboard(editor), 100);
        const t2 = setTimeout(() => scrollCursorAboveKeyboard(editor), 400);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, [isIOS, editor, keyboardHeight, scrollCursorAboveKeyboard]);

    useEffect(() => {
        if (!isIOS || !editor) return;

        (window as any).webkit?.messageHandlers?.toolbarVisible?.postMessage(true);

        (window as any).toolbarAction = (action: string) => {
            switch (action) {
                case 'bold':       toggleSmartMark(editor, 'bold', undefined, false); break;
                case 'italic':     toggleSmartMark(editor, 'italic', undefined, false); break;
                case 'highlight':  toggleSmartMark(editor, 'highlight', undefined, false); break;
                case 'h1':         editor.chain().toggleHeading({ level: 1 }).run(); break;
                case 'h2':         editor.chain().toggleHeading({ level: 2 }).run(); break;
                case 'h3':         editor.chain().toggleHeading({ level: 3 }).run(); break;
                case 'bulletList': editor.chain().toggleBulletList().run(); break;
                case 'taskList':   editor.chain().toggleTaskList().run(); break;
                case 'blockquote': editor.chain().toggleBlockquote().run(); break;
                case 'codeBlock':  editor.chain().toggleCodeBlock().run(); break;
                case 'link':       openLinkModalRef.current(); break;
                case 'undo':       editor.chain().undo().run(); break;
                case 'redo':       editor.chain().redo().run(); break;
                case 'indent':     editor.chain().sinkListItem('listItem').run(); break;
                case 'outdent':    editor.chain().liftListItem('listItem').run(); break;
                case 'table':      editor.chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); break;
            }
        };

        const sendState = () => {
            const state = {
                bold:       editor.isActive('bold'),
                italic:     editor.isActive('italic'),
                highlight:  editor.isActive('highlight'),
                h1:         editor.isActive('heading', { level: 1 }),
                h2:         editor.isActive('heading', { level: 2 }),
                h3:         editor.isActive('heading', { level: 3 }),
                bulletList: editor.isActive('bulletList'),
                taskList:   editor.isActive('taskList'),
                blockquote: editor.isActive('blockquote'),
                codeBlock:  editor.isActive('codeBlock'),
                link:       editor.isActive('link'),
            };
            (window as any).webkit?.messageHandlers?.toolbarState?.postMessage(state);
        };

        editor.on('selectionUpdate', sendState);
        editor.on('transaction', sendState);

        const ensureCursorVisible = () => {
            requestAnimationFrame(() => scrollCursorAboveKeyboard(editor));
        };
        editor.on('selectionUpdate', ensureCursorVisible);
        editor.on('focus', ensureCursorVisible);

        return () => {
            delete (window as any).toolbarAction;
            editor.off('selectionUpdate', sendState);
            editor.off('transaction', sendState);
            editor.off('selectionUpdate', ensureCursorVisible);
            editor.off('focus', ensureCursorVisible);
            (window as any).webkit?.messageHandlers?.toolbarVisible?.postMessage(false);
        };
    }, [isIOS, editor, scrollCursorAboveKeyboard]);
}

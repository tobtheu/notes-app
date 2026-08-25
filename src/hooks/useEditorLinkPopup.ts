import { useState, useRef, useCallback, useEffect } from 'react';
import type { Editor } from '@tiptap/react';

interface UseEditorLinkPopupProps {
    editor: Editor | null;
}

export function useEditorLinkPopup({ editor }: UseEditorLinkPopupProps) {
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [linkModalData, setLinkModalData] = useState<{ url: string; text: string }>({ url: '', text: '' });
    const [hoveredLink, setHoveredLink] = useState<{ href: string; text: string; pos: number; rect: DOMRect } | null>(null);

    const hideTimeoutRef = useRef<any>(null);

    const clearHideTimeout = () => {
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
        }
    };

    const startHideTimeout = () => {
        clearHideTimeout();
        hideTimeoutRef.current = setTimeout(() => {
            setHoveredLink(null);
            hideTimeoutRef.current = null;
        }, 300);
    };

    const openLinkModal = useCallback((initialUrl?: string, initialText?: string) => {
        if (!editor) return;
        setLinkModalData({
            url: initialUrl || editor.getAttributes('link').href || '',
            text: initialText || editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to) || ''
        });
        setIsLinkModalOpen(true);
    }, [editor]);

    useEffect(() => {
        const handler = () => openLinkModal();
        window.addEventListener('tiptap:openLinkModal', handler);
        return () => window.removeEventListener('tiptap:openLinkModal', handler);
    }, [openLinkModal]);

    const saveLink = (url: string, text?: string) => {
        if (!editor) return;

        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
        } else {
            if (text) {
                editor.chain()
                    .focus()
                    .extendMarkRange('link')
                    .insertContent({
                        type: 'text',
                        text: text,
                        marks: [{ type: 'link', attrs: { href: url } }]
                    })
                    .run();
            } else {
                editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
            }
        }
        setIsLinkModalOpen(false);
    };

    return {
        isLinkModalOpen,
        setIsLinkModalOpen,
        linkModalData,
        hoveredLink,
        setHoveredLink,
        clearHideTimeout,
        startHideTimeout,
        openLinkModal,
        saveLink,
    };
}

import { useState, useCallback } from 'react';
import type { EditorView } from 'prosemirror-view';

export function useEditorDragDrop() {
    const [isDragging, setIsDragging] = useState(false);

    const handleDragEnter = useCallback(() => {
        setIsDragging(true);
        return false;
    }, []);

    const handleDragOver = useCallback((_view: EditorView, event: DragEvent) => {
        setIsDragging(true);
        event.preventDefault();
        return false;
    }, []);

    const handleDragLeave = useCallback((view: EditorView, event: DragEvent) => {
        if (!((view.dom as HTMLElement).contains(event.relatedTarget as Node))) {
            setIsDragging(false);
        }
        return false;
    }, []);

    return {
        isDragging,
        setIsDragging,
        handleDragEnter,
        handleDragOver,
        handleDragLeave,
    };
}

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Note } from '../types';
import { type MarkdownEditorRef } from '../components/MarkdownEditor';
import { getPathId } from '../utils/path';
import { exportNoteToPdf } from '../utils/export';

interface UseNoteEditorProps {
    note: Note;
    onSave: (id: string, filename: string, content: string, folder?: string) => Promise<string | void>;
    markdownEnabled: boolean;
    isFocusMode: boolean;
    onToggleFocus: () => void;
    onSync?: () => void;
}

export function useNoteEditor({
    note,
    onSave,
    markdownEnabled,
    isFocusMode,
    onSync,
}: UseNoteEditorProps) {
    /**
     * --- LOCAL STATE & REFS ---
     */
    const [content, setContent] = useState(() => note.content);

    // Tiptap becomes slow with very large files. Above 200KB force plain-text.
    const isLargeFile = useMemo(
        () => note.content.length > 50_000 && new Blob([note.content]).size > 200 * 1024,
        [note.content],
    );
    const effectiveMarkdownEnabled = markdownEnabled && !isLargeFile;

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const titleRef = useRef<HTMLTextAreaElement>(null);
    const markdownEditorRef = useRef<MarkdownEditorRef>(null);
    const plainTextContainerRef = useRef<HTMLDivElement>(null);

    const currentNoteId = getPathId(note.filename, note.folder || "");
    const lastNoteId = useRef(currentNoteId);
    const lastSavedContent = useRef(note.content);
    const isDirty = useRef(false);

    // Throttle sync-on-blur
    const lastSyncTime = useRef(0);
    const throttledSync = useCallback(() => {
        const now = Date.now();
        if (now - lastSyncTime.current > 10000) {
            lastSyncTime.current = now;
            onSync?.();
        }
    }, [onSync]);

    /**
     * --- STATE SYNC WHEN SWITCHING NOTES ---
     */
    useEffect(() => {
        const id = getPathId(note.filename, note.folder || "");

        if (id !== lastNoteId.current) {
            lastNoteId.current = id;
            setContent(note.content);
            lastSavedContent.current = note.content;
            isDirty.current = false;

            // Always reset scroll to the top when switching to another note
            requestAnimationFrame(() => {
                markdownEditorRef.current?.scrollToTop();
                if (plainTextContainerRef.current) {
                    plainTextContainerRef.current.scrollTop = 0;
                }
            });
        } else {
            // Parent updated the same note (e.g. from remote sync). Only update if user is not actively typing.
            if (!isDirty.current && note.content !== lastSavedContent.current) {
                setContent(note.content);
                lastSavedContent.current = note.content;
            }
        }
    }, [note.folder, note.filename, note.content]);

    // Auto-focus title input immediately when creating/opening an empty or new note
    useEffect(() => {
        const isNewNote = !note.content || note.content.trim() === '' || note.content.trim() === '#';
        if (isNewNote) {
            const focusInput = () => {
                if (titleRef.current) {
                    titleRef.current.focus();
                    const len = titleRef.current.value.length;
                    titleRef.current.setSelectionRange(len, len);
                }
            };
            focusInput();
            const raf = requestAnimationFrame(focusInput);
            const timer = setTimeout(focusInput, 40);
            return () => {
                cancelAnimationFrame(raf);
                clearTimeout(timer);
            };
        }
    }, [note.filename, note.folder]);

    /**
     * --- FAST CONTENT SPLITTING (O(Title) instead of O(N) array allocation) ---
     */
    const firstNewlineIndex = content.indexOf('\n');
    let title = '';
    let body = '';

    if (firstNewlineIndex === -1) {
        title = content.replace(/^#\s*/, '');
        body = '';
    } else {
        const firstLine = content.slice(0, firstNewlineIndex);
        title = firstLine.replace(/^#\s*/, '').replace(/\r$/, '');
        body = content.slice(firstNewlineIndex + 1);
    }

    /**
     * --- CHANGE HANDLERS ---
     */
    const handleTitleChange = useCallback((newTitle: string) => {
        isDirty.current = true;
        setContent(prevContent => {
            const idx = prevContent.indexOf('\n');
            const bodyPart = idx === -1 ? '' : prevContent.slice(idx);
            return `# ${newTitle}${bodyPart}`;
        });
    }, []);

    const handleBodyChange = useCallback((newBody: string) => {
        isDirty.current = true;
        setContent(prevContent => {
            const idx = prevContent.indexOf('\n');
            const titleLine = idx === -1 ? prevContent : prevContent.slice(0, idx);
            return `${titleLine}\n${newBody}`;
        });
    }, []);

    // Auto-resize textareas
    useEffect(() => {
        const resize = () => {
            [titleRef.current, textareaRef.current].forEach(ref => {
                if (ref) {
                    ref.style.height = 'auto';
                    ref.style.height = ref.scrollHeight + 'px';
                }
            });
        };
        resize();
        const raf = requestAnimationFrame(resize);
        return () => cancelAnimationFrame(raf);
    }, [content, isFocusMode]);

    const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            markdownEditorRef.current?.focus('start');
        } else if (e.key === 'ArrowDown') {
            const { selectionStart, selectionEnd, value } = e.currentTarget;
            if (selectionStart === selectionEnd && selectionStart === value.length) {
                e.preventDefault();
                markdownEditorRef.current?.focus('start');
            }
        }
    };

    /**
     * --- SINGLE UNIFIED 150ms DEBOUNCED AUTO-SAVE ---
     */
    useEffect(() => {
        if (content === lastSavedContent.current) return;

        const timer = setTimeout(async () => {
            await onSave(lastNoteId.current, note.filename, content, note.folder);
            lastSavedContent.current = content;
            isDirty.current = false;
        }, 150);

        return () => clearTimeout(timer);
    }, [content, note.filename, note.folder, onSave]);

    /**
     * --- FLUSH ON UNMOUNT / NOTE SWITCH ---
     */
    const contentRef = useRef(content);
    useEffect(() => { contentRef.current = content; }, [content]);

    const onSyncRef = useRef(onSync);
    useEffect(() => { onSyncRef.current = onSync; }, [onSync]);

    const onSaveRef = useRef(onSave);
    useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

    useEffect(() => {
        return () => {
            if (isDirty.current && contentRef.current !== lastSavedContent.current) {
                onSaveRef.current(lastNoteId.current, note.filename, contentRef.current, note.folder);
            }
            onSyncRef.current?.();
        };
    }, [note.filename, note.folder]);

    const handleExport = useCallback(() => {
        exportNoteToPdf(title, body);
    }, [title, body]);

    return {
        title,
        body,
        content,
        effectiveMarkdownEnabled,
        isLargeFile,
        titleRef,
        textareaRef,
        markdownEditorRef,
        plainTextContainerRef,
        handleTitleChange,
        handleBodyChange,
        handleTitleKeyDown,
        throttledSync,
        handleExport
    };
}

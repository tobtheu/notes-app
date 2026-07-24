import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Note } from '../types';
import { type MarkdownEditorRef } from '../components/MarkdownEditor';
import { getPathId, normalizeStr } from '../utils/path';
import { exportNoteToPdf } from '../utils/export';

interface UseNoteEditorProps {
    note: Note;
    allNotes?: Note[];
    onSave: (id: string, filename: string, content: string, folder?: string, skipRename?: boolean) => Promise<string | void>;
    onUpdateLocally: (filename: string, content: string, folder?: string, updateTimestamp?: boolean) => void;
    onNavigate?: (id: string, anchor?: string) => void;
    markdownEnabled: boolean;
    toolbarVisible: boolean;
    setToolbarVisible: (visible: boolean) => void;
    spellcheckEnabled: boolean;
    workspacePath: string;
    isFocusMode: boolean;
    onToggleFocus: () => void;
    onSync?: () => void;
    imageCloudSync?: boolean;
    isIOS?: boolean;
    iosLandscapeFullscreen?: boolean;
}

function stripFrontmatter(content: string): string {
    return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trimStart();
}

const extractTitle = (content: string) => {
    const firstLine = content.split(/\r?\n/)[0] || '';
    return firstLine.replace(/^#\s*/, '').trim();
};

export function useNoteEditor({
    note,
    allNotes,
    onSave,
    onUpdateLocally,
    onNavigate,
    markdownEnabled,
    spellcheckEnabled,
    toolbarVisible,
    setToolbarVisible,
    workspacePath,
    isFocusMode,
    onToggleFocus,
    onSync,
    imageCloudSync = false,
    isIOS = false,
    iosLandscapeFullscreen = false
}: UseNoteEditorProps) {
    /**
     * --- LOCAL STATE & REFS ---
     */
    const [content, setContent] = useState(() => stripFrontmatter(note.content));

    // Tiptap becomes unusably slow with large files. Above this threshold we
    // force plain-text mode regardless of the user's markdownEnabled setting.
    const initialNoteContent = useRef(note.content);
    const isLargeFile = useMemo(
        () => new Blob([initialNoteContent.current]).size > 200 * 1024,
        [],
    );
    const effectiveMarkdownEnabled = markdownEnabled && !isLargeFile;

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const titleRef = useRef<HTMLTextAreaElement>(null);
    const markdownEditorRef = useRef<MarkdownEditorRef>(null);

    // tracks if the component is in its "initial loading" phase for a specific note
    const isMounting = useRef(true);
    const lastNoteId = useRef(getPathId(note.filename, note.folder || ""));

    // Tracks the last version committed to disk to avoid redundant saves
    const lastSavedContent = useRef(stripFrontmatter(note.content));

    // Throttle sync-on-blur: don't trigger more than once per 10s to avoid constant syncing
    const lastSyncTime = useRef(0);
    const throttledSync = useCallback(() => {
        const now = Date.now();
        if (now - lastSyncTime.current > 10000) {
            lastSyncTime.current = now;
            onSync?.();
        }
    }, [onSync]);

    // Tracks if we have unsaved/unflushed modifications (prevents parent overwriting our typing)
    const isDirty = useRef(false);

    /**
     * --- SIDE EFFECTS: STATE SYNC ---
     */

    // Sync internal state when a DIFFERENT note is loaded
    useEffect(() => {
        const currentNoteId = getPathId(note.filename, note.folder || "");

        if (currentNoteId !== lastNoteId.current) {
            lastNoteId.current = currentNoteId;
            setContent(stripFrontmatter(note.content));
            lastSavedContent.current = stripFrontmatter(note.content);
            isDirty.current = false;
        } else {
            // Parent updated the SAME note (e.g. from GitHub/Electric). Only accept if we aren't typing.
            if (!isDirty.current && note.content !== lastSavedContent.current) {
                setContent(stripFrontmatter(note.content));
                lastSavedContent.current = stripFrontmatter(note.content);
            }
        }
    }, [note.folder, note.filename, note.content]);

    // Once the component mounts, wait 1.5s before allowing auto-saves
    // to prevent Tiptap's initial HTML normalization from triggering a save.
    useEffect(() => {
        isMounting.current = true;

        // Auto-focus the title field for new (empty) notes
        const isNewNote = !note.content || note.content.trim() === '' || note.content.trim() === '#';
        if (isNewNote) {
            setTimeout(() => titleRef.current?.focus(), 50);
        }

        const timer = setTimeout(() => {
            isMounting.current = false;
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    /**
     * --- DATA PARSING ---
     */
    const lines = content.split(/\r?\n/);
    const title = lines[0].replace(/^#\s*/, '');
    const body = lines.slice(1).join('\n');

    /**
     * --- CHANGE HANDLERS ---
     */

    // Updates the first line (# Title) of the content string
    const handleTitleChange = useCallback((newTitle: string) => {
        isDirty.current = true;
        setContent(prevContent => {
            const current = prevContent;
            const lines = current.split(/\r?\n/);
            const newContent = `# ${newTitle}\n${lines.slice(1).join('\n')}`;
            return newContent;
        });
    }, []);

    // Updates everything after the first line in the content string
    const handleBodyChange = useCallback((newBody: string) => {
        isDirty.current = true;
        setContent(prevContent => {
            const current = prevContent;
            const lines = current.split(/\r?\n/);
            const newContent = `${lines[0] || ''}\n${newBody}`;
            return newContent;
        });
    }, []);

    // Auto-resize textareas to fit content height
    useEffect(() => {
        [titleRef.current, textareaRef.current].forEach(ref => {
            if (ref) {
                ref.style.height = 'auto';
                ref.style.height = ref.scrollHeight + 'px';
            }
        });
    }, [content]);

    /**
     * --- AUTO-SAVE LOGIC ---
     */

    // 1. Optimistic UI Update: Syncs editor state to the global note list state for elegant previews
    useEffect(() => {
        if (isMounting.current) return;

        const isSignificantChange = content.trim() !== note.content.trim();
        if (isSignificantChange) {
            isDirty.current = true; // Protects local content from background auto-renames

            // Debounce the UI preview update slightly to keep typing 100% fluid
            const handler = setTimeout(() => {
                onUpdateLocally(note.filename, content, note.folder, false);
            }, 300);
            return () => clearTimeout(handler);
        }
    }, [content, note.filename, note.folder, onUpdateLocally, note.content]);

    const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            markdownEditorRef.current?.focus('start');
        } else if (e.key === 'ArrowDown') {
            const { selectionStart, selectionEnd, value } = e.currentTarget;
            if (selectionStart === selectionEnd && selectionStart === value.length) {
                e.preventDefault();
                markdownEditorRef.current?.focus('start');
            }
        } else if (e.key === 'Tab') {
            e.preventDefault();
            markdownEditorRef.current?.focus('start');
        }
    };

    // 2. Disk Persistence: Debounced save to the underlying .md file.
    useEffect(() => {
        const handler = setTimeout(async () => {
            if (isMounting.current) return;
            if (content !== lastSavedContent.current) {
                // AUTO-SAVE: Always skip rename while typing to stay fluid
                const newId = await onSave(lastNoteId.current, note.filename, content, note.folder, true);
                if (newId && typeof newId === 'string') lastNoteId.current = newId;
                lastSavedContent.current = content;
            }
        }, 1000);

        return () => clearTimeout(handler);
    }, [content, note.filename, note.folder, onSave]);

    // 2.1 Inactivity Rename: Performs the physical rename if user is idle for 5s
    useEffect(() => {
        const handler = setTimeout(async () => {
            const currentTitle = extractTitle(content);
            const safeTitle = currentTitle.replace(/[^a-z0-9äöüß ]/gi, '').trim().substring(0, 50);
            const currentDiskBase = note.filename.replace(/\.md$/, '');

            const titleDiffersFromFilename = safeTitle.length > 0 && normalizeStr(safeTitle) !== normalizeStr(currentDiskBase);

            if (titleDiffersFromFilename) {
                const newId = await onSave(lastNoteId.current, note.filename, content, note.folder, false);
                if (newId && typeof newId === 'string') lastNoteId.current = newId;
            }
        }, 5000);

        return () => clearTimeout(handler);
    }, [content, note.filename, note.folder, onSave]);

    // 3. Flush on Note Switch / Unmount
    const contentRef = useRef(content);
    useEffect(() => { contentRef.current = content; }, [content]);

    const onSyncRef = useRef(onSync);
    useEffect(() => { onSyncRef.current = onSync; }, [onSync]);

    const onSaveRef = useRef(onSave);
    useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

    useEffect(() => {
        return () => {
            if (isDirty.current) {
                const currentTitle = extractTitle(contentRef.current);
                const currentDiskBase = note.filename.replace('.md', '');
                const titleChanged = normalizeStr(currentTitle) !== normalizeStr(currentDiskBase) && currentTitle.length > 0;
                const contentDirty = contentRef.current !== lastSavedContent.current;

                if (contentDirty || titleChanged) {
                    onSaveRef.current(lastNoteId.current, note.filename, contentRef.current, note.folder, true);
                }
            }
            onSyncRef.current?.();
        };
    }, [note.filename, note.folder]);

    // Listen for 'Esc' key to exit focus mode
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isFocusMode) {
                onToggleFocus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFocusMode, onToggleFocus]);

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
        handleTitleChange,
        handleBodyChange,
        handleTitleKeyDown,
        throttledSync,
        handleExport
    };
}

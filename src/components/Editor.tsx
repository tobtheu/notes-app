import { useState, useEffect, useRef, useCallback } from 'react';
import type { Note } from '../types';
import { MarkdownEditor } from './MarkdownEditor';
import clsx from 'clsx';
import { MoreVertical, FileDown, Eye, EyeOff, Loader2 } from 'lucide-react';
import { getPathId, normalizeStr } from '../utils/path';

const extractTitle = (content: string) => {
    const firstLine = content.split('\n')[0] || '';
    return firstLine.replace(/^#\s*/, '').trim();
};

interface EditorProps {
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
    className?: string;
}

/**
 * Editor Component
 * The main writing environment. Orchestrates title and body editing,
 * state synchronization with the underlying file system, and auto-saving.
 * 
 * Supports two modes: 
 * 1. MarkdownEditor (Rich Text/WYSIWYG via Tiptap)
 * 2. Plain Textarea (Standard text editing)
 */
export function Editor({
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
    className
}: EditorProps) {
    /**
     * --- LOCAL STATE & REFS ---
     */
    const [content, setContent] = useState(note.content);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const titleRef = useRef<HTMLTextAreaElement>(null);

    // tracks if the component is in its "initial loading" phase for a specific note
    const isMounting = useRef(true);
    const lastNoteId = useRef(getPathId(note.filename, note.folder || ""));

    // Tracks the last version committed to disk to avoid redundant saves
    const lastSavedContent = useRef(note.content);

    // Tracks if we have unsaved/unflushed modifications (prevents parent overwriting our typing)
    const isDirty = useRef(false);

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);


    /**
     * --- SIDE EFFECTS: STATE SYNC ---
     */

    // Sync internal state when a DIFFERENT note is loaded
    useEffect(() => {
        const currentNoteId = getPathId(note.filename, note.folder || "");

        if (currentNoteId !== lastNoteId.current) {
            // Because of the 'key' prop in App.tsx, a change here WITHOUT umounting
            // means this is 100% a background auto-rename while we were typing.
            // We just update our reference ID and keep our local typing state.
            lastNoteId.current = currentNoteId;
        } else {
            // Parent updated the SAME note (e.g. from GitHub). Only accept if we aren't typing.
            if (!isDirty.current && note.content !== lastSavedContent.current) {
                setContent(note.content);
                lastSavedContent.current = note.content;
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
    const lines = content.split('\n');
    const title = lines[0].replace(/^#\s*/, '');
    const body = lines.slice(1).join('\n');

    /**
     * --- CHANGE HANDLERS ---
     */

    // Updates the first line (# Title) of the content string
    const handleTitleChange = useCallback((newTitle: string) => {
        setContent(prevContent => {
            const current = prevContent;
            const lines = current.split('\n');
            const newContent = `# ${newTitle}\n${lines.slice(1).join('\n')}`;
            return newContent;
        });
    }, []);

    // Updates everything after the first line in the content string
    const handleBodyChange = useCallback((newBody: string) => {
        setContent(prevContent => {
            const current = prevContent;
            const lines = current.split('\n');
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

    // 2. Disk Persistence: Debounced save to the underlying .md file.
    useEffect(() => {
        // Configuration Point: Auto-save Debounce Delay (ms)
        const handler = setTimeout(async () => {
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
            if (content !== lastSavedContent.current || (contentRef.current && normalizeStr(extractTitle(contentRef.current) + '.md') !== normalizeStr(note.filename))) {
                // Check if title actually differs from disk filename
                const currentTitle = extractTitle(content);
                const currentDiskBase = note.filename.replace('.md', '');

                if (normalizeStr(currentTitle) !== normalizeStr(currentDiskBase) && currentTitle.length > 0) {
                    const newId = await onSave(lastNoteId.current, note.filename, content, note.folder, false);
                    if (newId && typeof newId === 'string') lastNoteId.current = newId;
                }
            }
        }, 5000);

        return () => clearTimeout(handler);
    }, [content, note.filename, note.folder, onSave]);

    // 3. Flush on Note Switch / Unmount
    const contentRef = useRef(content);
    useEffect(() => { contentRef.current = content; }, [content]);

    useEffect(() => {
        return () => {
            // ONLY flush if we actually have unsaved changes.
            // This prevents "zombie" duplicate creation during background refreshes.
            if (isDirty.current) {
                const currentTitle = extractTitle(contentRef.current);
                const currentDiskBase = note.filename.replace('.md', '');
                const titleChanged = normalizeStr(currentTitle) !== normalizeStr(currentDiskBase) && currentTitle.length > 0;
                const contentDirty = contentRef.current !== lastSavedContent.current;

                if (contentDirty || titleChanged) {
                    // SESSION END: Perform physical rename now
                    onSave(lastNoteId.current, note.filename, contentRef.current, note.folder, false);
                }
            }
        };
    }, [note.filename, note.folder, onSave]);







    /**
     * --- UI HELPERS ---
     */

    // Close action menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        if (isMenuOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isMenuOpen]);

    const handleExport = async () => {
        // Parse markdown to HTML
        let parsedBody = body;
        try {
            const { marked } = await import('marked');
            parsedBody = await marked.parse(body);
        } catch (e) {
            console.error('Failed to parse markdown with marked:', e);
            // Fallback: simple newline conversion if marked fails
            parsedBody = body.replace(/\n/g, '<br>');
        }

        const htmlContent = `
            <div class="note-export">
                <h1 class="note-title">${title}</h1>
                <div class="note-body">${parsedBody}</div>
            </div>
            <style>
                .note-export {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
                    padding: 40px;
                    max-width: 850px;
                    margin: auto;
                    color: #1a1a1a;
                }
                .note-title {
                    font-size: 2.5rem;
                    color: #111827;
                    border-bottom: 2px solid #E5E7EB;
                    padding-bottom: 0.75rem;
                    margin-bottom: 2rem;
                    margin-top: 0;
                }
                .note-body {
                    line-height: 1.6;
                    font-size: 11pt;
                }
                .note-body h1 { font-size: 1.8rem; margin-top: 1.5rem; margin-bottom: 1rem; }
                .note-body h2 { font-size: 1.4rem; border-bottom: 1px solid #EEE; padding-bottom: 0.3rem; margin-top: 1.5rem; margin-bottom: 1rem; }
                .note-body h3 { font-size: 1.2rem; margin-top: 1.2rem; margin-bottom: 0.8rem; }
                .note-body p { margin-bottom: 1rem; }
                .note-body ul, .note-body ol { padding-left: 1.5rem; margin-bottom: 1rem; }
                .note-body li { margin-bottom: 0.4rem; }
                
                /* Task lists - hide bullets when checkbox is present */
                .note-body li:has(input[type="checkbox"]) {
                    list-style-type: none;
                    margin-left: -1rem;
                }
                .note-body input[type="checkbox"] {
                    margin-right: 0.5rem;
                    width: 0.9rem;
                    height: 0.9rem;
                    position: relative;
                    top: -1px; /* Nudge it up slightly to align with text */
                    vertical-align: middle;
                    accent-color: #2563eb;
                }

                .note-body pre { background: #F3F4F6; padding: 1rem; border-radius: 6px; overflow-x: auto; font-family: monospace; font-size: 0.9rem; }
                .note-body code { background: #F3F4F6; padding: 0.2rem 0.4rem; border-radius: 4px; font-family: monospace; font-size: 0.9rem; }
                .note-body blockquote { border-left: 4px solid #E5E7EB; padding-left: 1rem; color: #6B7280; font-style: italic; margin: 1.5rem 0; }
                .note-body img { max-width: 100%; height: auto; border-radius: 8px; margin: 1.5rem 0; }
                .note-body table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
                .note-body th, .note-body td { border: 1px solid #E5E7EB; padding: 0.75rem; text-align: left; }
                .note-body th { background: #F9FAFB; font-weight: 600; }
                
                @media print {
                    .note-export { padding: 0; }
                }
            </style>
        `;
        await window.tauriAPI.exportPdf(htmlContent);
    };

    return (
        <div className={clsx("h-full overflow-hidden flex flex-col bg-white dark:bg-gray-900 md:border-l border-gray-100 dark:border-gray-800", className)}>

            {/* --- FLOATING HEADER ACTIONS --- */}
            <div className="fixed top-0 right-8 z-50 flex gap-2" ref={menuRef}>

                {/* Visual Save Status Indicator */}
                <div className="text-xs text-gray-300 self-center mr-2 italic">
                    {content !== note.content ? 'Saving...' : 'Saved'}
                </div>

                <div className="relative">
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition shadow-sm border border-gray-200 dark:border-gray-700"
                        title="Actions"
                    >
                        <MoreVertical size={18} />
                    </button>

                    {isMenuOpen && (
                        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 p-1.5 animate-in fade-in zoom-in duration-200 backdrop-blur-xl">
                            <button
                                onClick={() => { handleExport(); setIsMenuOpen(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors group"
                            >
                                <div className="w-8 h-8 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 transition-colors group-hover:bg-primary-100 dark:group-hover:bg-primary-900/40 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                                    <FileDown size={16} />
                                </div>
                                <span className="font-medium">Export PDF</span>
                            </button>

                            <button
                                onClick={() => { setToolbarVisible(!toolbarVisible); setIsMenuOpen(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors group"
                            >
                                <div className={clsx(
                                    "w-8 h-8 rounded-md flex items-center justify-center transition-colors",
                                    toolbarVisible
                                        ? "bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400"
                                        : "bg-gray-100 dark:bg-gray-700 text-gray-500 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/40 group-hover:text-primary-600 dark:group-hover:text-primary-400"
                                )}>
                                    {toolbarVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                                </div>
                                <span className="font-medium">{toolbarVisible ? 'Hide Toolbar' : 'Show Toolbar'}</span>
                            </button>

                        </div>
                    )}
                </div>
            </div>

            {/* Loading Overlay for Lazy Content */}
            {note.content === undefined && (
                <div className="absolute inset-0 z-40 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
                        <span className="text-sm font-medium text-gray-400">Loading content...</span>
                    </div>
                </div>
            )}

            {/* --- EDITOR CONTENT AREA --- */}
            {markdownEnabled ? (
                /* RICH TEXT MODE */
                <MarkdownEditor
                    content={body}
                    allNotes={allNotes}
                    workspacePath={workspacePath}
                    onChange={handleBodyChange}
                    onNavigate={onNavigate}
                    toolbarVisible={toolbarVisible}
                    spellcheckEnabled={spellcheckEnabled}
                    header={
                        <textarea
                            ref={titleRef}
                            className="w-full p-0 text-xl font-bold bg-transparent border-none outline-none resize-none text-gray-700 dark:text-gray-100 leading-tight mb-6 placeholder-gray-300 dark:placeholder-gray-700"
                            placeholder="Note Title"
                            value={title}
                            onChange={(e) => handleTitleChange(e.target.value)}
                            spellCheck={spellcheckEnabled}
                            rows={1}
                        />
                    }
                />
            ) : (
                /* PLAIN TEXT MODE - Standard Fallback */
                <div className="flex-1 flex flex-col p-8 max-w-4xl mx-auto w-full">
                    <textarea
                        ref={titleRef}
                        className="w-full p-0 text-xl font-bold bg-transparent border-none outline-none resize-none text-gray-700 dark:text-gray-100 leading-tight mb-6 placeholder-gray-300 dark:placeholder-gray-700"
                        placeholder="Note Title"
                        value={title}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        spellCheck={spellcheckEnabled}
                        rows={1}
                    />
                    <textarea
                        ref={textareaRef}
                        className="w-full p-0 text-sm bg-transparent border-none outline-none resize-none text-gray-800 dark:text-gray-300 leading-relaxed flex-1"
                        placeholder="Start typing your note here..."
                        value={body}
                        onChange={(e) => handleBodyChange(e.target.value)}
                        spellCheck={spellcheckEnabled}
                    />
                </div>
            )}
        </div>
    );
}

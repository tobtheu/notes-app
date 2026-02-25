import { useState, useEffect, useRef, useCallback } from 'react';
import type { Note } from '../types';
import { MarkdownEditor } from './MarkdownEditor';
import clsx from 'clsx';
import { MoreVertical, FileDown, Eye, EyeOff } from 'lucide-react';

interface EditorProps {
    note: Note;
    allNotes?: Note[];
    onSave: (filename: string, content: string, folder?: string) => void;
    onUpdateLocally: (filename: string, content: string, folder?: string, updateTimestamp?: boolean) => void;
    onNavigate?: (id: string, anchor?: string) => void;
    markdownEnabled: boolean;
    toolbarVisible: boolean;
    setToolbarVisible: (visible: boolean) => void;
}

export function Editor({ note, allNotes, onSave, onUpdateLocally, onNavigate, markdownEnabled, toolbarVisible, setToolbarVisible }: EditorProps) {
    const [content, setContent] = useState(note.content);
    const [isScrolling, setIsScrolling] = useState(false);
    const scrollTimeoutRef = useRef<any>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const titleRef = useRef<HTMLTextAreaElement>(null);
    const lastNoteId = useRef(`${note.folder}/${note.filename}`);
    const isMounting = useRef(true);

    const lastSavedContent = useRef(note.content);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Sync internal state only when a DIFFERENT note is loaded
    useEffect(() => {
        const currentNoteId = `${note.folder}/${note.filename}`;
        if (currentNoteId !== lastNoteId.current) {
            setContent(note.content);
            lastSavedContent.current = note.content;
            lastNoteId.current = currentNoteId;
            isMounting.current = true;

            // Allow a "settling" period of 1.5s where updates are ignored
            // This prevents Tiptap's initial normalization from triggering a re-sort
            const timer = setTimeout(() => {
                isMounting.current = false;
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [note.folder, note.filename, note.content]);

    // Parse title and body
    const lines = content.split('\n');
    const title = lines[0].replace(/^#\s*/, '');
    const body = lines.slice(1).join('\n');

    const handleTitleChange = useCallback((newTitle: string) => {
        setContent(prevContent => {
            const lines = prevContent.split('\n');
            const newContent = `# ${newTitle}\n${lines.slice(1).join('\n')}`;
            return newContent;
        });
    }, []);

    const handleBodyChange = useCallback((newBody: string) => {
        setContent(prevContent => {
            const lines = prevContent.split('\n');
            const newContent = `${lines[0]}\n${newBody}`;
            return newContent;
        });
    }, []);

    // Auto-resize for both
    useEffect(() => {
        [titleRef.current, textareaRef.current].forEach(ref => {
            if (ref) {
                ref.style.height = 'auto';
                ref.style.height = ref.scrollHeight + 'px';
            }
        });
    }, [content]);

    const handleEndFocus = useCallback((e: React.FocusEvent<HTMLTextAreaElement> | React.MouseEvent<HTMLTextAreaElement>) => {
        const target = e.currentTarget;
        const val = target.value;
        target.setSelectionRange(val.length, val.length);
    }, []);

    // Sync to local notes state (optimistic update)
    useEffect(() => {
        if (isMounting.current) return;

        if (content !== note.content) {
            // Only trigger an update if the content change is significant (not just normalization)
            // This ensures the notes list remains absolutely stable on opening a note.
            const isSignificantChange = content.trim() !== note.content.trim();
            if (isSignificantChange) {
                // updateTimestamp: false ensures the note doesn't jump to top during editing
                onUpdateLocally(note.filename, content, note.folder, false);
            }
        }
    }, [content, note.filename, note.folder, onUpdateLocally, note.content]);

    // Debounced Auto-save to disk
    useEffect(() => {
        const handler = setTimeout(() => {
            if (content !== lastSavedContent.current) {
                // Only save to disk if the change is significant to avoid updating mtime on normalization
                const isSignificant = content.trim() !== lastSavedContent.current.trim();
                if (isSignificant) {
                    onSave(note.filename, content, note.folder);
                }
                lastSavedContent.current = content;
            }
        }, 1000);

        return () => clearTimeout(handler);
    }, [content, note.filename, note.folder, onSave]);

    const handleScroll = useCallback(() => {
        setIsScrolling(true);
        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = setTimeout(() => {
            setIsScrolling(false);
        }, 1000);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };

        if (isMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isMenuOpen]);

    useEffect(() => {
        return () => {
            if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        };
    }, []);

    const handleExport = async () => {
        const html = `<html><body><h1>${title}</h1><pre>${body}</pre></body></html>`;
        await window.electronAPI.exportPdf(html);
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 overflow-hidden relative">
            <div className="fixed top-4 right-8 z-50 flex gap-2" ref={menuRef}>
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
                                onClick={() => {
                                    handleExport();
                                    setIsMenuOpen(false);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors group"
                            >
                                <div className="w-8 h-8 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 transition-colors group-hover:bg-primary-100 dark:group-hover:bg-primary-900/40 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                                    <FileDown size={16} />
                                </div>
                                <span className="font-medium">Export PDF</span>
                            </button>

                            <button
                                onClick={() => {
                                    setToolbarVisible(!toolbarVisible);
                                    setIsMenuOpen(false);
                                }}
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

            {markdownEnabled ? (
                <MarkdownEditor
                    content={body}
                    allNotes={allNotes}
                    onChange={handleBodyChange}
                    onNavigate={onNavigate}
                    toolbarVisible={toolbarVisible}
                    header={
                        <textarea
                            ref={titleRef}
                            className="w-full p-0 text-4xl font-bold bg-transparent border-none outline-none resize-none font-sans text-gray-900 dark:text-gray-100 leading-tight mb-6 placeholder-gray-300 dark:placeholder-gray-700"
                            placeholder="Note Title"
                            value={title}
                            onChange={(e) => handleTitleChange(e.target.value)}
                            onFocus={handleEndFocus}
                            onClick={handleEndFocus}
                            spellCheck={false}
                            rows={1}
                        />
                    }
                />
            ) : (
                <div
                    className={clsx(
                        "flex-1 overflow-y-auto custom-scrollbar px-8 pt-16 flex flex-col cursor-text",
                        isScrolling && "is-scrolling"
                    )}
                    onScroll={handleScroll}
                >
                    <div className="max-w-4xl w-full mx-auto flex-1 flex flex-col">
                        <textarea
                            ref={titleRef}
                            className="w-full p-0 text-4xl font-bold bg-transparent border-none outline-none resize-none font-sans text-gray-900 dark:text-gray-100 leading-tight mb-6 placeholder-gray-300 dark:placeholder-gray-700 shrink-0"
                            placeholder="Note Title"
                            value={title}
                            onChange={(e) => handleTitleChange(e.target.value)}
                            onFocus={handleEndFocus}
                            onClick={handleEndFocus}
                            spellCheck={false}
                            rows={1}
                        />
                        <textarea
                            ref={textareaRef}
                            className="w-full p-0 text-lg bg-transparent border-none outline-none resize-none font-sans text-gray-800 dark:text-gray-300 leading-relaxed flex-1"
                            placeholder="Start typing your note here..."
                            value={body}
                            onChange={(e) => handleBodyChange(e.target.value)}
                            onFocus={handleEndFocus}
                            onClick={handleEndFocus}
                            spellCheck={false}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

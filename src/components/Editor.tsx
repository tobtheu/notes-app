import { useState, useEffect, useRef, useCallback } from 'react';
import type { Note } from '../types';
import { MarkdownEditor } from './MarkdownEditor';

interface EditorProps {
    note: Note;
    onSave: (filename: string, content: string, folder?: string) => void;
    onUpdateLocally: (filename: string, content: string, folder?: string) => void;
    markdownEnabled: boolean;
}

export function Editor({ note, onSave, onUpdateLocally, markdownEnabled }: EditorProps) {
    const [content, setContent] = useState(note.content);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const titleRef = useRef<HTMLTextAreaElement>(null);
    const lastNoteId = useRef(`${note.folder}/${note.filename}`);

    const lastSavedContent = useRef(note.content);

    // Sync internal state only when a DIFFERENT note is loaded
    useEffect(() => {
        const currentNoteId = `${note.folder}/${note.filename}`;
        if (currentNoteId !== lastNoteId.current) {
            setContent(note.content);
            lastSavedContent.current = note.content;
            lastNoteId.current = currentNoteId;
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
        if (content !== note.content) {
            onUpdateLocally(note.filename, content, note.folder);
        }
    }, [content, note.filename, note.folder, onUpdateLocally, note.content]);

    // Debounced Auto-save to disk
    useEffect(() => {
        const handler = setTimeout(() => {
            if (content !== lastSavedContent.current) {
                onSave(note.filename, content, note.folder);
                lastSavedContent.current = content;
            }
        }, 1000);

        return () => clearTimeout(handler);
    }, [content, note.filename, note.folder, onSave]);

    const handleExport = async () => {
        const html = `<html><body><h1>${title}</h1><pre>${body}</pre></body></html>`;
        await window.electronAPI.exportPdf(html);
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 overflow-y-auto custom-scrollbar">
            <div className="absolute top-4 right-4 z-10 flex gap-2">
                <div className="text-xs text-gray-300 self-center mr-2 italic">
                    {content !== note.content ? 'Saving...' : 'Saved'}
                </div>
                <button
                    onClick={handleExport}
                    className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1 rounded text-sm transition shadow-sm border border-gray-200 dark:border-gray-700"
                >
                    Export PDF
                </button>
            </div>

            <div
                className="max-w-4xl w-full mx-auto px-8 pt-16 flex-1 flex flex-col cursor-text overflow-hidden"
                onClick={() => {
                    // Only jump if nothing is selected (prevents killing a fresh drag-selection)
                    if (window.getSelection()?.type === 'Range') return;

                    if (markdownEnabled) {
                        const editor = document.querySelector('.milkdown .ProseMirror') as HTMLElement;
                        editor?.focus();
                    } else {
                        textareaRef.current?.focus();
                    }
                }}
            >
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

                {markdownEnabled ? (
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        <MarkdownEditor
                            content={body}
                            onChange={handleBodyChange}
                        />
                    </div>
                ) : (
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
                )}
            </div>
        </div>
    );
}

import { useState, useEffect, useRef } from 'react';
import type { Note } from '../types';

interface EditorProps {
    note: Note;
    onSave: (filename: string, content: string) => void;
}

export function Editor({ note, onSave }: EditorProps) {
    const [content, setContent] = useState(note.content);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Sync internal state when note prop changes
    useEffect(() => {
        setContent(note.content);
    }, [note.filename, note.content]); // Note: Reacting to content change from outside might conflict with local typing if not careful

    // Auto-resize
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [content]);

    // Debounced Auto-save
    useEffect(() => {
        const handler = setTimeout(() => {
            if (content !== note.content) {
                onSave(note.filename, content);
            }
        }, 1000); // 1 second debounce

        return () => clearTimeout(handler);
    }, [content, note.filename, onSave, note.content]);

    const handleExport = async () => {
        // Simple export: wrap content in basic HTML
        const html = `<html><body><pre>${content}</pre></body></html>`;
        // In real app, render markdown to HTML using a library like 'marked' or 'showdown'
        await window.electronAPI.exportPdf(html);
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 relative">
            <div className="absolute top-4 right-4 z-10">
                <button
                    onClick={handleExport}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm transition"
                >
                    Export PDF
                </button>
            </div>
            <textarea
                ref={textareaRef}
                className="w-full h-full p-8 text-lg bg-transparent border-none outline-none resize-none font-sans text-gray-800 dark:text-gray-100 leading-relaxed"
                placeholder="Start typing..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                spellCheck={false}
            />
            {/* Helper status */}
            <div className="absolute bottom-4 right-8 text-xs text-gray-300">
                {content !== note.content ? 'Saving...' : 'Saved'}
            </div>
        </div>
    );
}

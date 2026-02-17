import { useState } from 'react';
import {
    Search, List, LayoutList, Trash2, Pin
} from 'lucide-react';
import clsx from 'clsx';
import type { Note } from '../types';
import { formatDistanceToNow } from 'date-fns';

interface NoteListProps {
    className?: string;
    notes: Note[];
    selectedNote: Note | null;
    onSelectNote: (note: Note) => void;
    searchTerm: string;
    onSearchChange: (value: string) => void;
    onDeleteNote: (id: string) => void;
    onTogglePin: (note: Note) => void;
    isNotePinned: (note: Note) => boolean;
    getNoteId: (note: Note) => string;
}

const stripMarkdown = (text: string) => {
    if (!text) return '';
    return text
        .split('\n')[0] // Only first line
        .replace(/^#+\s+/, '') // Remove headers
        .replace(/[#*`_~]/g, '') // Remove Markdown characters
        .replace(/\[[x ]\]/g, '') // Remove task list brackets
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .trim();
};

export function NoteList({
    className,
    notes,
    selectedNote,
    onSelectNote,
    searchTerm,
    onSearchChange,
    onDeleteNote,
    onTogglePin,
    isNotePinned,
    getNoteId,
}: NoteListProps) {
    const [isCompact, setIsCompact] = useState(() => {
        return localStorage.getItem('notelist-compact') === 'true';
    });

    const toggleView = () => {
        const newState = !isCompact;
        setIsCompact(newState);
        localStorage.setItem('notelist-compact', String(newState));
    };

    return (
        <div className={clsx("flex flex-col h-full bg-white dark:bg-gray-900", className)}>
            {/* Search and Filter */}
            <div className="p-4 space-y-3">
                <div className="relative group">
                    <Search className="absolute left-3 top-2.5 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Search notes..."
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-primary-500/20 rounded-xl outline-none transition-all dark:text-gray-100"
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                </div>
                <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        {notes.length} {notes.length === 1 ? 'Note' : 'Notes'}
                    </span>
                    <button
                        onClick={toggleView}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 transition-colors"
                        title={isCompact ? "Detail View" : "Compact View"}
                    >
                        {isCompact ? <LayoutList size={18} /> : <List size={18} />}
                    </button>
                </div>
            </div>

            {/* Notes List */}
            <div className="flex-1 overflow-y-auto px-2 pb-4 custom-scrollbar">
                {notes.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">
                        No notes found.
                    </div>
                ) : (
                    notes.map(note => {
                        const noteId = getNoteId(note);
                        const isSelected = selectedNote ? getNoteId(selectedNote) === noteId : false;
                        const isPinned = isNotePinned(note);

                        return (
                            <div
                                key={noteId}
                                onClick={() => onSelectNote(note)}
                                className={clsx(
                                    "group relative p-3 rounded-xl cursor-pointer transition-all mb-1 border-2",
                                    isSelected
                                        ? "bg-primary-50/50 dark:bg-primary-900/20 border-primary-500 shadow-sm"
                                        : "bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-100 dark:hover:border-gray-700"
                                )}
                            >
                                <div className="flex items-start justify-between min-w-0 gap-2">
                                    <h3 className={clsx(
                                        "font-bold truncate dark:text-gray-100",
                                        isCompact ? "text-sm" : "text-base mb-1"
                                    )}>
                                        {note.filename.replace('.md', '')}
                                    </h3>
                                    <div className="flex items-center shrink-0">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onTogglePin(note);
                                            }}
                                            className={clsx(
                                                "p-1 rounded-md transition-all",
                                                isPinned
                                                    ? "text-primary-500 bg-primary-50 dark:bg-primary-900/30 opacity-100"
                                                    : "text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700"
                                            )}
                                            title={isPinned ? "Unpin Note" : "Pin Note"}
                                        >
                                            {isPinned ? <Pin size={14} fill="currentColor" /> : <Pin size={14} />}
                                        </button>
                                    </div>
                                </div>

                                {!isCompact && (
                                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-2 leading-relaxed">
                                        {stripMarkdown(note.content.replace(/^#\s.*?\n/, '').trim()) || 'No additional content'}
                                    </p>
                                )}

                                <div className="flex items-center justify-between text-[10px] font-medium text-gray-400 uppercase tracking-tight">
                                    <div className="flex items-center gap-2">
                                        <span>{formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}</span>
                                        {note.folder && (
                                            <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                                                {note.folder}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteNote(getNoteId(note));
                                        }}
                                        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-300 hover:text-red-500 rounded transition-all"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

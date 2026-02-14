
import { Search, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { Note } from '../types';
import { formatDistanceToNow } from 'date-fns';

interface NoteListProps {
    className?: string;
    notes: Note[];
    selectedNote: Note | null;
    onSelectNote: (note: Note) => void;
    searchTerm: string;
    onSearchChange: (term: string) => void;
    onDeleteNote: (filename: string) => void;
}

export function NoteList({
    className,
    notes,
    selectedNote,
    onSelectNote,
    searchTerm,
    onSearchChange,
    onDeleteNote
}: NoteListProps) {
    return (
        <div className={clsx("flex flex-col h-full bg-white dark:bg-gray-900", className)}>
            {/* Search Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search notes..."
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {notes.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">
                        No notes found.
                    </div>
                ) : (
                    notes.map((note) => (
                        <div
                            key={note.filename}
                            onClick={() => onSelectNote(note)}
                            className={clsx(
                                "group relative p-4 border-b border-gray-100 dark:border-gray-800 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800",
                                selectedNote?.filename === note.filename && "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500"
                            )}
                        >
                            <h3 className="font-semibold text-gray-800 dark:text-gray-200 truncate pr-6">
                                {note.filename.replace('.md', '')}
                            </h3>
                            <p className="mt-1 text-xs text-gray-400 truncate">
                                {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
                            </p>
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 line-clamp-2 h-10">
                                {note.content || "Empty note"}
                            </p>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteNote(note.filename);
                                }}
                                className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-all"
                                title="Delete note"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

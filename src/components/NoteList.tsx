import { useState } from 'react';
import {
    Search, List, LayoutList, Trash2, Pin, FolderTree
} from 'lucide-react';
import clsx from 'clsx';
import type { Note } from '../types';
import { formatDistanceToNow } from 'date-fns';

interface NoteListProps {
    className?: string;
    notes: Note[];
    folders: string[];
    selectedNote: Note | null;
    onSelectNote: (note: Note) => void;
    searchTerm: string;
    onSearchChange: (value: string) => void;
    onDeleteNote: (id: string) => void;
    onMoveNote: (id: string, folder: string | null) => void;
    onTogglePin: (note: Note) => void;
    isNotePinned: (note: Note) => boolean;
    getNoteId: (note: Note) => string;
}

const stripMarkdown = (text: string) => {
    if (!text) return '';
    return text
        .split('\n')[0] // Only first line
        .replace(/^#+\s+/, '') // Remove headers
        .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '$1') // Remove image syntax, keep alt
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove link syntax, keep text
        .replace(/[#*`_~]/g, '') // Remove Markdown characters
        .replace(/\[[x ]\]/g, '') // Remove task list brackets
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .trim();
};

export function NoteList({
    className,
    notes,
    folders,
    selectedNote,
    onSelectNote,
    searchTerm,
    onSearchChange,
    onDeleteNote,
    onMoveNote,
    onTogglePin,
    isNotePinned,
    getNoteId,
}: NoteListProps) {
    const [isCompact, setIsCompact] = useState(() => {
        return localStorage.getItem('notelist-compact') === 'true';
    });
    const [dropdownOpenId, setDropdownOpenId] = useState<string | null>(null);

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
                    notes.map((note, index) => {
                        const noteId = getNoteId(note);
                        const isSelected = selectedNote ? getNoteId(selectedNote) === noteId : false;
                        const isNextSelected = index < notes.length - 1 && selectedNote ? getNoteId(selectedNote) === getNoteId(notes[index + 1]) : false;
                        const isPinned = isNotePinned(note);

                        return (
                            <div key={noteId}>
                                <div
                                    onClick={() => onSelectNote(note)}
                                    className={clsx(
                                        "group relative p-3 rounded-xl cursor-pointer transition-all mb-1 border-2",
                                        isSelected
                                            ? "bg-primary-50/50 dark:bg-primary-900/20 border-primary-500 shadow-sm"
                                            : "bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-100 dark:hover:border-gray-700"
                                    )}
                                >
                                    <div className="flex flex-col min-w-0 gap-2 w-full">
                                        <div className="flex items-start justify-between min-w-0 gap-2 w-full">
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

                                        <div className="flex items-center justify-between text-[10px] font-medium text-gray-400 uppercase tracking-tight relative">
                                            <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                                <span className="shrink-0">{formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true }).replace('less than a minute', '< 1 min').replace('about ', '')}</span>
                                                {note.folder && (
                                                    <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded truncate">
                                                        {note.folder}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <div className="relative">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDropdownOpenId(dropdownOpenId === noteId ? null : noteId);
                                                        }}
                                                        className={clsx(
                                                            "p-1 rounded transition-all",
                                                            dropdownOpenId === noteId
                                                                ? "bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 opacity-100"
                                                                : "opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-300 hover:text-gray-600 dark:hover:text-gray-200"
                                                        )}
                                                        title="Move to Folder"
                                                    >
                                                        <FolderTree size={12} />
                                                    </button>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDeleteNote(getNoteId(note));
                                                    }}
                                                    className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-300 hover:text-red-500 rounded transition-all"
                                                    title="Delete Note"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Folder Selection Accordion (Inline) */}
                                        {dropdownOpenId === noteId && (
                                            <div
                                                className="mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm py-1 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-200"
                                                style={{ maxHeight: '12rem' }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider sticky top-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-700">
                                                    Move to...
                                                </div>
                                                <button
                                                    className={clsx(
                                                        "w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2",
                                                        !note.folder ? "text-primary-600 dark:text-primary-400 font-medium bg-primary-50/30 dark:bg-primary-900/10" : "text-gray-600 dark:text-gray-300"
                                                    )}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onMoveNote(getNoteId(note), null);
                                                        setDropdownOpenId(null);
                                                    }}
                                                >
                                                    <FolderTree size={12} className="opacity-50" />
                                                    Root (No Folder)
                                                </button>
                                                {folders.map(folder => (
                                                    <button
                                                        key={folder}
                                                        className={clsx(
                                                            "w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2",
                                                            note.folder === folder ? "text-primary-600 dark:text-primary-400 font-medium bg-primary-50/30 dark:bg-primary-900/10" : "text-gray-600 dark:text-gray-300"
                                                        )}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onMoveNote(getNoteId(note), folder);
                                                            setDropdownOpenId(null);
                                                        }}
                                                    >
                                                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />
                                                        <span className="truncate">{folder}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {index < notes.length - 1 && (
                                    <div className={clsx(
                                        "border-b mx-2 my-1 transition-colors",
                                        (isSelected || isNextSelected) ? "border-transparent" : "border-gray-200 dark:border-gray-700"
                                    )} />
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

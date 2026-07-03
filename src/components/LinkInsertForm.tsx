import React from 'react';
import { ExternalLink, Link as LinkIcon, Search, FileText, ChevronRight, Hash } from 'lucide-react';
import clsx from 'clsx';
import type { Note } from '../types';

interface LinkInsertFormProps {
    text: string;
    setText: (v: string) => void;
    linkType: 'external' | 'internal';
    setLinkType: (v: 'external' | 'internal') => void;
    url: string;
    setUrl: (v: string) => void;
    inputRef: React.RefObject<HTMLInputElement | null>;
    searchNoteTerm: string;
    setSearchNoteTerm: (v: string) => void;
    selectedNote: Note | null;
    setSelectedNote: (n: Note | null) => void;
    filteredNotes: Note[];
    headlines: string[];
    selectedHeadline: string;
    setSelectedHeadline: (h: string) => void;
}

export function LinkInsertForm({
    text,
    setText,
    linkType,
    setLinkType,
    url,
    setUrl,
    inputRef,
    searchNoteTerm,
    setSearchNoteTerm,
    selectedNote,
    setSelectedNote,
    filteredNotes,
    headlines,
    selectedHeadline,
    setSelectedHeadline
}: LinkInsertFormProps) {
    return (
        <>
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Text</label>
                <input
                    type="text"
                    placeholder="Link text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
            </div>
            <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg mb-4">
                <button
                    type="button"
                    onClick={() => setLinkType('external')}
                    className={clsx(
                        "flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all",
                        linkType === 'external'
                            ? "bg-white dark:bg-gray-800 text-primary-600 shadow-sm"
                            : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    )}
                >
                    <ExternalLink size={14} />External
                </button>
                <button
                    type="button"
                    onClick={() => setLinkType('internal')}
                    className={clsx(
                        "flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all",
                        linkType === 'internal'
                            ? "bg-white dark:bg-gray-800 text-primary-600 shadow-sm"
                            : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    )}
                >
                    <LinkIcon size={14} />Internal Note
                </button>
            </div>
            {linkType === 'external' ? (
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL</label>
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="https://example.com"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                </div>
            ) : (
                <div className="mb-4 flex flex-col gap-3">
                    {!selectedNote ? (
                        <div className="flex flex-col gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search notes..."
                                    value={searchNoteTerm}
                                    onChange={(e) => setSearchNoteTerm(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                            </div>
                            <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md">
                                {filteredNotes.length > 0 ? (
                                    filteredNotes.map(n => (
                                        <button
                                            key={`${n.folder}/${n.filename}`}
                                            type="button"
                                            onClick={() => setSelectedNote(n)}
                                            className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-0 border-solid"
                                        >
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <FileText className="shrink-0 text-gray-400" size={16} />
                                                <span className="text-sm text-gray-700 dark:text-gray-300 truncate font-medium">
                                                    {n.filename.replace('.md', '')}
                                                </span>
                                            </div>
                                            <ChevronRight className="text-gray-300" size={14} />
                                        </button>
                                    ))
                                ) : (
                                    <div className="p-4 text-center text-sm text-gray-400">No notes found</div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between p-2 bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-md">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <FileText className="text-primary-600" size={16} />
                                    <span className="text-sm font-medium text-primary-700 dark:text-primary-300 truncate font-semibold">
                                        {selectedNote.filename.replace('.md', '')}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedNote(null)}
                                    className="text-xs text-primary-600 hover:underline font-medium"
                                >
                                    Change
                                </button>
                            </div>
                            {headlines.length > 0 && (
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">Link to Section (Optional)</label>
                                    <div className="max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedHeadline('')}
                                            className={clsx(
                                                "w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors border-b border-gray-100 dark:border-gray-800 border-solid",
                                                selectedHeadline === ''
                                                    ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium"
                                                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                                            )}
                                        >
                                            <Hash size={14} className={selectedHeadline === '' ? "text-primary-500" : "text-gray-400"} />
                                            Whole Note
                                        </button>
                                        {headlines.map(h => (
                                            <button
                                                key={h}
                                                type="button"
                                                onClick={() => setSelectedHeadline(h)}
                                                className={clsx(
                                                    "w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors border-b border-gray-100 dark:border-gray-800 border-solid last:border-0",
                                                    selectedHeadline === h
                                                        ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium"
                                                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                                                )}
                                            >
                                                <Hash size={14} className={selectedHeadline === h ? "text-primary-500" : "text-gray-400"} />
                                                <span className="truncate">{h}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </>
    );
}

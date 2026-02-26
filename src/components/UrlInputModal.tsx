import React, { useEffect, useRef, useState, useMemo } from 'react';
import { X, Upload, Search, FileText, ChevronRight, Hash, ExternalLink, Link as LinkIcon } from 'lucide-react';
import type { Note } from '../types';
import clsx from 'clsx';

interface UrlInputModalProps {
    isOpen: boolean;
    type: 'link' | 'image';
    initialUrl?: string;
    initialText?: string;
    initialCaption?: string;
    allNotes?: Note[];
    onClose: () => void;
    onSave: (url: string, text?: string, caption?: string) => void;
    onBrowseFiles?: () => void;
}

export const UrlInputModal: React.FC<UrlInputModalProps> = ({ isOpen, type, initialUrl, initialText, initialCaption, allNotes = [], onClose, onSave, onBrowseFiles }) => {
    const [url, setUrl] = useState(initialUrl || '');
    const [text, setText] = useState(initialText || '');
    const [caption, setCaption] = useState(initialCaption || '');
    const [linkType, setLinkType] = useState<'external' | 'internal'>('external');
    const [searchNoteTerm, setSearchNoteTerm] = useState('');
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [selectedHeadline, setSelectedHeadline] = useState<string>('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setUrl(initialUrl || '');
            setText(initialText || '');
            setCaption(initialCaption || '');
            // Focus input on open if not image (since image might use browse)
            if (type !== 'image') {
                setTimeout(() => {
                    inputRef.current?.focus();
                }, 50);
            }
        }
    }, [isOpen, initialUrl, initialText, initialCaption, type]);

    useEffect(() => {
        if (isOpen && initialUrl?.startsWith('note://')) {
            setLinkType('internal');
            const cleanUrl = initialUrl.replace('note://', '');
            const [notePath, anchor] = cleanUrl.split('#');
            const note = allNotes.find(n => {
                const p = n.folder ? `${n.folder}/${n.filename}` : n.filename;
                return p.toLowerCase() === notePath.toLowerCase();
            });
            if (note) {
                setSelectedNote(note);
                if (anchor) setSelectedHeadline(anchor);
            }
        } else if (isOpen) {
            setLinkType('external');
            setSelectedNote(null);
            setSelectedHeadline('');
        }
    }, [isOpen, initialUrl, allNotes]);

    const filteredNotes = useMemo(() => {
        if (!searchNoteTerm) return allNotes;
        return allNotes.filter(n =>
            n.filename.toLowerCase().includes(searchNoteTerm.toLowerCase()) ||
            n.content.toLowerCase().includes(searchNoteTerm.toLowerCase())
        );
    }, [allNotes, searchNoteTerm]);

    const headlines = useMemo(() => {
        if (!selectedNote) return [];
        const matches = selectedNote.content.matchAll(/^#+\s+(.+)$/gm);
        return Array.from(matches).map(m => m[1]);
    }, [selectedNote]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        let finalUrl = url;
        if (type === 'link' && linkType === 'internal' && selectedNote) {
            const notePath = selectedNote.folder ? `${selectedNote.folder}/${selectedNote.filename}` : selectedNote.filename;
            // Encode the path to ensure spaces and special characters don't break the markdown link
            const encodedPath = notePath.split('/').map(segment => encodeURIComponent(segment)).join('/');
            finalUrl = `note://${encodedPath}${selectedHeadline ? `#${selectedHeadline.toLowerCase().replace(/[^a-z0-9äöüß ]/gi, '').trim().replace(/\s+/g, '-')}` : ''}`;
        }
        onSave(finalUrl, text, caption);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md p-4 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-100">
                        {type === 'link' ? 'Insert Link' : 'Insert Image'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {type === 'image' && onBrowseFiles && (
                    <div className="mb-6">
                        <button
                            type="button"
                            onClick={() => {
                                onBrowseFiles();
                                onClose();
                            }}
                            className="w-full py-4 px-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center gap-2 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all group"
                        >
                            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center group-hover:bg-primary-100 dark:group-hover:bg-primary-800 transition-colors">
                                <Upload className="text-gray-500 dark:text-gray-400 group-hover:text-primary-600" size={20} />
                            </div>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-primary-700 dark:group-hover:text-primary-300">
                                Browse local files
                            </span>
                        </button>

                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-gray-200 dark:border-gray-700"></span>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-white dark:bg-gray-800 px-2 text-gray-500 dark:text-gray-400">Or use a URL</span>
                            </div>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {type === 'link' && (
                        <>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Text
                                </label>
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
                                    <ExternalLink size={14} />
                                    External
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
                                    <LinkIcon size={14} />
                                    Internal Note
                                </button>
                            </div>

                            {linkType === 'external' ? (
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        URL
                                    </label>
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
                                                            className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-0"
                                                        >
                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                <FileText className="shrink-0 text-gray-400" size={16} />
                                                                <span className="text-sm text-gray-700 dark:text-gray-300 truncate font-medium">{n.filename.replace('.md', '')}</span>
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
                                                    <span className="text-sm font-medium text-primary-700 dark:text-primary-300 truncate">
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
                                                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">
                                                        Link to Section (Optional)
                                                    </label>
                                                    <div className="max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedHeadline('')}
                                                            className={clsx(
                                                                "w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors border-b border-gray-100 dark:border-gray-800",
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
                                                                    "w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors border-b border-gray-100 dark:border-gray-800 last:border-0",
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
                    )}

                    {type === 'image' && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Image URL
                            </label>
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="https://example.com/image.png"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>
                    )}

                    {type === 'image' && (
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Caption
                            </label>
                            <input
                                type="text"
                                placeholder="Add a caption..."
                                value={caption}
                                onChange={(e) => setCaption(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>
                    )}

                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors"
                        >
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

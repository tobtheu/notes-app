import { useState, useEffect, useRef, useMemo } from 'react';
import type { Note } from '../types';

interface UseUrlInputModalProps {
    isOpen: boolean;
    type?: 'link';
    initialUrl?: string;
    initialText?: string;
    allNotes?: Note[];
    onClose: () => void;
    onSave: (url: string, text?: string) => void;
    workspacePath?: string;
}

export function useUrlInputModal({
    isOpen,
    initialUrl,
    initialText,
    allNotes = [],
    onSave,
}: UseUrlInputModalProps) {
    const [url, setUrl] = useState(initialUrl || '');
    const [text, setText] = useState(initialText || '');
    const [linkType, setLinkType] = useState<'external' | 'internal'>('external');
    const [searchNoteTerm, setSearchNoteTerm] = useState('');
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [selectedHeadline, setSelectedHeadline] = useState<string>('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Synchronize local state with props when modal opens
    useEffect(() => {
        if (isOpen) {
            setUrl(initialUrl || '');
            setText(initialText || '');

            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        }
    }, [isOpen, initialUrl, initialText]);

    // Detective logic for internal links
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        let finalUrl = url;

        if (linkType === 'internal' && selectedNote) {
            const notePath = selectedNote.folder ? `${selectedNote.folder}/${selectedNote.filename}` : selectedNote.filename;
            const encodedPath = notePath.split('/').map(segment => encodeURIComponent(segment)).join('/');
            const anchorId = selectedHeadline
                ? `#${selectedHeadline.toLowerCase().replace(/[^a-z0-9äöüß ]/gi, '').trim().replace(/\s+/g, '-')}`
                : '';
            finalUrl = `note://${encodedPath}${anchorId}`;
        }

        onSave(finalUrl, text);
    };

    return {
        url,
        setUrl,
        text,
        setText,
        linkType,
        setLinkType,
        searchNoteTerm,
        setSearchNoteTerm,
        selectedNote,
        setSelectedNote,
        selectedHeadline,
        setSelectedHeadline,
        inputRef,
        filteredNotes,
        headlines,
        handleSubmit,
    };
}

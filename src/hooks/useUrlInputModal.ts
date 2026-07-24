import { useState, useEffect, useRef, useMemo } from 'react';
import type { Note } from '../types';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useLocalAssetsDir } from './useLocalAssetsDir';

interface UseUrlInputModalProps {
    isOpen: boolean;
    type: 'link' | 'image';
    initialUrl?: string;
    initialText?: string;
    initialCaption?: string;
    allNotes?: Note[];
    onClose: () => void;
    onSave: (url: string, text?: string, caption?: string) => void;
    workspacePath?: string;
}

export function useUrlInputModal({
    isOpen,
    type,
    initialUrl,
    initialText,
    initialCaption,
    allNotes = [],
    onClose: _onClose,
    onSave,
    workspacePath
}: UseUrlInputModalProps) {
    const [url, setUrl] = useState(initialUrl || '');
    const [text, setText] = useState(initialText || '');
    const [caption, setCaption] = useState(initialCaption || '');
    const [linkType, setLinkType] = useState<'external' | 'internal'>('external');
    const [searchNoteTerm, setSearchNoteTerm] = useState('');
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [selectedHeadline, setSelectedHeadline] = useState<string>('');
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [localFileName, setLocalFileName] = useState<string | null>(null);
    const localAssetsDir = useLocalAssetsDir();

    const previewUrl = useMemo(() => {
        if (url && url.startsWith('.assets/') && workspacePath) {
            try {
                return convertFileSrc(`${workspacePath}/${url}`);
            } catch (e) {
                console.warn("Could not convert asset URL for preview:", e);
                return url;
            }
        } else if (url && url.startsWith('local-asset://')) {
            try {
                const filename = url.replace('local-asset://', '');
                if (localAssetsDir) {
                    return convertFileSrc(`${localAssetsDir}/${filename}`);
                }
            } catch (e) {
                console.warn("Could not convert local image src for preview:", e);
                return url;
            }
        }
        return url;
    }, [url, workspacePath, localAssetsDir]);

    // Synchronize local state with props when modal opens
    useEffect(() => {
        if (isOpen) {
            setUrl(initialUrl || '');
            setText(initialText || '');
            setCaption(initialCaption || '');
            setLocalFileName(null);

            if (type !== 'image') {
                setTimeout(() => {
                    inputRef.current?.focus();
                }, 50);
            }
        }
    }, [isOpen, initialUrl, initialText, initialCaption, type]);

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

    const handleFileSelect = (file: File) => {
        if (file && file.type.startsWith('image/')) {
            setLocalFileName(file.name);
            const reader = new FileReader();
            reader.onload = (re) => {
                if (re.target?.result) {
                    setUrl(re.target.result as string);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        let finalUrl = url;

        if (type === 'link' && linkType === 'internal' && selectedNote) {
            const notePath = selectedNote.folder ? `${selectedNote.folder}/${selectedNote.filename}` : selectedNote.filename;
            const encodedPath = notePath.split('/').map(segment => encodeURIComponent(segment)).join('/');
            const anchorId = selectedHeadline
                ? `#${selectedHeadline.toLowerCase().replace(/[^a-z0-9äöüß ]/gi, '').trim().replace(/\s+/g, '-')}`
                : '';
            finalUrl = `note://${encodedPath}${anchorId}`;
        }

        onSave(finalUrl, text, caption);
    };

    return {
        url,
        setUrl,
        text,
        setText,
        caption,
        setCaption,
        linkType,
        setLinkType,
        searchNoteTerm,
        setSearchNoteTerm,
        selectedNote,
        setSelectedNote,
        selectedHeadline,
        setSelectedHeadline,
        inputRef,
        fileInputRef,
        localFileName,
        previewUrl,
        filteredNotes,
        headlines,
        handleFileSelect,
        handleSubmit,
    };
}

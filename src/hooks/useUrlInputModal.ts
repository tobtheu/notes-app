import { useState, useEffect, useRef } from 'react';

interface UseUrlInputModalProps {
    isOpen: boolean;
    initialUrl?: string;
    initialText?: string;
    onSave: (url: string, text?: string) => void;
}

export function useUrlInputModal({
    isOpen,
    initialUrl,
    initialText,
    onSave,
}: UseUrlInputModalProps) {
    const [url, setUrl] = useState(initialUrl || '');
    const [text, setText] = useState(initialText || '');
    const inputRef = useRef<HTMLInputElement>(null);

    const prevOpenRef = useRef(false);

    // Synchronize local state when modal transitions from closed to open
    useEffect(() => {
        if (isOpen && !prevOpenRef.current) {
            setUrl(initialUrl || '');
            setText(initialText || '');

            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 50);
        }
        prevOpenRef.current = isOpen;
    }, [isOpen, initialUrl, initialText]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        let trimmedUrl = url.trim();
        if (!trimmedUrl) {
            onSave('', text.trim() || undefined);
            return;
        }

        if (
            !/^https?:\/\//i.test(trimmedUrl) &&
            !/^mailto:/i.test(trimmedUrl) &&
            !/^#/i.test(trimmedUrl)
        ) {
            trimmedUrl = `https://${trimmedUrl}`;
        }

        onSave(trimmedUrl, text.trim() || undefined);
    };

    return {
        url,
        setUrl,
        text,
        setText,
        inputRef,
        handleSubmit,
    };
}

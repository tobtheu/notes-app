import { useState, useEffect } from 'react';

export function useSettings() {
    const [markdownEnabled, setMarkdownEnabled] = useState<boolean>(() => {
        const saved = localStorage.getItem('markdown-enabled');
        return saved === null ? true : saved === 'true';
    });

    const [accentColor, setAccentColor] = useState<string>(() => {
        return localStorage.getItem('accent-color') || 'blue';
    });


    useEffect(() => {
        localStorage.setItem('markdown-enabled', String(markdownEnabled));
    }, [markdownEnabled]);

    useEffect(() => {
        localStorage.setItem('accent-color', accentColor);
    }, [accentColor]);


    return {
        markdownEnabled,
        setMarkdownEnabled,
        accentColor,
        setAccentColor,
    };
}

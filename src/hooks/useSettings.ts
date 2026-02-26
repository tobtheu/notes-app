import { useState, useEffect } from 'react';

export function useSettings() {
    const [markdownEnabled, setMarkdownEnabled] = useState<boolean>(() => {
        const saved = localStorage.getItem('markdown-enabled');
        return saved === null ? true : saved === 'true';
    });

    const [accentColor, setAccentColor] = useState<string>(() => {
        return localStorage.getItem('accent-color') || 'blue';
    });

    const [fontFamily, setFontFamily] = useState<'inter' | 'roboto' | 'system'>(() => {
        const saved = localStorage.getItem('font-family');
        return (saved === 'inter' || saved === 'roboto' || saved === 'system') ? saved : 'inter';
    });

    const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>(() => {
        const saved = localStorage.getItem('font-size');
        return (saved === 'small' || saved === 'medium' || saved === 'large') ? saved : 'medium';
    });



    const [toolbarVisible, setToolbarVisible] = useState<boolean>(() => {
        const saved = localStorage.getItem('toolbar-visible');
        return saved === null ? true : saved === 'true';
    });

    useEffect(() => {
        localStorage.setItem('markdown-enabled', String(markdownEnabled));
    }, [markdownEnabled]);

    useEffect(() => {
        localStorage.setItem('accent-color', accentColor);
    }, [accentColor]);

    useEffect(() => {
        localStorage.setItem('font-family', fontFamily);
    }, [fontFamily]);

    useEffect(() => {
        localStorage.setItem('font-size', fontSize);
    }, [fontSize]);

    useEffect(() => {
        localStorage.setItem('toolbar-visible', String(toolbarVisible));
    }, [toolbarVisible]);

    return {
        markdownEnabled,
        setMarkdownEnabled,
        accentColor,
        setAccentColor,
        fontFamily,
        setFontFamily,
        fontSize,
        setFontSize,
        toolbarVisible,
        setToolbarVisible,
    };
}

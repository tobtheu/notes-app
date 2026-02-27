import { useState, useEffect, useRef } from 'react';

export function useSettings(metadataSettings?: any, onSaveSettings?: (settings: any) => void) {
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

    const [spellcheckEnabled, setSpellcheckEnabled] = useState<boolean>(() => {
        const saved = localStorage.getItem('spellcheck-enabled');
        return saved === null ? true : saved === 'true';
    });

    const hasLoadedMetadata = useRef(false);

    // Update from metadata if available (cloud sync)
    useEffect(() => {
        if (metadataSettings) {
            if (metadataSettings.markdownEnabled !== undefined) setMarkdownEnabled(metadataSettings.markdownEnabled);
            if (metadataSettings.accentColor !== undefined) setAccentColor(metadataSettings.accentColor);
            // fontFamily and fontSize are device-specific and NOT loaded from cloud metadata
            if (metadataSettings.toolbarVisible !== undefined) setToolbarVisible(metadataSettings.toolbarVisible);
            if (metadataSettings.spellcheckEnabled !== undefined) setSpellcheckEnabled(metadataSettings.spellcheckEnabled);
            hasLoadedMetadata.current = true;
        }
    }, [metadataSettings]);

    // Save to local storage and trigger metadata save
    useEffect(() => {
        localStorage.setItem('markdown-enabled', String(markdownEnabled));
        localStorage.setItem('accent-color', accentColor);
        localStorage.setItem('font-family', fontFamily);
        localStorage.setItem('font-size', fontSize);
        localStorage.setItem('toolbar-visible', String(toolbarVisible));
        localStorage.setItem('spellcheck-enabled', String(spellcheckEnabled));

        // Sync with cloud metadata if callback provided AND we have already loaded metadata once
        if (onSaveSettings && hasLoadedMetadata.current) {
            onSaveSettings({
                markdownEnabled,
                accentColor,
                // fontFamily and fontSize are device-specific and NOT synced to cloud metadata
                toolbarVisible,
                spellcheckEnabled,
            });
        }
    }, [markdownEnabled, accentColor, fontFamily, fontSize, toolbarVisible, spellcheckEnabled, onSaveSettings]);

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
        spellcheckEnabled,
        setSpellcheckEnabled,
    };
}

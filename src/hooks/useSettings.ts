import { useState, useEffect, useRef } from 'react';

/**
 * useSettings Hook
 * Manages application settings with local storage persistence and cloud metadata synchronization.
 * Distinction:
 * - Sync-able: markdownEnabled, accentColor, toolbarVisible, spellcheckEnabled
 * - Device-specific (No sync): fontFamily, fontSize
 */
export function useSettings(metadataSettings?: any, onSaveSettings?: (settings: any) => void) {
    /** --- 1. SETTINGS STATE (Initialized from LocalStorage) --- **/
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

    // Guard to prevent saving to cloud before metadata has been initially loaded
    const hasLoadedMetadata = useRef(false);

    /** --- 2. CLOUD SYNC: LOADING --- **/
    // Triggered when metadata settings are fetched from the backend/Tauri side
    useEffect(() => {
        if (metadataSettings) {
            if (metadataSettings.markdownEnabled !== undefined) setMarkdownEnabled(metadataSettings.markdownEnabled);
            if (metadataSettings.accentColor !== undefined) setAccentColor(metadataSettings.accentColor);
            // Note: fontFamily and fontSize are intentionally OMITTED from cloud sync
            if (metadataSettings.toolbarVisible !== undefined) setToolbarVisible(metadataSettings.toolbarVisible);
            if (metadataSettings.spellcheckEnabled !== undefined) setSpellcheckEnabled(metadataSettings.spellcheckEnabled);
            hasLoadedMetadata.current = true;
        }
    }, [metadataSettings]);

    /** --- 3. PERSISTENCE: LOCAL & CLOUD --- **/
    useEffect(() => {
        // Always persist to local storage
        localStorage.setItem('markdown-enabled', String(markdownEnabled));
        localStorage.setItem('accent-color', accentColor);
        localStorage.setItem('font-family', fontFamily);
        localStorage.setItem('font-size', fontSize);
        localStorage.setItem('toolbar-visible', String(toolbarVisible));
        localStorage.setItem('spellcheck-enabled', String(spellcheckEnabled));

        // Sync with cloud metadata if callback provided AND we have already finished the initial load
        if (onSaveSettings && hasLoadedMetadata.current) {
            onSaveSettings({
                markdownEnabled,
                accentColor,
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

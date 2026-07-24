import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useSettings Hook
 * Manages application settings with local storage persistence and cloud metadata synchronization.
 * Distinction:
 * - Sync-able: markdownEnabled, accentColor, toolbarVisible, spellcheckEnabled, monochromeIcons
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

    const [landscapeFullscreen, setLandscapeFullscreen] = useState<boolean>(() => {
        const saved = localStorage.getItem('landscape-fullscreen');
        return saved === null ? false : saved === 'true';
    });

    const [monochromeIcons, setMonochromeIcons] = useState<boolean>(() => {
        const saved = localStorage.getItem('monochrome-icons');
        return saved === 'true';
    });

    // Guard to prevent saving to cloud before metadata has been initially loaded
    const hasLoadedMetadata = useRef(false);

    /** --- 2. CLOUD SYNC: LOADING --- **/
    // Triggered when metadata settings are fetched from the backend/Tauri side
    useEffect(() => {
        if (metadataSettings) {
            if (metadataSettings.markdownEnabled !== undefined && metadataSettings.markdownEnabled !== markdownEnabled) {
                setMarkdownEnabled(metadataSettings.markdownEnabled);
            }
            if (metadataSettings.accentColor !== undefined && metadataSettings.accentColor !== accentColor) {
                setAccentColor(metadataSettings.accentColor);
            }
            // Note: fontFamily and fontSize are intentionally OMITTED from cloud sync
            if (metadataSettings.toolbarVisible !== undefined && metadataSettings.toolbarVisible !== toolbarVisible) {
                setToolbarVisible(metadataSettings.toolbarVisible);
            }
            if (metadataSettings.spellcheckEnabled !== undefined && metadataSettings.spellcheckEnabled !== spellcheckEnabled) {
                setSpellcheckEnabled(metadataSettings.spellcheckEnabled);
            }
            if (metadataSettings.monochromeIcons !== undefined && metadataSettings.monochromeIcons !== monochromeIcons) {
                setMonochromeIcons(metadataSettings.monochromeIcons);
            }
            hasLoadedMetadata.current = true;
        } else {
            hasLoadedMetadata.current = false;
        }
    }, [metadataSettings, markdownEnabled, accentColor, toolbarVisible, spellcheckEnabled, monochromeIcons]);

    /** --- 3. PERSISTENCE: LOCAL STORAGE ONLY --- **/
    // Always persist to local storage (no-op for React rendering, completely loop-safe)
    useEffect(() => {
        localStorage.setItem('markdown-enabled', String(markdownEnabled));
        localStorage.setItem('accent-color', accentColor);
        localStorage.setItem('font-family', fontFamily);
        localStorage.setItem('font-size', fontSize);
        localStorage.setItem('toolbar-visible', String(toolbarVisible));
        localStorage.setItem('spellcheck-enabled', String(spellcheckEnabled));
        localStorage.setItem('landscape-fullscreen', String(landscapeFullscreen));
        localStorage.setItem('monochrome-icons', String(monochromeIcons));
    }, [markdownEnabled, accentColor, fontFamily, fontSize, toolbarVisible, spellcheckEnabled, landscapeFullscreen, monochromeIcons]);

    /** --- 4. CLOUD SYNC: SAVING (USER INITIATED WRAPPERS) --- **/
    const saveCloudSettings = useCallback((overrides: {
        markdownEnabled?: boolean;
        accentColor?: string;
        toolbarVisible?: boolean;
        spellcheckEnabled?: boolean;
        monochromeIcons?: boolean;
    }) => {
        if (onSaveSettings && hasLoadedMetadata.current) {
            onSaveSettings({
                markdownEnabled: overrides.markdownEnabled ?? markdownEnabled,
                accentColor: overrides.accentColor ?? accentColor,
                toolbarVisible: overrides.toolbarVisible ?? toolbarVisible,
                spellcheckEnabled: overrides.spellcheckEnabled ?? spellcheckEnabled,
                monochromeIcons: overrides.monochromeIcons ?? monochromeIcons,
            });
        }
    }, [markdownEnabled, accentColor, toolbarVisible, spellcheckEnabled, monochromeIcons, onSaveSettings]);

    const setMarkdownEnabledWrapped = useCallback((val: boolean) => {
        setMarkdownEnabled(val);
        saveCloudSettings({ markdownEnabled: val });
    }, [saveCloudSettings]);

    const setAccentColorWrapped = useCallback((val: string) => {
        setAccentColor(val);
        saveCloudSettings({ accentColor: val });
    }, [saveCloudSettings]);

    const setToolbarVisibleWrapped = useCallback((val: boolean) => {
        setToolbarVisible(val);
        saveCloudSettings({ toolbarVisible: val });
    }, [saveCloudSettings]);

    const setSpellcheckEnabledWrapped = useCallback((val: boolean) => {
        setSpellcheckEnabled(val);
        saveCloudSettings({ spellcheckEnabled: val });
    }, [saveCloudSettings]);

    const setMonochromeIconsWrapped = useCallback((val: boolean) => {
        setMonochromeIcons(val);
        saveCloudSettings({ monochromeIcons: val });
    }, [saveCloudSettings]);

    return {
        markdownEnabled,
        setMarkdownEnabled: setMarkdownEnabledWrapped,
        accentColor,
        setAccentColor: setAccentColorWrapped,
        fontFamily,
        setFontFamily,
        fontSize,
        setFontSize,
        toolbarVisible,
        setToolbarVisible: setToolbarVisibleWrapped,
        spellcheckEnabled,
        setSpellcheckEnabled: setSpellcheckEnabledWrapped,
        landscapeFullscreen,
        setLandscapeFullscreen,
        monochromeIcons,
        setMonochromeIcons: setMonochromeIconsWrapped,
    };
}

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useSettings Hook
 * Manages application settings with local storage persistence and cloud metadata synchronization.
 * Distinction:
 * - Sync-able: markdownEnabled, accentColor, toolbarVisible, spellcheckEnabled, monochromeIcons
 * - Device-specific (No sync): fontFamily, fontSize
 */
interface SyncableSettings {
    markdownEnabled: boolean;
    accentColor: string;
    toolbarVisible: boolean;
    spellcheckEnabled: boolean;
    monochromeIcons: boolean;
    showNoteCounts: boolean;
}

export function useSettings(metadataSettings?: any, onSaveSettings?: (settings: any) => void) {
    /** --- 1. SETTINGS STATE (Initialized from LocalStorage) --- **/
    const [syncable, setSyncable] = useState<SyncableSettings>(() => ({
        markdownEnabled: (() => {
            const saved = localStorage.getItem('markdown-enabled');
            return saved === null ? true : saved === 'true';
        })(),
        accentColor: localStorage.getItem('accent-color') || 'blue',
        toolbarVisible: (() => {
            const saved = localStorage.getItem('toolbar-visible');
            return saved === null ? true : saved === 'true';
        })(),
        spellcheckEnabled: (() => {
            const saved = localStorage.getItem('spellcheck-enabled');
            return saved === null ? true : saved === 'true';
        })(),
        monochromeIcons: localStorage.getItem('monochrome-icons') === 'true',
        showNoteCounts: localStorage.getItem('show-note-counts') === 'true',
    }));

    const [fontFamily, setFontFamily] = useState<'inter' | 'roboto' | 'courier' | 'sfmono' | 'serif' | 'system'>(() => {
        const saved = localStorage.getItem('font-family');
        return (saved === 'inter' || saved === 'roboto' || saved === 'courier' || saved === 'sfmono' || saved === 'serif' || saved === 'system') ? (saved as any) : 'inter';
    });

    const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>(() => {
        const saved = localStorage.getItem('font-size');
        return (saved === 'small' || saved === 'medium' || saved === 'large') ? saved : 'medium';
    });

    const [landscapeFullscreen, setLandscapeFullscreen] = useState<boolean>(() => {
        const saved = localStorage.getItem('landscape-fullscreen');
        return saved === null ? false : saved === 'true';
    });

    const [showIconsWhenCollapsed, setShowIconsWhenCollapsed] = useState<boolean>(() => {
        const saved = localStorage.getItem('show-icons-when-collapsed');
        return saved === 'true';
    });

    // Guard to prevent saving to cloud before metadata has been initially loaded
    const hasLoadedMetadata = useRef(false);
    const prevMetadataRef = useRef<any>(undefined);

    /** --- 2. CLOUD SYNC: LOADING (Single Atomic Batch) --- **/
    useEffect(() => {
        if (metadataSettings) {
            setSyncable(prev => {
                const next = { ...prev };
                let hasChange = false;
                if (metadataSettings.markdownEnabled !== undefined && metadataSettings.markdownEnabled !== prev.markdownEnabled) {
                    next.markdownEnabled = metadataSettings.markdownEnabled;
                    hasChange = true;
                }
                if (metadataSettings.accentColor !== undefined && metadataSettings.accentColor !== prev.accentColor) {
                    next.accentColor = metadataSettings.accentColor;
                    hasChange = true;
                }
                if (metadataSettings.toolbarVisible !== undefined && metadataSettings.toolbarVisible !== prev.toolbarVisible) {
                    next.toolbarVisible = metadataSettings.toolbarVisible;
                    hasChange = true;
                }
                if (metadataSettings.spellcheckEnabled !== undefined && metadataSettings.spellcheckEnabled !== prev.spellcheckEnabled) {
                    next.spellcheckEnabled = metadataSettings.spellcheckEnabled;
                    hasChange = true;
                }
                if (metadataSettings.monochromeIcons !== undefined && metadataSettings.monochromeIcons !== prev.monochromeIcons) {
                    next.monochromeIcons = metadataSettings.monochromeIcons;
                    hasChange = true;
                }
                if (metadataSettings.showNoteCounts !== undefined && metadataSettings.showNoteCounts !== prev.showNoteCounts) {
                    next.showNoteCounts = metadataSettings.showNoteCounts;
                    hasChange = true;
                }
                return hasChange ? next : prev;
            });
            prevMetadataRef.current = { ...metadataSettings };
            hasLoadedMetadata.current = true;
        } else {
            prevMetadataRef.current = undefined;
            hasLoadedMetadata.current = false;
        }
    }, [metadataSettings]);

    /** --- 3. PERSISTENCE: LOCAL STORAGE ONLY --- **/
    // Always persist to local storage (no-op for React rendering, completely loop-safe)
    useEffect(() => {
        localStorage.setItem('markdown-enabled', String(syncable.markdownEnabled));
        localStorage.setItem('accent-color', syncable.accentColor);
        localStorage.setItem('font-family', fontFamily);
        localStorage.setItem('font-size', fontSize);
        localStorage.setItem('toolbar-visible', String(syncable.toolbarVisible));
        localStorage.setItem('spellcheck-enabled', String(syncable.spellcheckEnabled));
        localStorage.setItem('landscape-fullscreen', String(landscapeFullscreen));
        localStorage.setItem('monochrome-icons', String(syncable.monochromeIcons));
        localStorage.setItem('show-icons-when-collapsed', String(showIconsWhenCollapsed));
        localStorage.setItem('show-note-counts', String(syncable.showNoteCounts));
    }, [syncable, fontFamily, fontSize, landscapeFullscreen, showIconsWhenCollapsed]);

    /** --- 4. CLOUD SYNC: SAVING (USER INITIATED WRAPPERS) --- **/
    const saveCloudSettings = useCallback((overrides: Partial<SyncableSettings>) => {
        if (prevMetadataRef.current) {
            prevMetadataRef.current = { ...prevMetadataRef.current, ...overrides };
        }
        if (onSaveSettings && hasLoadedMetadata.current) {
            onSaveSettings({
                markdownEnabled: overrides.markdownEnabled ?? syncable.markdownEnabled,
                accentColor: overrides.accentColor ?? syncable.accentColor,
                toolbarVisible: overrides.toolbarVisible ?? syncable.toolbarVisible,
                spellcheckEnabled: overrides.spellcheckEnabled ?? syncable.spellcheckEnabled,
                monochromeIcons: overrides.monochromeIcons ?? syncable.monochromeIcons,
                showNoteCounts: overrides.showNoteCounts ?? syncable.showNoteCounts,
            });
        }
    }, [syncable, onSaveSettings]);

    const setMarkdownEnabledWrapped = useCallback((val: boolean) => {
        setSyncable(prev => ({ ...prev, markdownEnabled: val }));
        saveCloudSettings({ markdownEnabled: val });
    }, [saveCloudSettings]);

    const setAccentColorWrapped = useCallback((val: string) => {
        setSyncable(prev => ({ ...prev, accentColor: val }));
        saveCloudSettings({ accentColor: val });
    }, [saveCloudSettings]);

    const setToolbarVisibleWrapped = useCallback((val: boolean) => {
        setSyncable(prev => ({ ...prev, toolbarVisible: val }));
        saveCloudSettings({ toolbarVisible: val });
    }, [saveCloudSettings]);

    const setSpellcheckEnabledWrapped = useCallback((val: boolean) => {
        setSyncable(prev => ({ ...prev, spellcheckEnabled: val }));
        saveCloudSettings({ spellcheckEnabled: val });
    }, [saveCloudSettings]);

    const setMonochromeIconsWrapped = useCallback((val: boolean) => {
        setSyncable(prev => ({ ...prev, monochromeIcons: val }));
        saveCloudSettings({ monochromeIcons: val });
    }, [saveCloudSettings]);

    const setShowNoteCountsWrapped = useCallback((val: boolean) => {
        setSyncable(prev => ({ ...prev, showNoteCounts: val }));
        saveCloudSettings({ showNoteCounts: val });
    }, [saveCloudSettings]);

    return {
        markdownEnabled: syncable.markdownEnabled,
        setMarkdownEnabled: setMarkdownEnabledWrapped,
        accentColor: syncable.accentColor,
        setAccentColor: setAccentColorWrapped,
        fontFamily,
        setFontFamily,
        fontSize,
        setFontSize,
        toolbarVisible: syncable.toolbarVisible,
        setToolbarVisible: setToolbarVisibleWrapped,
        spellcheckEnabled: syncable.spellcheckEnabled,
        setSpellcheckEnabled: setSpellcheckEnabledWrapped,
        landscapeFullscreen,
        setLandscapeFullscreen,
        monochromeIcons: syncable.monochromeIcons,
        setMonochromeIcons: setMonochromeIconsWrapped,
        showIconsWhenCollapsed,
        setShowIconsWhenCollapsed,
        showNoteCounts: syncable.showNoteCounts,
        setShowNoteCounts: setShowNoteCountsWrapped,
    };
}

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Theme, LightTheme } from './useTheme';

export type FontFamily = 'inter' | 'roboto' | 'courier' | 'sfmono' | 'serif' | 'system';
export type FontSize = 'small' | 'medium' | 'large';

/**
 * useSettings Hook
 * Manages application settings with local storage persistence and full cloud metadata synchronization.
 * Synchronized across all devices:
 * - Appearance: theme, autoTheme, preferredLightTheme, accentColor, monochromeIcons, showIconsWhenCollapsed, showNoteCounts, fontFamily, fontSize
 * - Editor & View: markdownEnabled, toolbarVisible, spellcheckEnabled, landscapeFullscreen
 */
export interface AllSettings {
    theme: Theme;
    autoTheme: boolean;
    preferredLightTheme: LightTheme;
    fontFamily: FontFamily;
    fontSize: FontSize;
    markdownEnabled: boolean;
    accentColor: string;
    toolbarVisible: boolean;
    spellcheckEnabled: boolean;
    monochromeIcons: boolean;
    showIconsWhenCollapsed: boolean;
    showNoteCounts: boolean;
    landscapeFullscreen: boolean;
}

export function useSettings(metadataSettings?: any, onSaveSettings?: (settings: any) => void) {
    /** --- 1. SETTINGS STATE (Initialized from LocalStorage) --- **/
    const [settings, setSettings] = useState<AllSettings>(() => {
        const savedTheme = localStorage.getItem('theme');
        const theme: Theme = (savedTheme === 'dark' || savedTheme === 'sage' || savedTheme === 'clay') ? savedTheme : 'clay';

        const autoTheme = localStorage.getItem('auto_theme') === 'true';

        const savedPrefLight = localStorage.getItem('preferred_light_theme');
        const preferredLightTheme: LightTheme = (savedPrefLight === 'sage' || savedPrefLight === 'clay') 
            ? savedPrefLight 
            : (theme === 'sage' ? 'sage' : 'clay');

        const savedFont = localStorage.getItem('font-family');
        const fontFamily: FontFamily = (savedFont === 'inter' || savedFont === 'roboto' || savedFont === 'courier' || savedFont === 'sfmono' || savedFont === 'serif' || savedFont === 'system') 
            ? (savedFont as FontFamily) 
            : 'inter';

        const savedSize = localStorage.getItem('font-size');
        const fontSize: FontSize = (savedSize === 'small' || savedSize === 'medium' || savedSize === 'large') 
            ? savedSize 
            : 'medium';

        const savedMd = localStorage.getItem('markdown-enabled');
        const markdownEnabled = savedMd === null ? true : savedMd === 'true';

        const accentColor = localStorage.getItem('accent-color') || 'blue';

        const savedTb = localStorage.getItem('toolbar-visible');
        const toolbarVisible = savedTb === null ? true : savedTb === 'true';

        const savedSc = localStorage.getItem('spellcheck-enabled');
        const spellcheckEnabled = savedSc === null ? true : savedSc === 'true';

        const monochromeIcons = localStorage.getItem('monochrome-icons') === 'true';
        const showIconsWhenCollapsed = localStorage.getItem('show-icons-when-collapsed') === 'true';
        const showNoteCounts = localStorage.getItem('show-note-counts') === 'true';
        const landscapeFullscreen = localStorage.getItem('landscape-fullscreen') === 'true';

        return {
            theme,
            autoTheme,
            preferredLightTheme,
            fontFamily,
            fontSize,
            markdownEnabled,
            accentColor,
            toolbarVisible,
            spellcheckEnabled,
            monochromeIcons,
            showIconsWhenCollapsed,
            showNoteCounts,
            landscapeFullscreen,
        };
    });

    // Guard to prevent saving to cloud before metadata has been initially loaded
    const hasLoadedMetadata = useRef(false);
    const prevMetadataRef = useRef<any>(undefined);

    /** --- 2. CLOUD SYNC: LOADING (Single Atomic Batch) --- **/
    useEffect(() => {
        if (metadataSettings) {
            setSettings(prev => {
                const next = { ...prev };
                let hasChange = false;

                if (metadataSettings.theme !== undefined && (metadataSettings.theme === 'clay' || metadataSettings.theme === 'sage' || metadataSettings.theme === 'dark') && metadataSettings.theme !== prev.theme) {
                    next.theme = metadataSettings.theme;
                    hasChange = true;
                }
                if (metadataSettings.autoTheme !== undefined && typeof metadataSettings.autoTheme === 'boolean' && metadataSettings.autoTheme !== prev.autoTheme) {
                    next.autoTheme = metadataSettings.autoTheme;
                    hasChange = true;
                }
                if (metadataSettings.preferredLightTheme !== undefined && (metadataSettings.preferredLightTheme === 'clay' || metadataSettings.preferredLightTheme === 'sage') && metadataSettings.preferredLightTheme !== prev.preferredLightTheme) {
                    next.preferredLightTheme = metadataSettings.preferredLightTheme;
                    hasChange = true;
                }
                if (metadataSettings.fontFamily !== undefined && (['inter', 'roboto', 'courier', 'sfmono', 'serif', 'system'].includes(metadataSettings.fontFamily)) && metadataSettings.fontFamily !== prev.fontFamily) {
                    next.fontFamily = metadataSettings.fontFamily;
                    hasChange = true;
                }
                if (metadataSettings.fontSize !== undefined && (['small', 'medium', 'large'].includes(metadataSettings.fontSize)) && metadataSettings.fontSize !== prev.fontSize) {
                    next.fontSize = metadataSettings.fontSize;
                    hasChange = true;
                }
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
                if (metadataSettings.showIconsWhenCollapsed !== undefined && metadataSettings.showIconsWhenCollapsed !== prev.showIconsWhenCollapsed) {
                    next.showIconsWhenCollapsed = metadataSettings.showIconsWhenCollapsed;
                    hasChange = true;
                }
                if (metadataSettings.showNoteCounts !== undefined && metadataSettings.showNoteCounts !== prev.showNoteCounts) {
                    next.showNoteCounts = metadataSettings.showNoteCounts;
                    hasChange = true;
                }
                if (metadataSettings.landscapeFullscreen !== undefined && metadataSettings.landscapeFullscreen !== prev.landscapeFullscreen) {
                    next.landscapeFullscreen = metadataSettings.landscapeFullscreen;
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
    useEffect(() => {
        localStorage.setItem('theme', settings.theme);
        localStorage.setItem('auto_theme', String(settings.autoTheme));
        localStorage.setItem('preferred_light_theme', settings.preferredLightTheme);
        localStorage.setItem('font-family', settings.fontFamily);
        localStorage.setItem('font-size', settings.fontSize);
        localStorage.setItem('markdown-enabled', String(settings.markdownEnabled));
        localStorage.setItem('accent-color', settings.accentColor);
        localStorage.setItem('toolbar-visible', String(settings.toolbarVisible));
        localStorage.setItem('spellcheck-enabled', String(settings.spellcheckEnabled));
        localStorage.setItem('monochrome-icons', String(settings.monochromeIcons));
        localStorage.setItem('show-icons-when-collapsed', String(settings.showIconsWhenCollapsed));
        localStorage.setItem('show-note-counts', String(settings.showNoteCounts));
        localStorage.setItem('landscape-fullscreen', String(settings.landscapeFullscreen));
    }, [settings]);

    /** --- 4. CLOUD SYNC: SAVING (USER INITIATED WRAPPERS) --- **/
    const saveCloudSettings = useCallback((overrides: Partial<AllSettings>) => {
        if (prevMetadataRef.current) {
            prevMetadataRef.current = { ...prevMetadataRef.current, ...overrides };
        }
        if (onSaveSettings && hasLoadedMetadata.current) {
            onSaveSettings({
                theme: overrides.theme ?? settings.theme,
                autoTheme: overrides.autoTheme ?? settings.autoTheme,
                preferredLightTheme: overrides.preferredLightTheme ?? settings.preferredLightTheme,
                fontFamily: overrides.fontFamily ?? settings.fontFamily,
                fontSize: overrides.fontSize ?? settings.fontSize,
                markdownEnabled: overrides.markdownEnabled ?? settings.markdownEnabled,
                accentColor: overrides.accentColor ?? settings.accentColor,
                toolbarVisible: overrides.toolbarVisible ?? settings.toolbarVisible,
                spellcheckEnabled: overrides.spellcheckEnabled ?? settings.spellcheckEnabled,
                monochromeIcons: overrides.monochromeIcons ?? settings.monochromeIcons,
                showIconsWhenCollapsed: overrides.showIconsWhenCollapsed ?? settings.showIconsWhenCollapsed,
                showNoteCounts: overrides.showNoteCounts ?? settings.showNoteCounts,
                landscapeFullscreen: overrides.landscapeFullscreen ?? settings.landscapeFullscreen,
            });
        }
    }, [settings, onSaveSettings]);

    const setThemeWrapped = useCallback((val: Theme) => {
        setSettings(prev => {
            const next = { ...prev, theme: val };
            if (val === 'clay' || val === 'sage') {
                next.preferredLightTheme = val;
            }
            return next;
        });
        saveCloudSettings(val === 'clay' || val === 'sage' ? { theme: val, preferredLightTheme: val } : { theme: val });
    }, [saveCloudSettings]);

    const setAutoThemeWrapped = useCallback((val: boolean) => {
        setSettings(prev => ({ ...prev, autoTheme: val }));
        saveCloudSettings({ autoTheme: val });
    }, [saveCloudSettings]);

    const setPreferredLightThemeWrapped = useCallback((val: LightTheme) => {
        setSettings(prev => ({ ...prev, preferredLightTheme: val }));
        saveCloudSettings({ preferredLightTheme: val });
    }, [saveCloudSettings]);

    const setFontFamilyWrapped = useCallback((val: FontFamily) => {
        setSettings(prev => ({ ...prev, fontFamily: val }));
        saveCloudSettings({ fontFamily: val });
    }, [saveCloudSettings]);

    const setFontSizeWrapped = useCallback((val: FontSize) => {
        setSettings(prev => ({ ...prev, fontSize: val }));
        saveCloudSettings({ fontSize: val });
    }, [saveCloudSettings]);

    const setMarkdownEnabledWrapped = useCallback((val: boolean) => {
        setSettings(prev => ({ ...prev, markdownEnabled: val }));
        saveCloudSettings({ markdownEnabled: val });
    }, [saveCloudSettings]);

    const setAccentColorWrapped = useCallback((val: string) => {
        setSettings(prev => ({ ...prev, accentColor: val }));
        saveCloudSettings({ accentColor: val });
    }, [saveCloudSettings]);

    const setToolbarVisibleWrapped = useCallback((val: boolean) => {
        setSettings(prev => ({ ...prev, toolbarVisible: val }));
        saveCloudSettings({ toolbarVisible: val });
    }, [saveCloudSettings]);

    const setSpellcheckEnabledWrapped = useCallback((val: boolean) => {
        setSettings(prev => ({ ...prev, spellcheckEnabled: val }));
        saveCloudSettings({ spellcheckEnabled: val });
    }, [saveCloudSettings]);

    const setMonochromeIconsWrapped = useCallback((val: boolean) => {
        setSettings(prev => ({ ...prev, monochromeIcons: val }));
        saveCloudSettings({ monochromeIcons: val });
    }, [saveCloudSettings]);

    const setShowIconsWhenCollapsedWrapped = useCallback((val: boolean) => {
        setSettings(prev => ({ ...prev, showIconsWhenCollapsed: val }));
        saveCloudSettings({ showIconsWhenCollapsed: val });
    }, [saveCloudSettings]);

    const setShowNoteCountsWrapped = useCallback((val: boolean) => {
        setSettings(prev => ({ ...prev, showNoteCounts: val }));
        saveCloudSettings({ showNoteCounts: val });
    }, [saveCloudSettings]);

    const setLandscapeFullscreenWrapped = useCallback((val: boolean) => {
        setSettings(prev => ({ ...prev, landscapeFullscreen: val }));
        saveCloudSettings({ landscapeFullscreen: val });
    }, [saveCloudSettings]);

    return {
        theme: settings.theme,
        setTheme: setThemeWrapped,
        autoTheme: settings.autoTheme,
        setAutoTheme: setAutoThemeWrapped,
        preferredLightTheme: settings.preferredLightTheme,
        setPreferredLightTheme: setPreferredLightThemeWrapped,
        fontFamily: settings.fontFamily,
        setFontFamily: setFontFamilyWrapped,
        fontSize: settings.fontSize,
        setFontSize: setFontSizeWrapped,
        markdownEnabled: settings.markdownEnabled,
        setMarkdownEnabled: setMarkdownEnabledWrapped,
        accentColor: settings.accentColor,
        setAccentColor: setAccentColorWrapped,
        toolbarVisible: settings.toolbarVisible,
        setToolbarVisible: setToolbarVisibleWrapped,
        spellcheckEnabled: settings.spellcheckEnabled,
        setSpellcheckEnabled: setSpellcheckEnabledWrapped,
        landscapeFullscreen: settings.landscapeFullscreen,
        setLandscapeFullscreen: setLandscapeFullscreenWrapped,
        monochromeIcons: settings.monochromeIcons,
        setMonochromeIcons: setMonochromeIconsWrapped,
        showIconsWhenCollapsed: settings.showIconsWhenCollapsed,
        setShowIconsWhenCollapsed: setShowIconsWhenCollapsedWrapped,
        showNoteCounts: settings.showNoteCounts,
        setShowNoteCounts: setShowNoteCountsWrapped,
    };
}


import { useEffect } from 'react';
import type { AppMetadata, Settings } from '../types';
import { useSettings } from './useSettings';
import { useTheme } from './useTheme';

interface UseAppThemeAndFontProps {
    settings?: Settings;
    saveSettings: (settings: Partial<Settings>) => Promise<void>;
}

export function useAppThemeAndFont({
    settings,
    saveSettings,
}: UseAppThemeAndFontProps) {
    const {
        theme: syncTheme,
        setTheme: setSyncTheme,
        autoTheme: syncAutoTheme,
        setAutoTheme: setSyncAutoTheme,
        preferredLightTheme: syncPrefLight,
        setPreferredLightTheme: setSyncPrefLight,
        markdownEnabled,
        setMarkdownEnabled,
        accentColor,
        setAccentColor,
        fontFamily,
        setFontFamily,
        fontSize,
        setFontSize,
        spellcheckEnabled,
        setSpellcheckEnabled,
        toolbarVisible,
        setToolbarVisible,
        landscapeFullscreen,
        setLandscapeFullscreen,
        monochromeIcons,
        setMonochromeIcons,
        showIconsWhenCollapsed,
        setShowIconsWhenCollapsed,
        showNoteCounts,
        setShowNoteCounts,
    } = useSettings(settings, saveSettings);

    const {
        theme,
        setTheme,
        autoTheme,
        setAutoTheme,
        preferredLightTheme,
    } = useTheme({
        theme: syncTheme,
        onThemeChange: setSyncTheme,
        autoTheme: syncAutoTheme,
        onAutoThemeChange: setSyncAutoTheme,
        preferredLightTheme: syncPrefLight,
        onPreferredLightThemeChange: setSyncPrefLight,
    });

    // Apply font size to <html> so all rem-based Tailwind classes scale with it
    useEffect(() => {
        const px = fontSize === 'small' ? '14px' : fontSize === 'large' ? '18px' : '16px';
        document.documentElement.style.fontSize = px;
    }, [fontSize]);

    // Apply accent color to document root for CSS variable overrides
    useEffect(() => {
        document.documentElement.setAttribute('data-accent', accentColor);
    }, [accentColor]);

    return {
        theme,
        setTheme,
        autoTheme,
        setAutoTheme,
        preferredLightTheme,
        markdownEnabled,
        setMarkdownEnabled,
        accentColor,
        setAccentColor,
        fontFamily,
        setFontFamily,
        fontSize,
        setFontSize,
        spellcheckEnabled,
        setSpellcheckEnabled,
        toolbarVisible,
        setToolbarVisible,
        landscapeFullscreen,
        setLandscapeFullscreen,
        monochromeIcons,
        setMonochromeIcons,
        showIconsWhenCollapsed,
        setShowIconsWhenCollapsed,
        showNoteCounts,
        setShowNoteCounts,
    };
}

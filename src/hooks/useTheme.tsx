import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'system';

/**
 * useTheme Hook
 * Manages the application's appearance mode (light, dark, or system).
 * Logic:
 * - Light/Dark: Applies the class directly to the document root.
 * - System: Listens to the browser's prefers-color-scheme media query.
 */
export function useTheme() {
    // Initial state from LocalStorage, defaults to 'system'
    const [theme, setTheme] = useState<Theme>(() => {
        return (localStorage.getItem('theme') as Theme) || 'system';
    });

    useEffect(() => {
        const root = window.document.documentElement;

        const removeOldTheme = () => {
            root.classList.remove('light', 'dark');
        };

        const applyTheme = (t: Theme) => {
            removeOldTheme();
            if (t === 'system') {
                // Check current system preference
                const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                root.classList.add(systemTheme);
            } else {
                root.classList.add(t);
            }
        };

        // Apply current selection and persist
        applyTheme(theme);
        localStorage.setItem('theme', theme);

        // If system mode is selected, we must listen for live OS preference changes
        if (theme === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handleChange = () => applyTheme('system');
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }
    }, [theme]);

    return { theme, setTheme };
}

import { useState, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';

export type Theme = 'dark' | 'sage' | 'clay';
export type LightTheme = 'clay' | 'sage';
export type ThemeOrigin = { x: number; y: number } | React.MouseEvent | MouseEvent;

export interface UseThemeReturn {
    theme: Theme;
    setTheme: (theme: Theme, origin?: ThemeOrigin) => void;
    autoTheme: boolean;
    setAutoTheme: (enabled: boolean) => void;
    preferredLightTheme: LightTheme;
}

/**
 * useTheme Hook
 * Manages application appearance theme ('clay', 'sage', 'dark') and automatic system switching.
 * Default on first launch is 'clay'.
 */
export function useTheme(): UseThemeReturn {
    const [autoTheme, setAutoThemeState] = useState<boolean>(() => {
        return localStorage.getItem('auto_theme') === 'true';
    });

    const [preferredLightTheme, setPreferredLightTheme] = useState<LightTheme>(() => {
        const saved = localStorage.getItem('preferred_light_theme');
        if (saved === 'sage' || saved === 'clay') return saved;
        const oldTheme = localStorage.getItem('theme');
        if (oldTheme === 'sage') return 'sage';
        return 'clay';
    });

    const [theme, setThemeState] = useState<Theme>(() => {
        const isAuto = localStorage.getItem('auto_theme') === 'true';
        const prefLight = (localStorage.getItem('preferred_light_theme') === 'sage') ? 'sage' : 'clay';
        if (isAuto && typeof window !== 'undefined') {
            const isDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
            return isDark ? 'dark' : prefLight;
        }
        const saved = localStorage.getItem('theme') as Theme;
        if (saved === 'dark' || saved === 'sage' || saved === 'clay') {
            return saved;
        }
        return 'clay';
    });

    const applyThemeToDOM = useCallback((t: Theme) => {
        if (typeof window === 'undefined') return;
        const root = window.document.documentElement;
        root.setAttribute('data-theme', t);

        if (t === 'dark') {
            root.classList.add('dark');
            root.classList.remove('light');
        } else {
            root.classList.remove('dark');
            root.classList.add('light');
        }
    }, []);

    const performThemeTransition = useCallback((nextTheme: Theme, origin?: ThemeOrigin) => {
        let coords: { x: number; y: number } | undefined;
        if (origin) {
            if ('clientX' in origin && 'clientY' in origin) {
                coords = { x: origin.clientX, y: origin.clientY };
            } else if ('x' in origin && 'y' in origin) {
                coords = { x: origin.x, y: origin.y };
            }
        }

        const isReducedMotion = typeof window !== 'undefined' &&
            window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

        if (typeof document === 'undefined' || !(document as any).startViewTransition || isReducedMotion) {
            setThemeState(nextTheme);
            applyThemeToDOM(nextTheme);
            localStorage.setItem('theme', nextTheme);
            return;
        }

        const x = coords?.x ?? window.innerWidth / 2;
        const y = coords?.y ?? window.innerHeight / 2;
        const endRadius = Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y)
        );

        const transition = (document as any).startViewTransition(() => {
            flushSync(() => {
                setThemeState(nextTheme);
                applyThemeToDOM(nextTheme);
                localStorage.setItem('theme', nextTheme);
            });
        });

        transition.ready?.then(() => {
            document.documentElement.animate(
                {
                    clipPath: [
                        `circle(0px at ${x}px ${y}px)`,
                        `circle(${endRadius}px at ${x}px ${y}px)`
                    ]
                },
                {
                    duration: 600,
                    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
                    pseudoElement: '::view-transition-new(root)'
                }
            );
        }).catch(() => {});
    }, [applyThemeToDOM]);

    // Listen to OS system color scheme changes when autoTheme is active
    useEffect(() => {
        if (!autoTheme || typeof window === 'undefined') return;

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleSystemChange = (e: MediaQueryListEvent | MediaQueryList) => {
            const next = e.matches ? 'dark' : preferredLightTheme;
            performThemeTransition(next);
        };

        mediaQuery.addEventListener('change', handleSystemChange);
        return () => mediaQuery.removeEventListener('change', handleSystemChange);
    }, [autoTheme, preferredLightTheme, performThemeTransition]);

    // Apply on initial load and sync localStorage
    useEffect(() => {
        applyThemeToDOM(theme);
        localStorage.setItem('theme', theme);
        localStorage.setItem('auto_theme', String(autoTheme));
        localStorage.setItem('preferred_light_theme', preferredLightTheme);
    }, [theme, autoTheme, preferredLightTheme, applyThemeToDOM]);

    const setTheme = (nextTheme: Theme, origin?: ThemeOrigin) => {
        if (nextTheme === 'clay' || nextTheme === 'sage') {
            setPreferredLightTheme(nextTheme);
            localStorage.setItem('preferred_light_theme', nextTheme);
        }

        if (autoTheme) {
            const isSystemDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
            if (nextTheme === 'dark') {
                performThemeTransition('dark', origin);
            } else {
                if (!isSystemDark) {
                    performThemeTransition(nextTheme, origin);
                }
            }
            return;
        }

        if (nextTheme === theme) return;
        performThemeTransition(nextTheme, origin);
    };

    const setAutoTheme = (enabled: boolean) => {
        setAutoThemeState(enabled);
        localStorage.setItem('auto_theme', String(enabled));
        if (enabled && typeof window !== 'undefined') {
            const isDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
            const target = isDark ? 'dark' : preferredLightTheme;
            performThemeTransition(target);
        }
    };

    return {
        theme,
        setTheme,
        autoTheme,
        setAutoTheme,
        preferredLightTheme
    };
}

import { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';

export type Theme = 'dark' | 'sage' | 'clay' | 'light' | 'system';

export type ThemeOrigin = { x: number; y: number } | React.MouseEvent | MouseEvent;

/**
 * useTheme Hook
 * Manages the application's appearance theme (dark, sage, clay) with circular ripple transition.
 */
export function useTheme() {
    // Initial state from LocalStorage, defaults to 'dark'
    const [theme, setThemeState] = useState<Theme>(() => {
        const saved = localStorage.getItem('theme') as Theme;
        if (saved === 'dark' || saved === 'sage' || saved === 'clay') {
            return saved;
        }
        return 'dark';
    });

    const applyThemeToDOM = (t: Theme) => {
        if (typeof window === 'undefined') return;
        const root = window.document.documentElement;
        const effective = (t === 'system' || t === 'light') ? 'sage' : t;
        root.setAttribute('data-theme', effective);

        if (effective === 'dark') {
            root.classList.add('dark');
            root.classList.remove('light');
        } else {
            root.classList.remove('dark');
            root.classList.add('light');
        }
    };

    useEffect(() => {
        applyThemeToDOM(theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const setTheme = (nextTheme: Theme, origin?: ThemeOrigin) => {
        if (nextTheme === theme) return;

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
        }).catch(() => {
            // Ignore cancelled/aborted transitions
        });
    };

    return { theme, setTheme };
}

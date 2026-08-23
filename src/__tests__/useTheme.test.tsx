import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../hooks/useTheme';

function createLocalStorageMock() {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, val: string) => { store[key] = String(val); },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
        get length() { return Object.keys(store).length; },
        key: (i: number) => Object.keys(store)[i] ?? null,
    } as Storage;
}

describe('useTheme hook', () => {
    beforeEach(() => {
        vi.stubGlobal('localStorage', createLocalStorageMock());
        document.documentElement.className = '';
        document.documentElement.removeAttribute('data-theme');
        vi.restoreAllMocks();

        window.matchMedia = vi.fn().mockImplementation((query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));
    });

    it('initializes with default clay theme when nothing in localStorage', () => {
        const { result } = renderHook(() => useTheme());
        expect(result.current.theme).toBe('clay');
        expect(result.current.preferredLightTheme).toBe('clay');
        expect(result.current.autoTheme).toBe(false);
        expect(document.documentElement.getAttribute('data-theme')).toBe('clay');
        expect(document.documentElement.classList.contains('light')).toBe(true);
    });

    it('switches theme and updates documentElement and localStorage', () => {
        const { result } = renderHook(() => useTheme());

        act(() => {
            result.current.setTheme('sage');
        });

        expect(result.current.theme).toBe('sage');
        expect(result.current.preferredLightTheme).toBe('sage');
        expect(document.documentElement.getAttribute('data-theme')).toBe('sage');
        expect(document.documentElement.classList.contains('light')).toBe(true);
        expect(localStorage.getItem('theme')).toBe('sage');
    });

    it('supports auto theme switch between dark mode and selected light theme', () => {
        let isDark = true;
        (window.matchMedia as any).mockImplementation((query: string) => ({
            matches: query.includes('prefers-color-scheme: dark') ? isDark : false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));

        const { result } = renderHook(() => useTheme());

        // First pick sage as preferred light theme
        act(() => {
            result.current.setTheme('sage');
        });
        expect(result.current.preferredLightTheme).toBe('sage');

        // Turn on auto theme (system is dark)
        act(() => {
            result.current.setAutoTheme(true);
        });

        expect(result.current.autoTheme).toBe(true);
        expect(result.current.theme).toBe('dark');
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        expect(document.documentElement.classList.contains('dark')).toBe(true);

        // System changes to light
        isDark = false;
        act(() => {
            result.current.setAutoTheme(true);
        });

        expect(result.current.theme).toBe('sage');
        expect(document.documentElement.getAttribute('data-theme')).toBe('sage');
        expect(document.documentElement.classList.contains('light')).toBe(true);
    });

    it('triggers document.startViewTransition and animation when available', () => {
        const animateMock = vi.fn();
        document.documentElement.animate = animateMock;

        const mockStartViewTransition = vi.fn().mockImplementation((cb: () => void) => {
            cb();
            return {
                ready: Promise.resolve(),
                finished: Promise.resolve(),
            };
        });
        (document as any).startViewTransition = mockStartViewTransition;

        const { result } = renderHook(() => useTheme());

        act(() => {
            result.current.setTheme('dark', { x: 100, y: 200 });
        });

        expect(mockStartViewTransition).toHaveBeenCalled();
        expect(result.current.theme).toBe('dark');
    });
});

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSettings } from '../hooks/useSettings'

// Build a fresh localStorage mock for each test
function createLocalStorageMock() {
    let store: Record<string, string> = {}
    return {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, val: string) => { store[key] = String(val) },
        removeItem: (key: string) => { delete store[key] },
        clear: () => { store = {} },
        get length() { return Object.keys(store).length },
        key: (i: number) => Object.keys(store)[i] ?? null,
    } as Storage
}

describe('useSettings', () => {
    beforeEach(() => {
        vi.stubGlobal('localStorage', createLocalStorageMock())
    })

    // -----------------------------------------------------------------------
    // Default values
    // -----------------------------------------------------------------------
    describe('default values', () => {
        it('markdownEnabled defaults to true', () => {
            const { result } = renderHook(() => useSettings())
            expect(result.current.markdownEnabled).toBe(true)
        })

        it('accentColor defaults to blue', () => {
            const { result } = renderHook(() => useSettings())
            expect(result.current.accentColor).toBe('blue')
        })

        it('fontFamily defaults to inter', () => {
            const { result } = renderHook(() => useSettings())
            expect(result.current.fontFamily).toBe('inter')
        })

        it('fontSize defaults to medium', () => {
            const { result } = renderHook(() => useSettings())
            expect(result.current.fontSize).toBe('medium')
        })

        it('toolbarVisible defaults to true', () => {
            const { result } = renderHook(() => useSettings())
            expect(result.current.toolbarVisible).toBe(true)
        })

        it('spellcheckEnabled defaults to true', () => {
            const { result } = renderHook(() => useSettings())
            expect(result.current.spellcheckEnabled).toBe(true)
        })

        it('landscapeFullscreen defaults to false', () => {
            const { result } = renderHook(() => useSettings())
            expect(result.current.landscapeFullscreen).toBe(false)
        })

        it('showNoteCounts defaults to false', () => {
            const { result } = renderHook(() => useSettings())
            expect(result.current.showNoteCounts).toBe(false)
        })
    })

    // -----------------------------------------------------------------------
    // localStorage persistence
    // -----------------------------------------------------------------------
    describe('localStorage persistence', () => {
        it('reads saved values from localStorage', () => {
            localStorage.setItem('markdown-enabled', 'false')
            localStorage.setItem('accent-color', 'red')
            localStorage.setItem('font-family', 'roboto')
            localStorage.setItem('font-size', 'large')
            localStorage.setItem('toolbar-visible', 'false')
            localStorage.setItem('spellcheck-enabled', 'false')
            localStorage.setItem('landscape-fullscreen', 'true')
            localStorage.setItem('show-note-counts', 'true')

            const { result } = renderHook(() => useSettings())
            expect(result.current.markdownEnabled).toBe(false)
            expect(result.current.accentColor).toBe('red')
            expect(result.current.fontFamily).toBe('roboto')
            expect(result.current.fontSize).toBe('large')
            expect(result.current.toolbarVisible).toBe(false)
            expect(result.current.spellcheckEnabled).toBe(false)
            expect(result.current.landscapeFullscreen).toBe(true)
            expect(result.current.showNoteCounts).toBe(true)
        })

        it('persists changes back to localStorage', () => {
            const { result } = renderHook(() => useSettings())

            act(() => {
                result.current.setAccentColor('green')
            })
            expect(localStorage.getItem('accent-color')).toBe('green')

            act(() => {
                result.current.setFontSize('small')
            })
            expect(localStorage.getItem('font-size')).toBe('small')

            act(() => {
                result.current.setShowNoteCounts(true)
            })
            expect(localStorage.getItem('show-note-counts')).toBe('true')
        })

        it('ignores invalid fontFamily values and defaults to inter', () => {
            localStorage.setItem('font-family', 'comic-sans')
            const { result } = renderHook(() => useSettings())
            expect(result.current.fontFamily).toBe('inter')
        })

        it('ignores invalid fontSize values and defaults to medium', () => {
            localStorage.setItem('font-size', 'huge')
            const { result } = renderHook(() => useSettings())
            expect(result.current.fontSize).toBe('medium')
        })
    })

    // -----------------------------------------------------------------------
    // Cloud sync loading
    // -----------------------------------------------------------------------
    describe('cloud sync loading', () => {
        it('applies all cloud metadata settings when provided', () => {
            const metadataSettings = {
                theme: 'sage',
                autoTheme: true,
                preferredLightTheme: 'sage',
                fontFamily: 'roboto',
                fontSize: 'large',
                markdownEnabled: false,
                accentColor: 'purple',
                toolbarVisible: false,
                spellcheckEnabled: false,
                monochromeIcons: true,
                showIconsWhenCollapsed: true,
                showNoteCounts: true,
                landscapeFullscreen: true,
            }
            const { result } = renderHook(() => useSettings(metadataSettings))

            expect(result.current.theme).toBe('sage')
            expect(result.current.autoTheme).toBe(true)
            expect(result.current.preferredLightTheme).toBe('sage')
            expect(result.current.fontFamily).toBe('roboto')
            expect(result.current.fontSize).toBe('large')
            expect(result.current.markdownEnabled).toBe(false)
            expect(result.current.accentColor).toBe('purple')
            expect(result.current.toolbarVisible).toBe(false)
            expect(result.current.spellcheckEnabled).toBe(false)
            expect(result.current.monochromeIcons).toBe(true)
            expect(result.current.showIconsWhenCollapsed).toBe(true)
            expect(result.current.showNoteCounts).toBe(true)
            expect(result.current.landscapeFullscreen).toBe(true)
        })

        it('does not call onSaveSettings before metadata is loaded', () => {
            const onSave = vi.fn()
            renderHook(() => useSettings(undefined, onSave))

            // The initial render persists to localStorage but should NOT
            // trigger cloud save because hasLoadedMetadata is false.
            expect(onSave).not.toHaveBeenCalled()
        })

        it('calls onSaveSettings after metadata is loaded and settings change', () => {
            const onSave = vi.fn()
            const metadataSettings = { markdownEnabled: true, accentColor: 'blue' }
            const { result } = renderHook(() => useSettings(metadataSettings, onSave))

            // After metadata is loaded, changing a setting should trigger cloud save
            act(() => {
                result.current.setAccentColor('red')
            })

            expect(onSave).toHaveBeenCalled()
            const lastCall = onSave.mock.calls[onSave.mock.calls.length - 1][0]
            expect(lastCall.accentColor).toBe('red')
        })

        it('syncs all setting categories to cloud', () => {
            const onSave = vi.fn()
            const metadataSettings = { markdownEnabled: true }
            const { result } = renderHook(() => useSettings(metadataSettings, onSave))

            act(() => {
                result.current.setFontFamily('courier')
            })

            const lastCall = onSave.mock.calls[onSave.mock.calls.length - 1][0]
            expect(lastCall).toHaveProperty('fontFamily', 'courier')
            expect(lastCall).toHaveProperty('fontSize')
            expect(lastCall).toHaveProperty('theme')
            expect(lastCall).toHaveProperty('markdownEnabled')
            expect(lastCall).toHaveProperty('accentColor')
            expect(lastCall).toHaveProperty('toolbarVisible')
            expect(lastCall).toHaveProperty('spellcheckEnabled')
            expect(lastCall).toHaveProperty('landscapeFullscreen')
        })

        it('does NOT revert local changes when re-rendered with stale metadataSettings before save completes', () => {
            const onSave = vi.fn()
            const metadataSettings = { toolbarVisible: false }
            const { result, rerender } = renderHook(
                (props: { meta?: any }) => useSettings(props.meta, onSave),
                { initialProps: { meta: metadataSettings } }
            )

            expect(result.current.toolbarVisible).toBe(false)

            act(() => {
                result.current.setToolbarVisible(true)
            })

            // Local state should immediately become true
            expect(result.current.toolbarVisible).toBe(true)

            // Re-render with the SAME metadataSettings object before async save updates metadata
            rerender({ meta: metadataSettings })

            // Local state MUST STILL BE TRUE, not reverted to false!
            expect(result.current.toolbarVisible).toBe(true)
        })
    })
})

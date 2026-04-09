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

            const { result } = renderHook(() => useSettings())
            expect(result.current.markdownEnabled).toBe(false)
            expect(result.current.accentColor).toBe('red')
            expect(result.current.fontFamily).toBe('roboto')
            expect(result.current.fontSize).toBe('large')
            expect(result.current.toolbarVisible).toBe(false)
            expect(result.current.spellcheckEnabled).toBe(false)
            expect(result.current.landscapeFullscreen).toBe(true)
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
        it('applies cloud metadata settings when provided', () => {
            const metadataSettings = {
                markdownEnabled: false,
                accentColor: 'purple',
                toolbarVisible: false,
                spellcheckEnabled: false,
            }
            const { result } = renderHook(() => useSettings(metadataSettings))

            expect(result.current.markdownEnabled).toBe(false)
            expect(result.current.accentColor).toBe('purple')
            expect(result.current.toolbarVisible).toBe(false)
            expect(result.current.spellcheckEnabled).toBe(false)
        })

        it('does NOT override device-specific settings from cloud', () => {
            localStorage.setItem('font-family', 'roboto')
            localStorage.setItem('font-size', 'large')

            const metadataSettings = {
                markdownEnabled: true,
            }
            const { result } = renderHook(() => useSettings(metadataSettings))

            // Device-specific settings stay at their localStorage values
            expect(result.current.fontFamily).toBe('roboto')
            expect(result.current.fontSize).toBe('large')
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

        it('only syncs syncable settings, not device-specific ones', () => {
            const onSave = vi.fn()
            const metadataSettings = { markdownEnabled: true }
            const { result } = renderHook(() => useSettings(metadataSettings, onSave))

            act(() => {
                result.current.setMarkdownEnabled(false)
            })

            const lastCall = onSave.mock.calls[onSave.mock.calls.length - 1][0]
            // Cloud payload should NOT contain fontFamily or fontSize
            expect(lastCall).not.toHaveProperty('fontFamily')
            expect(lastCall).not.toHaveProperty('fontSize')
            expect(lastCall).not.toHaveProperty('landscapeFullscreen')
            // But should contain syncable settings
            expect(lastCall).toHaveProperty('markdownEnabled')
            expect(lastCall).toHaveProperty('accentColor')
            expect(lastCall).toHaveProperty('toolbarVisible')
            expect(lastCall).toHaveProperty('spellcheckEnabled')
        })
    })
})

/**
 * Vitest global setup.
 * Provides stubs for Tauri APIs so hooks and utilities can be tested
 * without a running Tauri backend.
 */

// Stub window.tauriAPI so imports that reference it at module level don't crash.
if (typeof window !== 'undefined' && !(window as any).tauriAPI) {
    (window as any).tauriAPI = {};
}

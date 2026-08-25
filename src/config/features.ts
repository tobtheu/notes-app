/**
 * Global application feature flags evaluated at build time via Vite environment variables.
 */
export const FEATURES = {
    /**
     * Controls whether cloud synchronization (Supabase Auth & Database + ElectricSQL)
     * is enabled in the active build. Defaults to false (offline-first).
     */
    SYNC: import.meta.env.VITE_ENABLE_SYNC === 'true',
} as const;

# Dual Release Strategy (Offline-First & Sync Beta) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement build-time feature flag isolation to produce a 100% offline-first public release (with disabled "coming soon" sync UI and zero backend credentials) and a private beta release (with cloud sync and VPS update channel) from a single unified codebase.

**Architecture:** A centralized `FEATURES.SYNC` configuration flag evaluated at build time dynamically conditions UI components, auth hooks, and backend initializers. Tauri configurations are partitioned into stable and beta overlays (`tauri.conf.json` and `tauri.beta.conf.json`), and CI workflows are split into public GitHub releases and private beta pipelines.

**Tech Stack:** React 19, TypeScript, Vite, Tauri v2, Vitest, Testing Library, GitHub Actions.

## Global Constraints

- Never hardcode backend URLs (`api.lamanotes.de`, `sync.lamanotes.de`) or pre-shared keys in source files.
- `FEATURES.SYNC` must default to `false` when `VITE_ENABLE_SYNC` is not set or not equal to `'true'`.
- The offline release must show the "Sign In / Register" option as disabled with a "Cloud Sync – Coming Soon" badge/subtitle on the onboarding screen.
- The offline release must hide the "Cloud Sync" tab in the Settings modal.
- Public stable builds must have identifier `com.tobtheu.notizapp` ("Lama Notes").
- Private beta builds must have identifier `com.tobtheu.notizapp.beta` ("Lama Notes Beta").

---

### Task 1: Central Feature Module & Supabase Client Hardening

**Files:**
- Create: `src/config/features.ts`
- Modify: `src/lib/supabaseClient.ts`
- Test: `src/__tests__/features.test.ts`

**Interfaces:**
- Consumes: `import.meta.env.VITE_ENABLE_SYNC`, `import.meta.env.VITE_SUPABASE_URL`, `import.meta.env.VITE_SUPABASE_ANON_KEY`, `import.meta.env.VITE_LAMA_SECRET`
- Produces: `export const FEATURES: { SYNC: boolean }` and `export const supabase: SupabaseClient | null`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/features.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { FEATURES } from '../config/features';

describe('Feature Configuration', () => {
    it('defaults SYNC to false when VITE_ENABLE_SYNC is not set to true', () => {
        expect(FEATURES.SYNC).toBe(false);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/__tests__/features.test.ts`  
Expected: FAIL with "Cannot find module '../config/features'"

- [ ] **Step 3: Implement feature flag and harden supabase client**

Create `src/config/features.ts`:
```typescript
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
```

Modify `src/lib/supabaseClient.ts`:
```typescript
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { FEATURES } from '../config/features';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || '';
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';
const LAMA_SECRET = (import.meta.env.VITE_LAMA_SECRET as string) || '';

/**
 * Supabase JS client — initialized only when Cloud Sync is active and valid URL is configured.
 * For offline builds, provides a safe dummy/fallback client to prevent initialization errors.
 */
export const supabase: SupabaseClient = (FEATURES.SYNC && SUPABASE_URL && SUPABASE_ANON_KEY)
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
        global: {
            headers: LAMA_SECRET ? { 'X-Lama-Secret': LAMA_SECRET } : {},
        },
    })
    : createClient('https://placeholder.supabase.co', 'placeholder-anon-key', {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });

/**
 * Inject an active session into the Supabase JS client so it can
 * make authenticated writes. Call this after sign-in or app start.
 */
export async function setSupabaseSession(accessToken: string, refreshToken: string): Promise<void> {
    if (!FEATURES.SYNC || !SUPABASE_URL) return;
    try {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    } catch (e) {
        console.warn('[supabaseClient] setSession failed:', e);
    }
}

/**
 * Clear the active session (on sign-out).
 */
export async function clearSupabaseSession(): Promise<void> {
    if (!FEATURES.SYNC || !SUPABASE_URL) return;
    try {
        await supabase.auth.signOut();
    } catch (e) {
        console.warn('[supabaseClient] signOut failed:', e);
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/__tests__/features.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/config/features.ts src/lib/supabaseClient.ts src/__tests__/features.test.ts
git commit -m "feat(config): add central FEATURES.SYNC flag and remove hardcoded supabase credentials"
```

---

### Task 2: Onboarding Screen Conditioning (Disabled Cloud Sync with "Coming Soon")

**Files:**
- Modify: `src/components/OnboardingStorageCard.tsx`
- Test: `src/__tests__/onboardingFeatures.test.tsx`

**Interfaces:**
- Consumes: `FEATURES.SYNC` from `src/config/features.ts`
- Produces: UI with disabled Cloud Sync option + "Coming Soon" badge when offline, enabled when sync is active.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/onboardingFeatures.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OnboardingStorageCard } from '../components/OnboardingStorageCard';

describe('OnboardingStorageCard with FEATURES.SYNC disabled', () => {
    it('renders Cloud Sync as disabled with Coming Soon label', () => {
        const onOpenEmailAuth = vi.fn();
        const onLocalOnly = vi.fn().mockResolvedValue(undefined);

        render(
            <OnboardingStorageCard
                onOpenEmailAuth={onOpenEmailAuth}
                onLocalOnly={onLocalOnly}
            />
        );

        const cloudAuthBtn = screen.getByTestId('onboarding-cloud-auth-btn');
        expect(cloudAuthBtn).toBeDefined();
        expect(cloudAuthBtn.getAttribute('disabled')).toBeDefined();
        expect(screen.getByText(/Coming Soon/i)).toBeDefined();

        cloudAuthBtn.click();
        expect(onOpenEmailAuth).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/__tests__/onboardingFeatures.test.tsx`  
Expected: FAIL with "Unable to find an element by: [data-testid="onboarding-cloud-auth-btn"]"

- [ ] **Step 3: Update `OnboardingStorageCard.tsx`**

Modify `src/components/OnboardingStorageCard.tsx`:
```tsx
import { Cloud, FolderOpen, ChevronRight } from 'lucide-react';
import { FEATURES } from '../config/features';
import clsx from 'clsx';

interface OnboardingStorageCardProps {
    onOpenEmailAuth: (mode: 'signin' | 'signup') => void;
    onLocalOnly: () => Promise<void>;
    isLoading?: boolean;
}

export function OnboardingStorageCard({
    onOpenEmailAuth,
    onLocalOnly,
    isLoading = false,
}: OnboardingStorageCardProps) {
    const isSyncEnabled = FEATURES.SYNC;

    return (
        <div className="w-full animate-note-fade">
            <h1 className="text-2xl sm:text-3xl font-extrabold mb-1.5 tracking-tight text-[var(--text-main)]">
                Welcome to Lama
            </h1>
            <p className="mb-6 text-[var(--text-muted)] text-sm leading-relaxed">
                Your thoughts, beautifully formatted and stored securely.
            </p>

            <div className="grid gap-3 w-full">
                {/* Supabase email auth (Enabled if FEATURES.SYNC, otherwise Disabled "Coming Soon") */}
                <button
                    type="button"
                    data-testid="onboarding-cloud-auth-btn"
                    onClick={() => {
                        if (isSyncEnabled) onOpenEmailAuth('signin');
                    }}
                    disabled={!isSyncEnabled || isLoading}
                    className={clsx(
                        "smooth-transition group w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border text-left shadow-sm",
                        isSyncEnabled
                            ? "bg-[var(--card-hover)]/70 hover:bg-[var(--card-hover)] border-[var(--border-subtle)]/60 hover:border-[var(--accent-color)]/60 active:scale-[0.98] cursor-pointer"
                            : "bg-[var(--card-hover)]/40 border-[var(--border-subtle)]/40 opacity-60 cursor-not-allowed select-none"
                    )}
                >
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-[var(--canvas-bg)] flex items-center justify-center text-[var(--accent-color)] border border-[var(--border-subtle)]/60 shadow-sm shrink-0">
                            <Cloud size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs sm:text-sm text-[var(--text-main)]">Sign In / Register</span>
                                {!isSyncEnabled && (
                                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-[var(--accent-color)]/15 text-[var(--accent-color)] border border-[var(--accent-color)]/30">
                                        Coming Soon
                                    </span>
                                )}
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                                {isSyncEnabled ? 'Sync across all your devices' : 'Cloud synchronization in development'}
                            </div>
                        </div>
                    </div>
                    {isSyncEnabled ? (
                        <ChevronRight size={16} className="text-[var(--text-muted)] group-hover:text-[var(--text-main)] group-hover:translate-x-0.5 transition-all shrink-0" />
                    ) : null}
                </button>

                {/* Offline / Local-only Option */}
                <button
                    type="button"
                    data-testid="onboarding-local-btn"
                    onClick={onLocalOnly}
                    disabled={isLoading}
                    className={clsx(
                        "smooth-transition group w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border text-left shadow-sm active:scale-[0.98] disabled:opacity-50",
                        !isSyncEnabled
                            ? "bg-[var(--card-hover)] border-[var(--accent-color)]/50 ring-1 ring-[var(--accent-color)]/30 hover:border-[var(--accent-color)]"
                            : "bg-[var(--card-hover)]/70 hover:bg-[var(--card-hover)] border-[var(--border-subtle)]/60 hover:border-[var(--accent-color)]/60"
                    )}
                >
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-[var(--canvas-bg)] flex items-center justify-center text-[var(--text-muted)] border border-[var(--border-subtle)]/60 shadow-sm shrink-0">
                            <FolderOpen size={18} />
                        </div>
                        <div>
                            <div className="font-semibold text-xs sm:text-sm text-[var(--text-main)]">Use locally only</div>
                            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">Save notes offline on this device</div>
                        </div>
                    </div>
                    <ChevronRight size={16} className="text-[var(--text-muted)] group-hover:text-[var(--text-main)] group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/__tests__/onboardingFeatures.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/OnboardingStorageCard.tsx src/__tests__/onboardingFeatures.test.tsx
git commit -m "feat(ui): condition onboarding options and mark cloud sync as coming soon when sync is disabled"
```

---

### Task 3: Settings Modal Navigation Conditioning

**Files:**
- Modify: `src/components/SettingsNav.tsx`
- Modify: `src/components/SettingsModal.tsx`
- Test: `src/__tests__/settingsFeatures.test.tsx`

**Interfaces:**
- Consumes: `FEATURES.SYNC` from `src/config/features.ts`
- Produces: `SettingsNav` which omits the 'sync' tab when `FEATURES.SYNC === false`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/settingsFeatures.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsNav } from '../components/SettingsNav';

describe('SettingsNav with FEATURES.SYNC disabled', () => {
    it('does not render the Cloud Sync navigation item', () => {
        render(
            <SettingsNav
                activeTab="appearance"
                onSelectTab={vi.fn()}
            />
        );

        expect(screen.queryByText('Cloud Sync')).toBeNull();
        expect(screen.getByText('Appearance')).toBeDefined();
        expect(screen.getByText('Editor')).toBeDefined();
        expect(screen.getByText('Backup & Data')).toBeDefined();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/__tests__/settingsFeatures.test.tsx`  
Expected: FAIL with "expected 'Cloud Sync' to be null"

- [ ] **Step 3: Update `SettingsNav.tsx` and `SettingsModal.tsx`**

Modify `src/components/SettingsNav.tsx`:
```tsx
import React from 'react';
import { Palette, Edit3, Cloud, HardDrive, Info, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { FEATURES } from '../config/features';

export type TabKey = 'appearance' | 'editor' | 'sync' | 'storage' | 'trash' | 'about';

interface SettingsNavProps {
    activeTab: TabKey;
    onSelectTab: (tab: TabKey) => void;
}

const ALL_NAV_ITEMS: Array<{ key: TabKey; label: string; icon: React.FC<{ size?: number }>; requireSync?: boolean }> = [
    { key: 'appearance', label: 'Appearance', icon: Palette },
    { key: 'editor', label: 'Editor', icon: Edit3 },
    { key: 'sync', label: 'Cloud Sync', icon: Cloud, requireSync: true },
    { key: 'storage', label: 'Backup & Data', icon: HardDrive },
    { key: 'trash', label: 'Papierkorb', icon: Trash2 },
    { key: 'about', label: 'About', icon: Info },
];

export const SettingsNav: React.FC<SettingsNavProps> = ({
    activeTab,
    onSelectTab,
}) => {
    const navItems = ALL_NAV_ITEMS.filter(item => !item.requireSync || FEATURES.SYNC);

    return (
        <aside className="w-40 sm:w-44 bg-[var(--shell-bg)] border-r border-[var(--border-subtle)] p-3 flex flex-col justify-between select-none shrink-0 overflow-x-hidden">
            <div className="space-y-4">
                <div className="px-2 pt-1">
                    <h3 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">Settings</h3>
                </div>
                <nav className="space-y-1 text-xs font-medium">
                    {navItems.map(({ key, label, icon: Icon }) => {
                        const isActive = activeTab === key;
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => onSelectTab(key)}
                                className={clsx(
                                    "smooth-transition w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-left",
                                    isActive
                                        ? "bg-[var(--canvas-bg)] text-[var(--accent-color)] font-semibold shadow-sm border border-[var(--border-subtle)]"
                                        : "text-[var(--text-muted)] hover:bg-[var(--card-hover)] hover:text-[var(--text-main)]"
                                )}
                            >
                                <Icon size={16} />
                                <span>{label}</span>
                            </button>
                        );
                    })}
                </nav>
            </div>
        </aside>
    );
};
```

In `src/components/SettingsModal.tsx`, ensure `activeTab` falls back to `'appearance'` if `activeTab === 'sync'` and `!FEATURES.SYNC`:
```tsx
// Inside SettingsModal component:
const effectiveActiveTab = (!FEATURES.SYNC && activeTab === 'sync') ? 'appearance' : activeTab;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/__tests__/settingsFeatures.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/SettingsNav.tsx src/components/SettingsModal.tsx src/__tests__/settingsFeatures.test.tsx
git commit -m "feat(settings): hide Cloud Sync tab when FEATURES.SYNC is disabled"
```

---

### Task 4: App Initialization Conditioning (`useNotesInit.ts`)

**Files:**
- Modify: `src/hooks/useNotesInit.ts`
- Test: `src/__tests__/useNotesInitFeatures.test.ts`

**Interfaces:**
- Consumes: `FEATURES.SYNC` from `src/config/features.ts`
- Produces: `useNotesInit` startup hook that skips remote auth check and sync loops when offline.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/useNotesInitFeatures.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNotesInit } from '../hooks/useNotesInit';

describe('useNotesInit in offline mode', () => {
    it('sets userId to local and status to offline without invoking remote auth', async () => {
        const setUserId = vi.fn();
        const setUserEmail = vi.fn();
        const setSyncStatus = vi.fn();
        const setSyncError = vi.fn();
        const dbRef = { current: null };

        renderHook(() => useNotesInit({
            dbRef,
            userId: null,
            setUserId,
            setUserEmail,
            setSyncStatus,
            setSyncError,
        }));

        await vi.waitFor(() => {
            expect(setUserId).toHaveBeenCalledWith('local');
            expect(setSyncStatus).toHaveBeenCalledWith('offline');
        });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/__tests__/useNotesInitFeatures.test.ts`  
Expected: FAIL or timeout waiting for remote store call

- [ ] **Step 3: Modify `useNotesInit.ts` to check `FEATURES.SYNC`**

Modify `src/hooks/useNotesInit.ts`:
```typescript
import { useEffect } from 'react';
import type { SyncStatus } from '../types';
import { getDb, startElectricSync } from '../lib/electric';
import { setSupabaseSession, supabase } from '../lib/supabaseClient';
import { flushQueue } from '../lib/offlineQueue';
import { pullFromSupabase } from '../lib/syncSupabase';
import { log } from '../lib/logger';
import { FEATURES } from '../config/features';
import type { PGliteWithLive } from '@electric-sql/pglite/live';

interface UseNotesInitProps {
    dbRef: React.MutableRefObject<PGliteWithLive | null>;
    userId: string | null;
    setUserId: (id: string | null) => void;
    setUserEmail: (email: string | null) => void;
    setSyncStatus: React.Dispatch<React.SetStateAction<SyncStatus>>;
    setSyncError: (error: string | null) => void;
}

export function useNotesInit({
    dbRef,
    userId,
    setUserId,
    setUserEmail,
    setSyncStatus,
    setSyncError,
}: UseNotesInitProps) {
    // ── Initialise PGlite + restore session ──────────────────────────────────
    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                log.info('[useNotes:init] start — FEATURES.SYNC:', FEATURES.SYNC);

                const db = await getDb();
                log.info('[useNotes:init] PGlite ready');
                if (cancelled) return;
                dbRef.current = db;

                // If Sync is compiled out or explicitly in local mode, operate pure offline
                if (!FEATURES.SYNC || localStorage.getItem('lama-mode') === 'local') {
                    log.info('[useNotes:init] operating in local-only offline mode');
                    setUserId('local');
                    setSyncStatus('offline');
                    return;
                }

                log.info('[useNotes:init] reading Tauri secure store...');
                const stored = await window.tauriAPI?.getSupabaseCredentials().catch((e: unknown) => {
                    log.warn('[useNotes:init] getSupabaseCredentials failed:', e);
                    return null;
                });

                if (!stored) {
                    log.info('[useNotes:init] no stored credentials → unauthenticated');
                    localStorage.removeItem('lama-user-id');
                    localStorage.removeItem('lama-user-email');
                    setSyncStatus('unauthenticated');
                    return;
                }

                log.info('[useNotes:init] credentials found, userId:', stored.userId, 'email:', stored.email);

                await setSupabaseSession(stored.accessToken, stored.refreshToken);
                log.info('[useNotes:init] Supabase session set');

                let tokenValid = true;
                let freshAccessToken = stored.accessToken;
                let freshRefreshToken = stored.refreshToken;

                try {
                    const { data } = await supabase.auth.getSession();
                    const expiresAt = data.session?.expires_at;
                    const secondsLeft = expiresAt ? expiresAt - Math.floor(Date.now() / 1000) : 0;

                    if (secondsLeft < 300) {
                        log.info('[useNotes:init] Token expired or expiring soon, refreshing...');
                        const refreshed = await window.tauriAPI?.refreshSupabaseToken().catch(() => null);
                        if (refreshed) {
                            freshAccessToken = refreshed.accessToken;
                            freshRefreshToken = refreshed.refreshToken;
                            await setSupabaseSession(freshAccessToken, freshRefreshToken);
                            log.info('[useNotes:init] Token refreshed successfully');
                        } else {
                            log.error('[useNotes:init] Token refresh failed on startup - session is dead.');
                            tokenValid = false;
                        }
                    }
                } catch (e) {
                    log.warn('[useNotes:init] Error checking/refreshing token:', e);
                }

                if (!tokenValid) {
                    setUserId(stored.userId);
                    setUserEmail(stored.email);
                    localStorage.setItem('lama-user-id', stored.userId);
                    localStorage.setItem('lama-user-email', stored.email);
                    setSyncStatus('error');
                    setSyncError('session_expired');
                    return;
                }

                setUserId(stored.userId);
                setUserEmail(stored.email);
                localStorage.setItem('lama-user-id', stored.userId);
                localStorage.setItem('lama-user-email', stored.email);

                if (!navigator.onLine) {
                    log.info('[useNotes:init] offline → skipping Electric sync');
                    setSyncStatus('offline');
                } else {
                    log.info('[useNotes:init] online → starting Electric sync');
                    setSyncStatus('synced');
                }
                if (navigator.onLine && stored.userId) {
                    log.info('[useNotes:init] pulling remote notes from Supabase...');
                    await pullFromSupabase(db, stored.userId);
                }

                await startElectricSync(stored.userId, stored.accessToken, (err) => {
                    log.error('[useNotes] Electric sync error:', String(err));
                    if (!cancelled) { setSyncStatus('error'); setSyncError(String(err)); }
                });
                log.info('[useNotes:init] Electric sync started');

                if (navigator.onLine) {
                    log.info('[useNotes:init] flushing offline queue...');
                    await flushQueue(db);
                    log.info('[useNotes:init] queue flushed');
                }
            } catch (err) {
                log.error('[useNotes:init] ERROR:', err);
                if (!cancelled) {
                    setSyncError(String(err));
                    setSyncStatus('error');
                }
            }
        })();

        return () => { cancelled = true; };
    }, []);

    // ── Network reconnect → flush queue ──────────────────────────────────────
    useEffect(() => {
        if (!FEATURES.SYNC) return;

        const handleOnline = async () => {
            if (!dbRef.current || !userId || userId === 'local') return;
            setSyncStatus('synced');
            await pullFromSupabase(dbRef.current, userId);
            await flushQueue(dbRef.current);
        };
        const handleOffline = () => setSyncStatus('offline');

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [userId]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/__tests__/useNotesInitFeatures.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useNotesInit.ts src/__tests__/useNotesInitFeatures.test.ts
git commit -m "feat(init): skip remote token check and electric sync when FEATURES.SYNC is disabled"
```

---

### Task 5: Tauri Beta Configuration Overlay & Build Scripts

**Files:**
- Create: `src-tauri/tauri.beta.conf.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: Tauri CLI `--config` overlay mechanism
- Produces: Distinct beta build targets allowing parallel installation with custom VPS updater channel.

- [ ] **Step 1: Create `src-tauri/tauri.beta.conf.json`**

Create `src-tauri/tauri.beta.conf.json`:
```json
{
  "productName": "Lama Notes Beta",
  "identifier": "com.tobtheu.notizapp.beta",
  "build": {
    "beforeBuildCommand": "cross-env VITE_ENABLE_SYNC=true npm run build"
  },
  "plugins": {
    "updater": {
      "endpoints": [
        "https://api.lamanotes.de/updates/beta.json"
      ]
    }
  }
}
```

- [ ] **Step 2: Add build scripts to `package.json`**

Update `scripts` in `package.json`:
```json
"scripts": {
  "dev": "vite --host",
  "dev:sync": "cross-env VITE_ENABLE_SYNC=true vite --host",
  "build": "tsc -b && vite build",
  "build:sync": "tsc -b && cross-env VITE_ENABLE_SYNC=true vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:ui": "vitest --ui",
  "tauri": "tauri",
  "tauri:build": "tauri build",
  "tauri:build:beta": "cross-env VITE_ENABLE_SYNC=true tauri build --config src-tauri/tauri.beta.conf.json"
}
```

- [ ] **Step 3: Verify build scripts syntax and compilation**

Run: `npm run build`  
Expected: Build passes with exit code 0 (`dist/` created).

- [ ] **Step 4: Commit**

```bash
git add src-tauri/tauri.beta.conf.json package.json
git commit -m "build(tauri): add beta configuration overlay and sync build scripts"
```

---

### Task 6: GitHub Actions Workflows for Offline Release & Beta Pipeline

**Files:**
- Modify: `.github/workflows/release.yml` (renamed / adapted to `release-offline.yml`)
- Create: `.github/workflows/build-sync-beta.yml`

**Interfaces:**
- Consumes: GitHub Actions secrets and workflow dispatch triggers
- Produces: Automated offline releases on GitHub Releases and private signed beta binaries for VPS distribution.

- [ ] **Step 1: Update public offline release workflow**

Modify `.github/workflows/release-offline.yml` (remove all hardcoded supabase secrets from the public workflow):
```yaml
name: "Release Offline (Public)"
on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+'

jobs:
  publish:
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: "macos-latest" # for Apple Silicon
            args: "--target aarch64-apple-darwin"
          - platform: "macos-latest" # for Intel
            args: "--target x86_64-apple-darwin"
          - platform: "ubuntu-22.04" # for Linux
            args: ""
          - platform: "windows-latest" # for Windows
            args: ""

    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - name: setup node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: install Rust stable
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}

      - name: install dependencies (ubuntu only)
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev

      - name: install frontend dependencies
        run: npm install

      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: v__VERSION__
          releaseName: "Lama Notes v__VERSION__"
          releaseBody: "Offline-first release of Lama Notes."
          releaseDraft: false
          prerelease: false
          includeUpdaterJson: true
          args: ${{ matrix.args }}
```

- [ ] **Step 2: Create private beta build workflow**

Create `.github/workflows/build-sync-beta.yml`:
```yaml
name: "Build Sync Beta (Private)"
on:
  workflow_dispatch:
    inputs:
      beta_tag:
        description: 'Beta Tag / Version (e.g. v0.9.0-beta.1)'
        required: true
        default: 'v0.9.0-beta.1'

jobs:
  build-beta:
    permissions:
      contents: read
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: "macos-latest"
            args: "--config src-tauri/tauri.beta.conf.json --target aarch64-apple-darwin"
            artifact_name: "lama-notes-beta-macos-arm64"
          - platform: "windows-latest"
            args: "--config src-tauri/tauri.beta.conf.json"
            artifact_name: "lama-notes-beta-windows"

    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - name: setup node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: install Rust stable
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin' || '' }}

      - name: install frontend dependencies
        run: npm install

      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
          VITE_ENABLE_SYNC: "true"
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          VITE_ELECTRIC_URL: ${{ secrets.VITE_ELECTRIC_URL }}
          VITE_LAMA_SECRET: ${{ secrets.VITE_LAMA_SECRET }}
        with:
          tagName: ${{ github.event.inputs.beta_tag }}
          releaseDraft: true
          prerelease: true
          includeUpdaterJson: true
          args: ${{ matrix.args }}

      - name: Upload Beta Build Artifact
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.artifact_name }}
          path: |
            src-tauri/target/**/bundle/**/*.dmg
            src-tauri/target/**/bundle/**/*.msi
            src-tauri/target/**/bundle/**/*.exe
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/
git commit -m "ci: configure separate public offline release and private sync beta build workflows"
```

---

### Task 7: Full Test Suite & Build Verification

- [ ] **Step 1: Run all unit and integration tests**

Run: `npm test`  
Expected: All tests pass.

- [ ] **Step 2: Verify production build without sync**

Run: `npm run build`  
Expected: `dist/` builds with zero errors.

- [ ] **Step 3: Verify production build with sync**

Run: `npm run build:sync`  
Expected: `dist/` builds with zero errors.

- [ ] **Step 4: Commit and finalize**

```bash
git commit --allow-empty -m "chore: verify test suite and dual build targets"
```

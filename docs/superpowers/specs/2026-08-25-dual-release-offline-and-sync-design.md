# Dual Release Strategy: Offline-First Public & Private Sync Beta

**Date:** 2026-08-25  
**Status:** Approved  
**Author:** Tobias Theunissen & Antigravity  

---

## 1. Overview & Goals

The goal is to maintain **a single unified codebase** for the Lama Notes application that simultaneously supports two distinct deployment targets without code duplication or branch maintenance overhead:

1. **Public Stable Release (Offline-First):**
   - 100% offline note-taking application.
   - Completely free of hardcoded server URLs, API keys, or backend references.
   - Onboarding displays "Cloud Sync" as disabled with a clear "Coming Soon" indicator, leading users directly into local storage.
   - Settings modal hides the Cloud Sync configuration tab.
   - Receives automatic updates via public GitHub Releases (`latest.json`).

2. **Private Beta Release (Cloud Sync Enabled):**
   - Full end-to-end sync enabled (Supabase Auth + Database + ElectricSQL).
   - Dedicated App Identifier (`com.tobtheu.notizapp.beta`) and Product Name (`Lama Notes Beta`), allowing testers and developers to install both the stable and beta versions side-by-side on the same machine.
   - Receives seamless in-app updates via a private VPS-hosted update channel (`https://api.lamanotes.de/updates/beta.json`).

3. **Cross-Platform Architecture (Desktop & Mobile):**
   - Same shared React/TypeScript frontend for Desktop (macOS ARM/Intel, Windows, Linux) and Mobile (iOS, Android).
   - Platform-specific capabilities (window management vs. touch gestures, safe area insets, mobile editor toolbar) are toggled dynamically based on the execution target.

---

## 2. Feature-Flag Architecture & Code Isolation

### 2.1 Central Feature Module (`src/config/features.ts`)
A lightweight, build-time evaluated feature config:

```typescript
export const FEATURES = {
  /**
   * Whether Cloud Sync (Supabase + ElectricSQL) is compiled into the active build.
   * True only when explicitly built with VITE_ENABLE_SYNC=true.
   */
  SYNC: import.meta.env.VITE_ENABLE_SYNC === 'true',
} as const;
```

### 2.2 Security & Credential Hardening (`src/lib/supabaseClient.ts`)
- **Remove all hardcoded fallback URLs and tokens** from source files.
- If `!FEATURES.SYNC` or if environment variables are not provided at build time:
  - Supabase client initialization will be disabled or point to empty dummy values.
  - The compiled production JavaScript contains zero references to private server hostnames (`api.lamanotes.de`, `sync.lamanotes.de`, or pre-shared secrets).

### 2.3 UI & UX Adaptations

#### Onboarding (`src/components/OnboardingStorageCard.tsx`)
- When `FEATURES.SYNC === false`:
  - The "Sign In / Register" card is styled as disabled (`opacity-60 cursor-not-allowed`) with a badge/subtitle: *"Cloud Sync – Coming Soon"*.
  - The "Use locally only" action is highlighted as the primary button with accent styling.
- When `FEATURES.SYNC === true`:
  - Both "Sign In / Register" and "Use locally only" are fully active.

#### Settings Navigation (`src/components/SettingsNav.tsx` & `SettingsModal.tsx`)
- When `FEATURES.SYNC === false`:
  - The `Cloud Sync` item is excluded from `NAV_ITEMS`.
  - The active tab automatically defaults to `appearance` or `editor`.
- When `FEATURES.SYNC === true`:
  - The `Cloud Sync` item is visible and functional.

#### App Initialization (`src/hooks/useNotesInit.ts`)
- When `FEATURES.SYNC === false`:
  - The initialization immediately initializes local PGlite in `'local'` mode.
  - Skips reading Tauri secure store for Supabase tokens and skips ElectricSQL network pull loops.

---

## 3. Tauri Configuration & Update Channels

### 3.1 Tauri Overlay Configs
- **Default Config (`src-tauri/tauri.conf.json`):**
  - Identifier: `com.tobtheu.notizapp`
  - Name: `Lama Notes`
  - Updater endpoint: `https://github.com/tobtheu/notes-app/releases/latest/download/latest.json`
- **Beta Config (`src-tauri/tauri.beta.conf.json`):**
  - Identifier: `com.tobtheu.notizapp.beta`
  - Name: `Lama Notes Beta`
  - Updater endpoint: `https://api.lamanotes.de/updates/beta.json`

### 3.2 In-App Auto-Update Matrix

| Channel | Identifier | Updater Endpoint | Release Distribution |
| :--- | :--- | :--- | :--- |
| **Stable (Offline)** | `com.tobtheu.notizapp` | `github.com/.../releases/latest/download/latest.json` | Public GitHub Releases |
| **Beta (Sync)** | `com.tobtheu.notizapp.beta` | `api.lamanotes.de/updates/beta.json` | VPS-hosted private manifest & binaries |

---

## 4. Build Scripts & GitHub Actions Workflows

### 4.1 Local `package.json` Scripts
```json
{
  "scripts": {
    "dev": "vite --host",
    "dev:sync": "cross-env VITE_ENABLE_SYNC=true vite --host",
    "build": "tsc -b && vite build",
    "build:sync": "tsc -b && cross-env VITE_ENABLE_SYNC=true vite build",
    "tauri:build": "tauri build",
    "tauri:build:beta": "cross-env VITE_ENABLE_SYNC=true tauri build --config src-tauri/tauri.beta.conf.json"
  }
}
```

### 4.2 CI/CD Workflows (`.github/workflows/`)

1. **`release-offline.yml` (Public Stable Release):**
   - **Trigger:** Push on git tags `v[0-9]+.[0-9]+.[0-9]+` (e.g., `v1.0.0`).
   - **Build:** `npm run build` (No sync secrets injected).
   - **Publish:** Attaches `.dmg`, `.exe`, `.AppImage`/`.deb`, and `latest.json` directly to GitHub Releases.

2. **`build-sync-beta.yml` (Private Beta Release):**
   - **Trigger:** Manual trigger (`workflow_dispatch`) with version input or tag `v*-beta*`.
   - **Build:** Injects GitHub Secrets (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ELECTRIC_URL`, `VITE_LAMA_SECRET`) and builds with `tauri.beta.conf.json`.
   - **Publish:** Uploads the signed build artifacts and `beta.json` to the VPS update directory via SSH / SCP, or creates a GitHub Action artifact.

3. **`build-mobile.yml` (Mobile Platform Pipeline):**
   - Future pipeline for building iOS `.ipa` (for Apple TestFlight) and Android `.apk` / `.aab`.

---

## 5. Verification Plan

1. **Feature-Flag Unit Testing:**
   - Vitest tests asserting that `FEATURES.SYNC === false` hides the sync tab and prevents remote API calls.
   - Vitest tests asserting that `FEATURES.SYNC === true` renders full auth and sync controls.
2. **Bundle Security Audit:**
   - Execute production offline build (`npm run build`).
   - Run grep search on `dist/` to verify zero instances of server hostnames or secrets.
3. **Dual Installation Test:**
   - Build both `Lama Notes` and `Lama Notes Beta`.
   - Verify both apps can be installed and opened simultaneously on macOS without cache collision.
4. **Updater Verification:**
   - Verify updater JSON endpoints resolve to valid update structures for their respective channels.

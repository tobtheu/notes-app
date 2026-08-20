# Design Specification: Code Cleanup & HTTPS Domain Integration

**Date:** 2026-08-20  
**Status:** Approved  
**Branch:** `refactor/cleanup-and-redesign`  
**Scope:** Removing unmaintained/legacy subsystems (GitHub sync, QuickNote window dummy, WikiLinks experimental extension), retaining active table tools, and migrating cloud sync/auth infrastructure to `https://api.lamanotes.de` and `https://sync.lamanotes.de`.

---

## 1. Executive Summary

To prepare the application for a comprehensive UI/UX redesign, we first clean up dead/experimental code and finalize the backend connection under a secure HTTPS domain (`lamanotes.de`).

This specification covers:
1. **Branch Isolation:** Creating a new development branch `refactor/cleanup-and-redesign`.
2. **Dead Code Cleanup:**
   - **GitHub Sync (Rust & Frontend):** Remove `src-tauri/src/git.rs`, `src-tauri/src/github.rs`, store commands, IPC commands, and associated TypeScript bindings.
   - **QuickNote Window Dummy:** Remove `appWindow.label === 'quick-note'` routing and related dead code.
   - **WikiLinks Extension:** Remove `src/extensions/WikiLinkSuggestion.ts`, `src/components/WikiLinkMenu.tsx`, `src/hooks/useWikiLinkMenu.ts`, and Editor integrations.
   - **Retain Tables:** Confirm and keep `TableNode.tsx`, `TableHoverToolbar.tsx`, and Tiptap table extensions intact.
3. **HTTPS & Domain Configuration:**
   - Configure VPS reverse proxy routing for `https://api.lamanotes.de` (GoTrue Auth on 10000 + PostgREST on 3001) and `https://sync.lamanotes.de` (ElectricSQL on 3000) with TLS certificates.
   - Update frontend `.env`, `.env.example`, and Supabase/Electric client configurations to use the HTTPS endpoints.

---

## 2. Architecture & Components

```mermaid
graph TD
    subgraph Desktop & Mobile Client
        Editor["Tiptap Editor (with Table Tools)"]
        PGlite["PGlite Local DB (WASM IndexedDB)"]
        SupabaseClient["Supabase JS Client (HTTPS)"]
        ElectricClient["Electric Sync Client (WSS / HTTPS)"]
    end

    subgraph Hetzner VPS (46.225.11.148)
        Proxy["Traefik / Reverse Proxy (Port 443 SSL)"]
        GoTrue["GoTrue Auth (Port 10000)"]
        PostgREST["PostgREST (Port 3001)"]
        ElectricService["ElectricSQL Service (Port 3000)"]
        PostgresDB["PostgreSQL 16"]
    end

    SupabaseClient -->|https://api.lamanotes.de/auth/v1| Proxy
    SupabaseClient -->|https://api.lamanotes.de/rest/v1| Proxy
    ElectricClient -->|https://sync.lamanotes.de/v1/shape| Proxy

    Proxy --> GoTrue
    Proxy --> PostgREST
    Proxy --> ElectricService

    GoTrue --> PostgresDB
    PostgREST --> PostgresDB
    ElectricService --> PostgresDB
```

---

## 3. Detailed Component Plan

### A. Git & Branch Setup
- Create and switch to new branch `refactor/cleanup-and-redesign`.

### B. Rust Backend Cleanup (`src-tauri`)
- Delete `src-tauri/src/git.rs` and `src-tauri/src/github.rs`.
- In `src-tauri/src/lib.rs`:
  - Remove `mod git;` and `mod github;`.
  - Remove invoke handlers: `connect_github`, `start_github_oauth`, `complete_github_oauth`, `clear_github_credentials`.
- In `src-tauri/src/store.rs`:
  - Remove `save_github_credentials` and `clear_github_credentials`.
- In `src/lib/ipc.ts`:
  - Remove GitHub-related IPC wrappers (`startGithubOAuth`, `completeGithubOAuth`, `connectGithub`, `clearGithubCredentials`).

### C. WikiLinks & QuickNote Cleanup
- Delete `src/extensions/WikiLinkSuggestion.ts`.
- Delete `src/components/WikiLinkMenu.tsx`.
- Delete `src/hooks/useWikiLinkMenu.ts`.
- In `src/hooks/useMarkdownEditor.ts`:
  - Remove `WikiLinkSuggestion` from editor extensions.
  - Remove wiki link menu state and handlers.
- In `src/components/MarkdownEditor.tsx` & `src/components/Editor.tsx`:
  - Remove `<WikiLinkMenu />` rendering and `onNavigate` props tied to wiki links.
- In `src/App.tsx`:
  - Remove the `isQuickNote` check and dummy render block.

### D. Table Tools Preservation
- Keep `src/components/TableNode.tsx`.
- Keep `src/components/TableHoverToolbar.tsx`.
- Keep Tiptap `Table`, `TableRow`, `TableCell`, `TableHeader` configurations intact in `useMarkdownEditor.ts`.

### E. HTTPS Domain Configuration
- VPS side:
  - Configure Traefik/Caddy routes for:
    - `api.lamanotes.de` -> GoTrue (10000) & PostgREST (3001) with SSL.
    - `sync.lamanotes.de` -> ElectricSQL (3000) with SSL.
- Client side:
  - Update `.env`:
    - `VITE_SUPABASE_URL=https://api.lamanotes.de`
    - `VITE_ELECTRIC_URL=https://sync.lamanotes.de`
  - Update `.env.example` to document the production domain format.

---

## 4. Verification Plan

### Automated Verification
1. Run TypeScript typecheck:
   ```bash
   npx tsc --noEmit
   ```
2. Run Vitest unit test suite:
   ```bash
   npm test
   ```
3. Run Cargo check on Rust backend:
   ```bash
   cd src-tauri && cargo check
   ```

### Functional Verification
1. Verify HTTPS endpoints via `curl -I https://api.lamanotes.de` and `curl -I https://sync.lamanotes.de`.
2. Test user login / session creation against `https://api.lamanotes.de`.
3. Test live shape sync with ElectricSQL against `https://sync.lamanotes.de`.
4. Verify table insertion and row/column operations remain functional in the markdown editor.

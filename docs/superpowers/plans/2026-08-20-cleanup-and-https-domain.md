# Cleanup and HTTPS Domain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up legacy GitHub sync code, QuickNote window routing, and experimental WikiLinks extension while configuring HTTPS routing on `api.lamanotes.de` and `sync.lamanotes.de`.

**Architecture:** Remove unmaintained Rust/TypeScript modules to streamline the codebase and maintain table tools intact. Configure the VPS reverse proxy to expose GoTrue/PostgREST on `https://api.lamanotes.de` and ElectricSQL on `https://sync.lamanotes.de` over standard TLS port 443.

**Tech Stack:** Rust (Tauri 2), TypeScript, React, Vite, Tiptap, Caddy/Traefik, PGlite, ElectricSQL.

## Global Constraints

- Never break or delete active table tools (`TableNode.tsx`, `TableHoverToolbar.tsx`).
- Keep all unit tests passing (`npm test`).
- Ensure Rust backend compiles without errors (`cargo check`).
- Maintain existing database schema and offline sync contracts.

---

### Task 1: Rust Backend Cleanup (GitHub & Git Sync Removal)

**Files:**
- Delete: `src-tauri/src/git.rs`
- Delete: `src-tauri/src/github.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/store.rs`

**Interfaces:**
- Removes obsolete invoke handlers: `connect_github`, `start_github_oauth`, `complete_github_oauth`, `clear_github_credentials`.

- [ ] **Step 1: Delete `git.rs` and `github.rs`**

```bash
rm src-tauri/src/git.rs src-tauri/src/github.rs
```

- [ ] **Step 2: Clean `src-tauri/src/store.rs`**

Remove `save_github_credentials` and `clear_github_credentials` from `src-tauri/src/store.rs`.

- [ ] **Step 3: Clean `src-tauri/src/lib.rs`**

Remove:
- `mod git;` and `mod github;`
- Handlers `clear_github_credentials`, `connect_github`, `start_github_oauth`, `complete_github_oauth`
- Handlers registration in `tauri::generate_handler![...]`

- [ ] **Step 4: Verify Rust compilation**

Run: `cd src-tauri && cargo check`
Expected: Finished dev profile with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/
git commit -m "refactor(backend): remove legacy github and git sync modules"
```

---

### Task 2: Frontend IPC & QuickNote Cleanup

**Files:**
- Modify: `src/lib/ipc.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Removes `window.tauriAPI.startGithubOAuth`, `completeGithubOAuth`, `connectGithub`, `clearGithubCredentials`.
- Removes `isQuickNote` branch from `src/App.tsx`.

- [ ] **Step 1: Clean `src/lib/ipc.ts`**

Remove GitHub sync methods from `window.tauriAPI` and `ipc.ts` mock/fallback objects.

- [ ] **Step 2: Clean `src/App.tsx`**

Remove `const isQuickNote = appWindow.label === 'quick-note';` and the conditional render block.

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ipc.ts src/App.tsx
git commit -m "refactor(frontend): clean up github IPC methods and quicknote window dummy"
```

---

### Task 3: WikiLinks Extension & Components Cleanup

**Files:**
- Delete: `src/extensions/WikiLinkSuggestion.ts`
- Delete: `src/components/WikiLinkMenu.tsx`
- Delete: `src/hooks/useWikiLinkMenu.ts`
- Modify: `src/hooks/useMarkdownEditor.ts`
- Modify: `src/components/MarkdownEditor.tsx`
- Modify: `src/components/Editor.tsx`

**Interfaces:**
- Removes `WikiLinkSuggestion` from Tiptap editor extension array.
- Ensures table tools (`TableNode`, `TableHoverToolbar`, `Table`) remain completely intact.

- [ ] **Step 1: Delete WikiLink files**

```bash
rm src/extensions/WikiLinkSuggestion.ts src/components/WikiLinkMenu.tsx src/hooks/useWikiLinkMenu.ts
```

- [ ] **Step 2: Clean `useMarkdownEditor.ts`**

Remove `WikiLinkSuggestion` import and extension from `getInitialExtensions()`, along with any unused wiki-link state.

- [ ] **Step 3: Clean `MarkdownEditor.tsx` and `Editor.tsx`**

Remove `<WikiLinkMenu />` component inclusion and unused props.

- [ ] **Step 4: Run unit tests and typecheck**

Run: `npx tsc --noEmit && npm test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "refactor(editor): remove experimental wikilink extension and menu"
```

---

### Task 4: HTTPS Domain Configuration & VPS Routing

**Files:**
- Modify: `.env`
- Modify: `.env.example`
- Configure VPS: `/opt/lama-notes/caddy/Caddyfile` or Traefik proxy on VPS `46.225.11.148`

**Interfaces:**
- `VITE_SUPABASE_URL=https://api.lamanotes.de`
- `VITE_ELECTRIC_URL=https://sync.lamanotes.de`

- [ ] **Step 1: Configure Caddy / Traefik on VPS for SSL on 443**

Update Caddyfile on VPS to handle `api.lamanotes.de` and `sync.lamanotes.de` with TLS and reverse proxying to GoTrue (10000), PostgREST (3001), and Electric (3000).

- [ ] **Step 2: Verify HTTPS endpoints**

Run:
```bash
curl -I https://api.lamanotes.de
curl -I https://sync.lamanotes.de
```
Expected: HTTP 200 / 403 / 401 response with valid TLS certificate.

- [ ] **Step 3: Update local `.env` and `.env.example`**

Update `.env` to point to `https://api.lamanotes.de` and `https://sync.lamanotes.de`.

- [ ] **Step 4: Run build & automated tests**

Run: `npm run build && npm test`
Expected: Build succeeds, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add .env.example
git commit -m "chore(config): update environment templates for HTTPS domains"
```

# Notiz-App (Tauri V2)

A fast, lightweight, and modern note-taking application built with Tauri V2, React, and TypeScript. Focus on simplicity, privacy, and speed.

## Key Features

- Tauri V2 Powered: Blazing fast performance with a minimal security-first Rust backend.
- Hybrid Markdown Editor: A powerful visual editor powered by Tiptap with full Markdown support.
- Local-First Storage: Your notes stay on your machine. Stored as standard .md files for maximum compatibility.
- GitHub Cloud Sync: Optional sync with GitHub repositories for backup and multi-device support.
- Conflict Detection: Automatic detection of sync conflicts (e.g. from iCloud or concurrent GitHub edits).
- Smart Internal Linking: Link notes together using note:// protocol. Supports deep-linking to specific headings.
- Pinning System: Keep your most important thoughts at the top of your list.
- Folder Organization: Simple and intuitive folder management for your workspace.
- Performance and Stability: Optimized scroll behavior, anti-flicker editor stabilization, and smart auto-save normalization.
- Modern UI: Beautiful, responsive interface with a focus on typography and readability.

## Technology Stack

- Frontend: React 18, TypeScript, Vite
- Editor: Tiptap (ProseMirror based) with Markdown extensions
- Styling: Modern CSS with CSS Variables for theme consistency
- Backend: Rust (Tauri V2)
- Icons: Lucide React

## Getting Started

### Prerequisites

- Node.js (Latest LTS)
- Rust (Stable)
- Tauri Prerequisites for your OS

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run in development mode:
   ```bash
   npm run tauri dev
   ```

### Building for Production

To build a standalone executable:
```bash
npm run tauri build
```

## Project Structure

- src/: React frontend source code
- src/hooks/: Custom React hooks for state and note management
- src/components/: Modular UI components
- src-tauri/: Rust backend and Tauri configuration
- src-tauri/src/lib.rs: Core file system and metadata logic

---
Built using Antigravity
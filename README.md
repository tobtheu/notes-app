# Lama Notes

A fast, lightweight, and modern local-first note-taking application built with Tauri V2, React 19, TypeScript, and Rust. Designed with a focus on simplicity, privacy, speed, and great writing ergonomics.

---

## Key Features

- **Tauri V2 & Rust Powered:** Blazing fast native performance with minimal memory consumption compared to traditional Electron apps.
- **Local-First Architecture (PGlite):** Embedded PostgreSQL running locally in your app for instant search, zero-latency operations, and complete offline capability.
- **Optional Supabase Cloud Sync:** Secure multi-device synchronization with account authentication and conflict resolution.
- **Hybrid Markdown WYSIWYG Editor:** Powerful writing experience powered by Tiptap with seamless Markdown formatting.
  - **Slash Menu (`/`):** Fast formatting for headings, bullet points, task lists, code blocks, and tables without leaving the keyboard.
  - **Interactive Task Lists & Tables:** Dynamic checklists and easy-to-use table management.
  - **Code Highlighting:** Syntax-highlighted code blocks for developers.
  - **Floating Bubble Toolbar:** Contextual formatting tools on text selection.
- **Focus Mode:** Minimalist distraction-free writing environment that hides toolbars and sidebars.
- **Organization & Structure:**
  - Intuitive folder management to structure your ideas.
  - Pinning system to keep key notes at the top.
  - Instant real-time search across all notes.
- **Data Freedom (Import & Export):**
  - Import individual `.md` files or whole folders.
  - Full backup export to ensure zero vendor lock-in.
- **Personalization & Aesthetics:**
  - Smooth Dark, Light, and Auto themes (including Clay & Sage presets).
  - Multiple font options (Inter, Roboto, Courier, SF Mono, Serif, System) and adjustable font sizes.
  - Configurable note counts, monochrome icon options, and iOS landscape optimizations.
- **Built-in Auto-Updater & Diagnostics:** Integrated version checks, self-updating, and environment diagnostics.

---

## Technology Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS
- **Editor:** Tiptap (ProseMirror based) with Markdown extensions
- **Database / Local-First:** PGlite (Embedded Postgres)
- **Sync / Auth:** Supabase
- **Backend / Desktop Framework:** Rust (Tauri V2)
- **Icons:** Lucide React

---

## Getting Started

### Prerequisites

- **Node.js:** Latest LTS
- **Rust:** Stable toolchain (`rustup`)
- **Tauri Prerequisites:** Refer to the official [Tauri V2 Documentation](https://v2.tauri.app/start/prerequisites/) for your operating system.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/tobtheu/notes-app.git
   cd notes-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run in development mode:
   ```bash
   npm run tauri dev
   ```

### Building for Production

To build a standalone desktop executable for your platform:
```bash
npm run tauri build
```

---

## Project Structure

```text
├── src/                # React frontend (UI components, hooks, stores, styles)
│   ├── components/     # UI modules (Editor, Sidebar, Settings, Modals, etc.)
│   ├── hooks/          # Custom hooks (Theme, Notes, Sync, Editor)
│   └── utils/          # Data import/export, sanitization, and helper functions
├── src-tauri/          # Rust backend (Tauri V2 configuration, plugins, sync logic)
│   ├── src/            # Rust source code
│   └── Cargo.toml      # Rust crate dependencies
└── docs/               # Architecture notes, specs, and prototypes
```

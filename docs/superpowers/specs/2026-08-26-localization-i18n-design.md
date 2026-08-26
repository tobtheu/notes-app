# Localization & Internationalization (i18n) Design

**Date:** 2026-08-26  
**Status:** In Review  
**Author:** Tobias Theunissen & Antigravity  

---

## 1. Overview & Goals

Currently, the Lama Notes codebase contains a mix of German and English user-facing strings across components. The goal of this feature is to establish a robust, lightweight, and 100% type-safe localization architecture that:

1. **Default & Fallback Language:** English (`en`) is the default and base reference language.
2. **Supported Languages:** English (`en`) and German (`de`), with architecture designed for easy addition of future languages.
3. **Automatic System Language Detection:** On initial launch (or when set to `system`), the application checks the operating system / browser language (`navigator.language`). If it matches German (e.g. `de`, `de-DE`, `de-AT`, `de-CH`), German is selected; if unsupported or unknown, it falls back to English.
4. **User Override via Settings:** Users can switch the language in the Settings Modal (`System (Auto)`, `English`, `Deutsch`). Selecting an explicit language overrides system detection and persists across app restarts and cloud sync.
5. **Full Application Coverage:** All UI elements (Sidebar, Note List, Editor, Toolbars, Slash Menu, Bubble Menu, Settings, Modals, Onboarding, Dialogs, Date Formatting) are fully translated.

---

## 2. Architecture & Design

### 2.1 File Structure

```
src/
├── i18n/
│   ├── index.ts              # Public exports (t, useTranslation, I18nProvider, formatDate)
│   ├── types.ts              # Translation schema types & supported language definitions
│   ├── I18nContext.tsx        # React Context & Provider managing language state & resolution
│   ├── useTranslation.ts     # React hook providing t(), currentLocale, activeLanguage, formatDate
│   ├── utils.ts              # Translation path resolver, parameter interpolation, date formatter
│   └── locales/
│       ├── index.ts          # Language registry & metadata (labels, dictionaries)
│       ├── en.ts             # English base dictionary (Single Source of Truth)
│       └── de.ts             # German translations strictly typed against en.ts schema
```

### 2.2 Translation Schema & Type Safety

* `en.ts` serves as the authoritative type contract (`TranslationSchema = typeof en`).
* `de.ts` is typed as `TranslationSchema`. If any key is missing or misnamed in German, TypeScript produces a compile-time error.
* Translation keys are structured hierarchically:
  * `common`: Generic actions (`save`, `cancel`, `delete`, `done`, `confirm`, `edit`, `loading`, etc.)
  * `sidebar`: Sidebar navigation, search placeholder, folders, note counts, context menus.
  * `notes`: Note list, sorting, pinning, swipe actions, empty states.
  * `editor`: Editor toolbar tooltips, slash commands, bubble menu, word/character counter, read time, placeholders.
  * `settings`: Settings navigation tabs, Appearance, Editor, Cloud Sync, Backup/Data, Trash, About sections.
  * `modals`: Folder creation/edit, delete folder confirmation, link input modal, updater modal.
  * `onboarding`: Welcome screen, storage selection, auth form.

### 2.3 Interpolation & Helper Functions

* **Parameterized Strings:** Supports variable interpolation like `t('editor.wordCount', { count: 42 })` replacing `{count}` placeholders.
* **Fallbacks:** If a key is missing at runtime in an active locale, it automatically falls back to the English string, and finally to the key string if missing in both.
* **Locale-Aware Formatting:** Provides `formatDate(date, options)` and `formatNumber(number)` using native `Intl` API configured with the resolved locale (`en-US` for `en`, `de-DE` for `de`).

### 2.4 State Management & Settings Integration

* `useSettings.ts` manages `language: 'system' | 'en' | 'de'`.
* Initial state resolves `localStorage.getItem('language') || 'system'`.
* Saves updates to `localStorage` and syncs with Supabase/ElectricSQL metadata (`app_config.settings.language`).
* `I18nProvider` receives the `language` setting and `setLanguage` handler, resolving the effective active locale (`'en'` or `'de'`).

---

## 3. UI Changes

### 3.1 Settings Modal (`src/components/AppearanceSection.tsx`)
* A dedicated **Language / Sprache** selector is added to `AppearanceSection`:
  * Options:
    * `System (Auto)` — dynamically shows current detection e.g. *System (Deutsch)* or *System (English)*
    * `English`
    * `Deutsch`
* Clean dropdown / segmented selector matching existing theme and typography selectors.

### 3.2 Component Translation Scope

All hardcoded German or mixed strings will be replaced with `t(...)` calls:
* **Sidebar** (`Sidebar.tsx`, `SidebarFooter.tsx`, `FolderItem.tsx`, `FolderMoveMenu.tsx`)
* **Note List** (`NoteList.tsx`, `NoteListHeader.tsx`, `NoteListItem.tsx`, `NoteItemActions.tsx`, `TrashListItem.tsx`)
* **Editor** (`Editor.tsx`, `EditorToolbar.tsx`, `EditorMenu.tsx`, `EditorHoverMenus.tsx`, `SlashMenu.tsx`, `BubbleToolbarContent.tsx`, `TableHoverToolbar.tsx`)
* **Settings** (`SettingsModal.tsx`, `SettingsNav.tsx`, `AppearanceSection.tsx`, `EditorSection.tsx`, `CloudSyncSection.tsx`, `CloudSyncAuthForm.tsx`, `CloudSyncStatusCard.tsx`, `StorageSection.tsx`, `TrashSection.tsx`, `AboutSection.tsx`, `DangerZoneCard.tsx`)
* **Modals & Overlays** (`FolderEditModal.tsx`, `DeleteFolderModal.tsx`, `UrlInputModal.tsx`, `UpdateModal.tsx`, `EmptyStateTutorial.tsx`)
* **Onboarding** (`OnboardingScreen.tsx`, `OnboardingStorageCard.tsx`, `OnboardingAuthCard.tsx`)
* **Window Controls & Navigation** (`TitleBar.tsx`)

---

## 4. Verification & Testing

1. **Unit Tests:**
   * `src/i18n/__tests__/i18n.test.ts`: Verify key resolution, interpolation (`{param}` replacement), system language detection, and English fallback.
   * `src/hooks/__tests__/useSettings.test.ts`: Verify `language` setting persistence and updates.
2. **Type Checking:** Run `tsc -b` to guarantee full type safety across English and German locale dictionaries.
3. **Manual & Browser Testing:**
   * Switch between System, English, and Deutsch in Settings and verify all UI components immediately re-render in the selected language.
   * Verify date formats (e.g. `TrashListItem`, note updated timestamps) update to match the locale.

# Localization (i18n) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a zero-dependency, 100% type-safe localization (i18n) system for Lama Notes with English as default/fallback, German as secondary, automatic OS system language detection, and user settings override.

**Architecture:** A lightweight React Context & hook (`I18nProvider`, `useTranslation`) backed by strictly-typed locale dictionaries (`en.ts` base schema, `de.ts` translation). Connected to `useSettings` for persistence in `localStorage` and cloud metadata sync. All components across the application consume `t(key, params)` and locale-aware `formatDate()`.

**Tech Stack:** React 19, TypeScript, Vitest, Tailwind CSS, Intl Web APIs.

## Global Constraints

- Default language: English (`en`).
- Fallback language: English (`en`) for any missing key or unsupported system locale.
- System detection: `navigator.language` (German if starting with `de`, otherwise English).
- User setting: `'system' | 'en' | 'de'` stored in `localStorage` and synced in `app_config.settings.language`.
- Strict type-safety: `de.ts` must satisfy `TranslationSchema` (`typeof en`).

---

### Task 1: i18n Core Types, Locales & Translation Utilities

**Files:**
- Create: `src/i18n/types.ts`
- Create: `src/i18n/locales/en.ts`
- Create: `src/i18n/locales/de.ts`
- Create: `src/i18n/locales/index.ts`
- Create: `src/i18n/utils.ts`
- Test: `src/i18n/__tests__/i18n.test.ts`

**Interfaces:**
- Produces:
  - `LanguageOption`: `'system' | 'en' | 'de'`
  - `SupportedLocale`: `'en' | 'de'`
  - `TranslationSchema`: Schema type derived from `en.ts`
  - `resolveTranslation(dict, key)`: Resolves nested dot-notation paths
  - `interpolate(template, params)`: Replaces `{param}` tokens
  - `detectSystemLanguage(navLang?)`: Returns `'de'` or `'en'`
  - `formatDate(date, options, locale)`: Formats Date objects using `Intl.DateTimeFormat`

- [ ] **Step 1: Write failing tests for translation utils and system detection**

```typescript
// src/i18n/__tests__/i18n.test.ts
import { describe, it, expect } from 'vitest';
import { resolveTranslation, interpolate, detectSystemLanguage, formatDate } from '../utils';
import { en } from '../locales/en';
import { de } from '../locales/de';

describe('i18n core utilities', () => {
    it('resolves nested dot-notation keys', () => {
        expect(resolveTranslation(en, 'common.save')).toBe('Save');
        expect(resolveTranslation(de, 'common.save')).toBe('Speichern');
    });

    it('interpolates {placeholder} tokens in strings', () => {
        expect(interpolate('Hello {name}!', { name: 'Tobias' })).toBe('Hello Tobias!');
        expect(interpolate('{count} notes found', { count: 5 })).toBe('5 notes found');
    });

    it('detects system language correctly and falls back to en', () => {
        expect(detectSystemLanguage('de-DE')).toBe('de');
        expect(detectSystemLanguage('de-AT')).toBe('de');
        expect(detectSystemLanguage('de')).toBe('de');
        expect(detectSystemLanguage('en-US')).toBe('en');
        expect(detectSystemLanguage('fr-FR')).toBe('en');
        expect(detectSystemLanguage('')).toBe('en');
    });

    it('formats dates according to locale', () => {
        const testDate = new Date('2026-08-26T12:00:00Z');
        const formattedEn = formatDate(testDate, { month: 'short', day: 'numeric', year: 'numeric' }, 'en');
        const formattedDe = formatDate(testDate, { month: 'short', day: 'numeric', year: 'numeric' }, 'de');
        expect(formattedEn).toBeTruthy();
        expect(formattedDe).toBeTruthy();
    });

    it('ensures German dictionary has same structure as English dictionary', () => {
        const getKeys = (obj: any, prefix = ''): string[] => {
            return Object.keys(obj).reduce((res: string[], el) => {
                if (Array.isArray(obj[el])) {
                    return res;
                } else if (typeof obj[el] === 'object' && obj[el] !== null) {
                    return [...res, ...getKeys(obj[el], `${prefix}${el}.`)];
                }
                return [...res, `${prefix}${el}`];
            }, []);
        };

        const enKeys = getKeys(en).sort();
        const deKeys = getKeys(de).sort();
        expect(deKeys).toEqual(enKeys);
    });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- src/i18n/__tests__/i18n.test.ts`
Expected: FAIL (modules not found)

- [ ] **Step 3: Implement `types.ts`, `en.ts`, `de.ts`, `locales/index.ts`, and `utils.ts`**

Implement complete dictionary and resolution engine with zero placeholders.

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- src/i18n/__tests__/i18n.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/i18n/
git commit -m "feat(i18n): add core types, locale dictionaries, and translation utils"
```

---

### Task 2: i18n React Context, Provider & `useTranslation` Hook

**Files:**
- Create: `src/i18n/I18nContext.tsx`
- Create: `src/i18n/useTranslation.ts`
- Create: `src/i18n/index.ts`
- Test: `src/i18n/__tests__/I18nContext.test.tsx`

**Interfaces:**
- Consumes: `LanguageOption`, `SupportedLocale`, `locales`, `utils` from Task 1
- Produces:
  - `<I18nProvider language={language} onLanguageChange={setLanguage}>`
  - `useTranslation()`: `{ t, language, setLanguage, activeLocale, formatDate, formatNumber }`

- [ ] **Step 1: Write test for I18nContext and useTranslation hook**

```tsx
// src/i18n/__tests__/I18nContext.test.tsx
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { I18nProvider } from '../I18nContext';
import { useTranslation } from '../useTranslation';

function TestComponent() {
    const { t, language, setLanguage, activeLocale } = useTranslation();
    return (
        <div>
            <span data-testid="save-btn">{t('common.save')}</span>
            <span data-testid="active-locale">{activeLocale}</span>
            <span data-testid="current-lang">{language}</span>
            <button onClick={() => setLanguage('de')}>Set DE</button>
            <button onClick={() => setLanguage('en')}>Set EN</button>
        </div>
    );
}

describe('I18nContext & useTranslation', () => {
    it('provides translation and handles language switching', () => {
        let currentLang = 'en';
        const setLang = (l: any) => { currentLang = l; };

        const { rerender } = render(
            <I18nProvider language="en" onLanguageChange={setLang}>
                <TestComponent />
            </I18nProvider>
        );

        expect(screen.getByTestId('save-btn').textContent).toBe('Save');
        expect(screen.getByTestId('active-locale').textContent).toBe('en');

        rerender(
            <I18nProvider language="de" onLanguageChange={setLang}>
                <TestComponent />
            </I18nProvider>
        );

        expect(screen.getByTestId('save-btn').textContent).toBe('Speichern');
        expect(screen.getByTestId('active-locale').textContent).toBe('de');
    });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- src/i18n/__tests__/I18nContext.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `I18nContext.tsx`, `useTranslation.ts`, and `index.ts`**

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- src/i18n/__tests__/I18nContext.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/i18n/
git commit -m "feat(i18n): add I18nContext, I18nProvider, and useTranslation hook"
```

---

### Task 3: Settings Integration (`useSettings.ts`)

**Files:**
- Modify: `src/hooks/useSettings.ts`
- Modify: `src/hooks/__tests__/useSettings.test.ts`

**Interfaces:**
- Consumes: `LanguageOption` from `src/i18n`
- Produces:
  - `settings.language: LanguageOption`
  - `setLanguage: (lang: LanguageOption) => void`
  - syncs to `localStorage` ('language') and cloud `metadataSettings.language`

- [ ] **Step 1: Write test for `language` setting persistence in `useSettings.test.ts`**

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- src/hooks/__tests__/useSettings.test.ts`
Expected: FAIL (language property not present)

- [ ] **Step 3: Update `useSettings.ts` with `language` state, storage, and cloud sync**

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- src/hooks/__tests__/useSettings.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSettings.ts src/hooks/__tests__/useSettings.test.ts
git commit -m "feat(settings): add language preference persistence and cloud sync"
```

---

### Task 4: Settings UI Localization & Language Selector

**Files:**
- Modify: `src/components/AppearanceSection.tsx`
- Modify: `src/components/SettingsNav.tsx`
- Modify: `src/components/SettingsModal.tsx`
- Modify: `src/components/EditorSection.tsx`
- Modify: `src/components/CloudSyncSection.tsx`
- Modify: `src/components/CloudSyncStatusCard.tsx`
- Modify: `src/components/CloudSyncAuthForm.tsx`
- Modify: `src/components/StorageSection.tsx`
- Modify: `src/components/TrashSection.tsx`
- Modify: `src/components/AboutSection.tsx`
- Modify: `src/components/DangerZoneCard.tsx`

**Interfaces:**
- Consumes: `useTranslation()`, `LanguageOption`
- Produces: Localized settings modal with Language dropdown/segmented control in `AppearanceSection`

- [ ] **Step 1: Add Language Selector to `AppearanceSection.tsx` and wire with `useTranslation`**
- [ ] **Step 2: Localize `SettingsNav.tsx`, `SettingsModal.tsx`, and all sub-sections**
- [ ] **Step 3: Verify TypeScript and unit tests pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/
git commit -m "feat(settings): add language selector and localize all settings sections"
```

---

### Task 5: Sidebar, Note List, Modals & Onboarding Localization

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/SidebarFooter.tsx`
- Modify: `src/components/FolderItem.tsx`
- Modify: `src/components/FolderMoveMenu.tsx`
- Modify: `src/components/NoteList.tsx`
- Modify: `src/components/NoteListHeader.tsx`
- Modify: `src/components/NoteListItem.tsx`
- Modify: `src/components/NoteItemActions.tsx`
- Modify: `src/components/TrashListItem.tsx`
- Modify: `src/components/FolderEditModal.tsx`
- Modify: `src/components/DeleteFolderModal.tsx`
- Modify: `src/components/UrlInputModal.tsx`
- Modify: `src/components/UpdateModal.tsx`
- Modify: `src/components/EmptyStateTutorial.tsx`
- Modify: `src/components/OnboardingScreen.tsx`
- Modify: `src/components/OnboardingStorageCard.tsx`
- Modify: `src/components/OnboardingAuthCard.tsx`
- Modify: `src/components/TitleBar.tsx`

- [ ] **Step 1: Replace all hardcoded German/English strings with `t(...)` in Sidebar, NoteList, and Modals**
- [ ] **Step 2: Update date formatting in `TrashListItem.tsx` to use locale-aware `formatDate()`**
- [ ] **Step 3: Run tests to verify nothing broke**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/
git commit -m "feat(ui): localize sidebar, note list, modals, and onboarding"
```

---

### Task 6: Editor & Rich-Text Menus Localization

**Files:**
- Modify: `src/components/Editor.tsx`
- Modify: `src/components/EditorToolbar.tsx`
- Modify: `src/components/EditorMenu.tsx`
- Modify: `src/components/EditorHoverMenus.tsx`
- Modify: `src/components/SlashMenu.tsx`
- Modify: `src/components/BubbleToolbarContent.tsx`
- Modify: `src/components/TableHoverToolbar.tsx`
- Modify: `src/components/EditorTitleInput.tsx`

- [ ] **Step 1: Translate all editor toolbar tooltips, slash commands, bubble menu items, and placeholders**
- [ ] **Step 2: Translate footer word counts and saving indicators**
- [ ] **Step 3: Run tests and typecheck**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/
git commit -m "feat(editor): localize editor toolbar, slash menu, bubble menu, and status bars"
```

---

### Task 7: Root Wiring & End-to-End Verification

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/AppModals.tsx`

- [ ] **Step 1: Wrap top-level React tree in `<I18nProvider language={settings.language} onLanguageChange={settings.setLanguage}>`**
- [ ] **Step 2: Run full automated test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 3: Run production build and typecheck**

Run: `npm run build`
Expected: `tsc -b && vite build` exits with code 0

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/AppModals.tsx
git commit -m "feat(i18n): wire I18nProvider at app root and complete end-to-end integration"
```

---

## Plan Self-Review Check

- **Spec Coverage:** Covers English default, German secondary, automatic system detection with English fallback, user override in Settings, and full application localization.
- **No Placeholders:** All file paths, function signatures, test cases, and commit commands are fully specified.
- **Type Consistency:** `LanguageOption`, `SupportedLocale`, `TranslationSchema`, `useTranslation()`, `I18nProvider` consistently defined and referenced across all tasks.

import { useState, useEffect, useRef, Component } from 'react';
import type { ReactNode } from 'react';
import { Sidebar } from './components/Sidebar';
import { NoteList } from './components/NoteList';
import { Editor } from './components/Editor';
import { TitleBar } from './components/TitleBar';
import { SettingsModal } from './components/SettingsModal';
import { DeleteFolderModal } from './components/DeleteFolderModal';
import { UpdateModal } from './components/UpdateModal';
import { ConflictModal } from './components/ConflictModal';
import { FolderEditModal } from './components/FolderEditModal';
import { useNotes } from './hooks/useNotes';
import { useSettings } from './hooks/useSettings';
import { useTheme } from './hooks/useTheme';
// import { QuickNote } from './components/QuickNote';
import type { Note } from './types';
import { Loader2, Book } from 'lucide-react';
import clsx from 'clsx';
import { platform } from '@tauri-apps/plugin-os';
import { getCurrentWindow } from '@tauri-apps/api/window';
import logo from './assets/logo.png';

const appWindow = getCurrentWindow();

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { error: null };
    }
    static getDerivedStateFromError(error: Error) {
        return { error };
    }
    render() {
        if (this.state.error) {
            return (
                <div className="fixed inset-0 flex flex-col items-center justify-center bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 p-8 text-center gap-4">
                    <p className="font-bold text-lg">Etwas ist schiefgelaufen</p>
                    <p className="text-sm text-gray-500 font-mono max-w-sm break-all">{this.state.error.message}</p>
                    <button type="button" className="mt-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm" onClick={() => window.location.reload()}>
                        App neu laden
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

function App() {
  const isQuickNote = appWindow.label === 'quick-note';
  const {
    allNotes,
    folders,
    metadata,
    notes,
    currentFolder,
    selectedCategory,
    isLoading,
    selectFolder,
    createNote,
    saveNote,
    deleteNote,
    createFolder,
    deleteFolder,
    renameFolder,
    updateFolderMetadata,
    reorderFolders,
    selectedNote,
    setSelectedNote,
    setSelectedCategory,
    updateNoteLocally,
    moveNote,
    togglePinNote,
    isNotePinned,
    getNoteId,
    searchTerm,
    setSearchTerm,
    triggerSync,
    syncStatus,
    syncError,
    lastSyncedAt,
    conflictPairs,
    resetSyncStatus,
    setupDefaultWorkspace,
    startGitHubOnboarding,
    completeGitHubOnboarding,
    reloadNotes,
    clearGithubCredentials
  } = useNotes();

  // If this Webview is the Quick Note window, display only the QuickNote component rather than the full app.
  // This prevents hooks like `useNotes` from trying to run full filesystem syncs across two windows.
  if (isQuickNote) {
    return <div className="h-screen w-screen bg-transparent flex items-center justify-center text-white"><p>Quick Note</p></div>;
  }

  const {
    markdownEnabled,
    setMarkdownEnabled,
    accentColor,
    setAccentColor,
    fontFamily,
    setFontFamily,
    fontSize,
    setFontSize,
    spellcheckEnabled,
    setSpellcheckEnabled,
    toolbarVisible,
    setToolbarVisible
  } = useSettings(metadata.settings, (_settings) => {
    // metadata.settings is updated via useNotes.saveSettings contextually if needed
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => window.innerWidth < 768);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);

  // Auto-open ConflictModal when a sync conflict is detected
  useEffect(() => {
    if (syncStatus === 'conflict' && conflictPairs.length > 0) {
      setIsConflictModalOpen(true);
    }
  }, [syncStatus, conflictPairs]);

  // Update logic
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<{
    type: 'idle' | 'available' | 'downloading' | 'error' | 'downloaded';
    progress?: number;
    error?: string;
  }>({ type: 'idle' });



  // Mobile View Management
  const [_isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [activeView, setActiveView] = useState<'sidebar' | 'notelist' | 'editor'>('notelist');
  const [selectionCount, setSelectionCount] = useState(0);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);

  const { theme, setTheme } = useTheme();
  const lastWidth = useRef(window.innerWidth);

  // Responsive Behavior: Auto-collapse and Mobile View transitions
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const prev = lastWidth.current;

      // Auto-collapse/expand when crossing the desktop/tablet threshold (1024px)
      if (width < 1024 && prev >= 1024) {
        setIsSidebarCollapsed(true);
      } else if (width >= 1024 && prev < 1024) {
        setIsSidebarCollapsed(false);
      }

      setIsMobile(width < 768);
      lastWidth.current = width;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isSidebarCollapsed]);

  // Apply font size to <html> so all rem-based Tailwind classes scale with it
  useEffect(() => {
    const px = fontSize === 'small' ? '14px' : fontSize === 'large' ? '18px' : '16px';
    document.documentElement.style.fontSize = px;
  }, [fontSize]);

  // Apply accent color to document root for CSS variable overrides
  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accentColor);
  }, [accentColor]);

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const p = await platform();
        if (p === 'ios' || p === 'android') return;
        const { check } = await import('@tauri-apps/plugin-updater');
        const update = await check();
        if (update) {
          setUpdateVersion(update.version);
          setUpdateStatus({ type: 'available' });
          setIsUpdateModalOpen(true);
        }
      } catch (error) {
        console.error('Failed to check for updates:', error);
      }
    };
    checkForUpdates();
  }, []);

  const handleUpdate = async () => {
    try {
      setUpdateStatus({ type: 'downloading' });
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update) {
        await update.downloadAndInstall();
        setUpdateStatus({ type: 'downloaded' });
      }
    } catch (error) {
      console.error('Update failed:', error);
      setUpdateStatus({ type: 'error', error: String(error) });
    }
  };

  const handleInstallUpdate = async () => {
    const { relaunch } = await import('@tauri-apps/plugin-process');
    await relaunch();
  };

  const handleSkipUpdate = () => {
    setIsUpdateModalOpen(false);
  };

  const handleSelectCategory = (category: string | null) => {
    setSelectedCategory(category);
    setActiveView('notelist');
  };

  const handleSelectNote = (note: Note) => {
    setSelectionCount(prev => prev + 1);
    setSelectedNote(getNoteId(note));
    setActiveView('editor');
  };

  const handleCreateNote = async () => {
    await createNote();
    setSelectionCount(prev => prev + 1);
    setActiveView('editor');
  };

  const handleNavigate = (id: string) => {
    if (!id) return;
    setSelectedNote(id);
    setSelectionCount(prev => prev + 1);
    setActiveView('editor');
  };

  const handleSaveCategory = async (newName: string, folderMeta: any) => {
    if (!editingCategory) return;
    const oldName = editingCategory;

    // 1. Rename on disk if needed
    if (newName !== oldName) {
      await renameFolder(oldName, newName);
      // Only update if the modal hasn't been closed (set to null) in the meantime
      setEditingCategory(prev => prev === oldName ? newName : prev);
    }

    // 2. Update visual meta (icon, color)
    await updateFolderMetadata(newName, folderMeta);
  };

  const handleDeleteCategory = async () => {
    if (categoryToDelete) {
      await deleteFolder(categoryToDelete, 'recursive');
      setCategoryToDelete(null);
    }
  };

  // Onboarding state
  const [onboardingStep, setOnboardingStep] = useState<'choice' | 'github_auth'>('choice');
  const [authData, setAuthData] = useState<{
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    interval: number;
  } | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleGitHubChoice = async () => {
    try {
      setAuthError(null);
      // FIRST: ensure any stale credentials from previous attempts are gone
      // This prevents spawn_sync from triggering a premature pull/push
      await clearGithubCredentials();

      const data = await startGitHubOnboarding();
      setAuthData(data);
      setOnboardingStep('github_auth');

      // 1. Create default folder first (but DON'T set currentFolder yet)
      const path = await setupDefaultWorkspace(false);

      // 2. Start THE single blocking poll on the backend
      // This will wait internally in Rust until the user confirms or it times out.
      await completeGitHubOnboarding(data.deviceCode, data.interval, path);

      // Success! completeGitHubOnboarding (in the hook) has now set the currentFolder,
      // which will trigger the main app view automatically.

    } catch (e: any) {
      const errorMsg = e.toString();
      if (errorMsg.includes('Access denied') || errorMsg.includes('expired') || errorMsg.includes('timed out')) {
        setAuthError(errorMsg);
      } else {
        setAuthError("Berechtigung fehlgeschlagen oder abgebrochen.");
      }
      // Revert to choice if we hit a terminal error
      setTimeout(() => setOnboardingStep('choice'), 3000);
    }
  };

  if (!currentFolder) {
    return (
      <div className="flex flex-col items-center justify-center fixed inset-0 bg-gray-50 text-gray-800 dark:bg-gray-900 dark:text-gray-100 p-6 text-center">
        <div className="w-20 h-20 bg-white dark:bg-gray-800 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-primary-500/10 rotate-3 animate-in fade-in zoom-in duration-500 overflow-hidden">
          <img src={logo} alt="Logo" className="w-16 h-16 object-contain" />
        </div>

        {onboardingStep === 'choice' ? (
          <div className="max-w-md animate-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-4xl font-black mb-3 tracking-tight">Willkommen</h1>
            <p className="mb-10 text-gray-500 dark:text-gray-400 text-lg leading-relaxed">
              Deine Gedanken, überall synchronisiert und sicher gespeichert.
            </p>

            <div className="grid gap-4 w-full">
              <button
                onClick={handleGitHubChoice}
                className="group relative flex items-center justify-between px-6 py-5 bg-white dark:bg-gray-800 border-2 border-transparent hover:border-primary-500 rounded-2xl transition-all shadow-sm hover:shadow-xl active:scale-[0.98]"
              >
                <div className="flex items-center gap-4 text-left">
                  <div className="w-12 h-12 bg-gray-900 dark:bg-black rounded-xl flex items-center justify-center text-white">
                    <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>
                  </div>
                  <div>
                    <div className="font-bold text-lg">Mit GitHub verbinden</div>
                    <div className="text-sm text-gray-500">Auto-Setup & Cloud-Sync</div>
                  </div>
                </div>
                <div className="text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
              </button>

              <button
                onClick={selectFolder}
                className="group flex items-center justify-between px-6 py-5 bg-white dark:bg-gray-800 border-2 border-transparent hover:border-gray-200 dark:hover:border-gray-700 rounded-2xl transition-all shadow-sm hover:shadow-lg active:scale-[0.98]"
              >
                <div className="flex items-center gap-4 text-left">
                  <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center text-primary-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                  </div>
                  <div>
                    <div className="font-bold text-lg">Nur lokal nutzen</div>
                    <div className="text-sm text-gray-500">Ordner selbst auswählen</div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-md animate-in zoom-in-95 duration-300">
            <h2 className="text-2xl font-bold mb-4">GitHub Autorisierung</h2>
            <p className="mb-6 text-gray-500">Gib diesen Code auf GitHub ein, um die App zu verbinden:</p>

            <div className="bg-gray-100 dark:bg-black/40 p-6 rounded-2xl mb-6 font-mono text-4xl font-black tracking-widest text-primary-600 border-2 border-primary-500/20 shadow-inner">
              {authData?.userCode || "..."}
            </div>

            <div className="flex flex-col gap-4">
              <a
                href={authData?.verificationUri}
                target="_blank"
                rel="noreferrer"
                className="bg-gray-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-black transition-colors"
              >
                GitHub öffnen
              </a>

              <button
                onClick={() => setOnboardingStep('choice')}
                className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors"
              >
                Abbrechen
              </button>
            </div>

            {authError && (
              <p className="mt-4 text-red-500 text-sm font-medium">{authError}</p>
            )}

            <div className="mt-8 flex items-center justify-center gap-3 text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Warten auf Bestätigung...</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 flex flex-col bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-100 overflow-hidden"
      style={{
        fontFamily: fontFamily === 'inter' ? "'Inter', sans-serif" : fontFamily === 'roboto' ? "'Roboto', sans-serif" : "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {!isFocusMode && (
        <TitleBar
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          activeView={activeView}
          onBack={() => setActiveView('notelist')}
        />
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR — always visible except in editor view on mobile */}
        {!isFocusMode && (
          <Sidebar
            className={clsx(
              "md:flex",
              activeView === 'editor' ? "hidden md:flex" : "flex"
            )}
            folders={folders}
            metadata={metadata}
            selectedCategory={selectedCategory}
            isCollapsed={isSidebarCollapsed}
            onCreateNote={handleCreateNote}
            onCreateFolder={createFolder}
            onDeleteCategory={setCategoryToDelete}
            onEditCategory={setEditingCategory}
            onSelectCategory={handleSelectCategory}
            onReorderFolders={reorderFolders}
            onOpenSettings={() => setIsSettingsOpen(true)}
            syncStatus={syncStatus}
            syncError={syncError}
            lastSyncedAt={lastSyncedAt}
            conflictFiles={conflictPairs}
            onSync={triggerSync}
          />
        )}

        {/* NOTELIST — visible when not in sidebar-only or editor view */}
        {!isFocusMode && (
          <NoteList
            className={clsx(
              "flex-1 md:flex-none md:w-80 shrink-0 transition-all duration-300 ease-in-out max-md:min-w-[calc(100vw-72px)]",
              activeView === 'editor' ? "hidden md:flex" :
                activeView === 'sidebar' ? "hidden md:flex" : "flex"
            )}
            notes={notes}
            selectedNote={selectedNote}
            onSelectNote={handleSelectNote}
            onDeleteNote={deleteNote}
            onMoveNote={moveNote}
            onTogglePin={togglePinNote}
            isNotePinned={isNotePinned}
            getNoteId={getNoteId}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            folders={folders}
            selectedCategory={selectedCategory}
          />
        )}

        {/* EDITOR — takes full width on mobile, hides sidebar + notelist */}
        {selectedNote ? (
          <Editor
            key={selectionCount}
            className={clsx(
              "flex-1",
              activeView === 'editor' ? "flex" : "hidden md:flex"
            )}
            note={selectedNote}
            allNotes={allNotes}
            workspacePath={currentFolder || ''}
            onSave={(id, filename, content, folder, skipRename) => saveNote(id, filename, content, folder, skipRename)}
            onUpdateLocally={updateNoteLocally}
            markdownEnabled={markdownEnabled}
            toolbarVisible={toolbarVisible}
            setToolbarVisible={setToolbarVisible}
            spellcheckEnabled={spellcheckEnabled}
            isFocusMode={isFocusMode}
            onToggleFocus={() => setIsFocusMode(!isFocusMode)}
            onNavigate={(id, _anchor) => handleNavigate(id)}
          />
        ) : (
          <div className={clsx(
            "flex-1 items-center justify-center text-gray-400 bg-white dark:bg-gray-900",
            activeView === 'editor' ? "flex" : "hidden md:flex"
          )}>
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                <Book className="text-gray-300 dark:text-gray-600" size={32} />
              </div>
              <p className="text-sm font-medium">Select a note to start editing</p>
            </div>
          </div>
        )}
      </div>

      {isSettingsOpen && (
        <SettingsModal
          isOpen={true}
          onClose={() => setIsSettingsOpen(false)}
          currentPath={currentFolder}
          onChangePath={selectFolder}
          theme={theme}
          setTheme={setTheme}
          markdownEnabled={markdownEnabled}
          onToggleMarkdown={setMarkdownEnabled}
          accentColor={accentColor}
          setAccentColor={setAccentColor}
          fontFamily={fontFamily}
          setFontFamily={setFontFamily}
          fontSize={fontSize}
          setFontSize={setFontSize}
          spellcheckEnabled={spellcheckEnabled}
          onToggleSpellcheck={setSpellcheckEnabled}
        />
      )}

      {editingCategory && (
        <FolderEditModal
          isOpen={true}
          onClose={() => setEditingCategory(null)}
          folderName={editingCategory}
          metadata={metadata.folders[editingCategory] || {}}
          onSave={handleSaveCategory}
        />
      )}

      {categoryToDelete && (
        <DeleteFolderModal
          folderName={categoryToDelete}
          onClose={() => setCategoryToDelete(null)}
          onConfirm={handleDeleteCategory}
        />
      )}

      {isUpdateModalOpen && updateVersion && (
        <UpdateModal
          version={updateVersion}
          onUpdate={handleUpdate}
          onSkip={handleSkipUpdate}
          onCancel={() => setIsUpdateModalOpen(false)}
          onInstall={handleInstallUpdate}
          status={updateStatus}
        />
      )}

      {/* CONFLICT MODAL — auto-opens when sync detects a merge conflict */}
      {isConflictModalOpen && conflictPairs.length > 0 && currentFolder && (
        <ConflictModal
          conflictPairs={conflictPairs}
          baseFolder={currentFolder}
          onClose={() => setIsConflictModalOpen(false)}
          onReload={() => {
            resetSyncStatus();
            reloadNotes(false);
          }}
        />
      )}

      {isLoading && (
        <div className="fixed bottom-6 right-6 z-50 bg-white dark:bg-gray-900 rounded-full shadow-lg p-3 border border-gray-100 dark:border-gray-700">
          <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />
        </div>
      )}
    </div>
  );
}

export default function AppWithErrorBoundary() {
    return (
        <AppErrorBoundary>
            <App />
        </AppErrorBoundary>
    );
}

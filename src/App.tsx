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
import { OnboardingScreen } from './components/OnboardingScreen';
import { useNotes } from './hooks/useNotes';
import { useSettings } from './hooks/useSettings';
import { useTheme } from './hooks/useTheme';
// import { QuickNote } from './components/QuickNote';
import type { Note } from './types';
import { Loader2, Book } from 'lucide-react';
import clsx from 'clsx';
import { platform } from '@tauri-apps/plugin-os';
import { getCurrentWindow } from '@tauri-apps/api/window';

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
    reloadNotes,
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

  if (!currentFolder) {
    return (
      <OnboardingScreen
        onSelectFolder={selectFolder}
        onSetupWorkspace={async () => { await setupDefaultWorkspace(true); }}
      />
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
          onTriggerSync={triggerSync}
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

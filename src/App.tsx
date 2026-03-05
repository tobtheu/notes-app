import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { NoteList } from './components/NoteList';
import { Editor } from './components/Editor';
import { SettingsModal } from './components/SettingsModal';
import { DeleteFolderModal } from './components/DeleteFolderModal';
import { UpdateModal } from './components/UpdateModal';
import { ConflictModal } from './components/ConflictModal';
import { useNotes } from './hooks/useNotes';
import { useSettings } from './hooks/useSettings';
import { useTheme } from './hooks/useTheme';
import type { Note } from './types';
import { Loader2, Book } from 'lucide-react';
import clsx from 'clsx';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

function App() {
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
    renameFolder: _renameFolder,
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
    isSyncing,
    syncStatus,
    lastSyncedAt,
    conflictPairs,
  } = useNotes();

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
  const [activeView, setActiveView] = useState<'sidebar' | 'notelist' | 'editor'>('notelist');

  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
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
    setSelectedNote(getNoteId(note));
    setActiveView('editor');
  };

  const handleDeleteCategory = async () => {
    if (categoryToDelete) {
      await deleteFolder(categoryToDelete, 'recursive');
      setCategoryToDelete(null);
    }
  };

  if (!currentFolder) {
    return (
      <div className="flex flex-col items-center justify-center fixed inset-0 bg-gray-50 text-gray-800 dark:bg-gray-900 dark:text-gray-100 p-6 text-center">
        <div className="w-20 h-20 bg-primary-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-primary-500/20">
          <span className="text-4xl text-white">📝</span>
        </div>
        <h1 className="text-3xl font-bold mb-2">Welcome to NotizApp</h1>
        <p className="mb-8 text-gray-500 dark:text-gray-400 max-w-sm">
          Manage your thoughts in markdown. Select a folder to get started.
        </p>
        <button
          onClick={selectFolder}
          className="px-8 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all font-semibold shadow-md active:scale-95"
        >
          Select Workspace Folder
        </button>
      </div>
    );
  }

  return (
    <div
      className="h-full flex bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-100 overflow-hidden"
      style={{
        fontFamily: fontFamily === 'inter' ? "'Inter', sans-serif" : fontFamily === 'roboto' ? "'Roboto', sans-serif" : "ui-sans-serif, system-ui, sans-serif"
      }}
    >
      {/* SIDEBAR — always visible except in editor view on mobile */}
      <Sidebar
        className={clsx(
          "md:flex",
          activeView === 'editor' ? "hidden md:flex" : "flex"
        )}
        folders={folders}
        metadata={metadata}
        selectedCategory={selectedCategory}
        isCollapsed={isSidebarCollapsed}
        onCreateNote={createNote}
        onCreateFolder={createFolder}
        onDeleteCategory={setCategoryToDelete}
        onEditCategory={() => { }}
        onSelectCategory={handleSelectCategory}
        onReorderFolders={reorderFolders}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        conflictFiles={conflictPairs}
        onSync={triggerSync}
      />

      {/* NOTELIST — visible when not in sidebar-only or editor view */}
      <NoteList
        className={clsx(
          "md:flex md:w-80 shrink-0 border-r border-gray-100 dark:border-gray-800",
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
        onBack={() => setActiveView('sidebar')}
      />

      {/* EDITOR — takes full width on mobile, hides sidebar + notelist */}
      {selectedNote ? (
        <Editor
          className={clsx(
            "flex-1",
            activeView === 'editor' ? "flex" : "hidden md:flex"
          )}
          note={selectedNote}
          allNotes={allNotes}
          onSave={(filename, content, folder) => saveNote(filename, content, folder)}
          onUpdateLocally={updateNoteLocally}
          onBack={() => setActiveView('notelist')}
          markdownEnabled={markdownEnabled}
          toolbarVisible={toolbarVisible}
          setToolbarVisible={setToolbarVisible}
          spellcheckEnabled={spellcheckEnabled}
          onNavigate={(id, _anchor) => setSelectedNote(id)}
          onSync={triggerSync}
          isSyncing={isSyncing}
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
          onReload={() => triggerSync()}
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

export default App;

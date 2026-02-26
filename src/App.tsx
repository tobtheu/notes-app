import { useState, useEffect, useCallback, useRef } from 'react';
import { useNotes } from './hooks/useNotes';
import { Sidebar } from './components/Sidebar';
import { NoteList } from './components/NoteList';
import { Editor } from './components/Editor';
import { SettingsModal } from './components/SettingsModal';
import { DeleteFolderModal } from './components/DeleteFolderModal';
import { useTheme } from './hooks/useTheme';
import { useSettings } from './hooks/useSettings';
import { FolderEditModal } from './components/FolderEditModal';
import type { Note, FolderMetadata } from './types';
import { Folder } from 'lucide-react';
import { UpdateModal } from './components/UpdateModal';

function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [categoryToEdit, setCategoryToEdit] = useState<string | null>(null);
  const [pendingAnchor, setPendingAnchor] = useState<string | null>(null);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<{
    type: 'idle' | 'available' | 'downloading' | 'downloaded' | 'error';
    progress?: number;
    error?: string;
    version?: string;
  }>({ type: 'idle' });

  const { theme, setTheme } = useTheme();


  const {
    currentFolder,
    notes,
    allNotes, // allNotes is already destructured here
    folders,
    metadata,
    selectedNote,
    setSelectedNote,
    selectedCategory,
    setSelectedCategory,
    searchTerm,
    setSearchTerm,
    selectFolder,
    saveNote,
    updateNoteLocally,
    createNote,
    deleteNote,
    createFolder,
    renameFolder,
    updateFolderMetadata,
    saveSettings,
    deleteFolder,
    reorderFolders,
    moveNote,
    togglePinNote,
    isNotePinned,
    getNoteId,
  } = useNotes();

  const {
    markdownEnabled, setMarkdownEnabled,
    accentColor, setAccentColor,
    fontFamily, setFontFamily,
    fontSize, setFontSize,
    toolbarVisible, setToolbarVisible,
    spellcheckEnabled, setSpellcheckEnabled
  } = useSettings(metadata.settings, saveSettings);

  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accentColor);
  }, [accentColor]);

  useEffect(() => {
    document.documentElement.style.fontSize = fontSize === 'small' ? '14px' : fontSize === 'large' ? '18px' : '16px';
  }, [fontSize]);

  const allNotesRef = useRef(allNotes);
  useEffect(() => {
    allNotesRef.current = allNotes;
  }, [allNotes]);

  const handleNavigate = useCallback((id: string, anchor?: string) => {
    console.log('handleNavigate called:', { id, anchor });
    if (id) {
      // Find note by ID (lowercase path)
      const note = allNotesRef.current.find((n: Note) => getNoteId(n) === id.toLowerCase());
      if (note) {
        setSelectedNote(getNoteId(note));
        if (anchor) setPendingAnchor(anchor);
      }
    } else if (anchor) {
      // Internal anchor scroll
      const element = document.getElementById(anchor);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [getNoteId, setSelectedNote]);

  // Effect to handle pending anchor scrolling after editor loads
  useEffect(() => {
    if (pendingAnchor && selectedNote) { // Use selectedNote directly
      // Short delay to ensure editor has rendered the content
      const timer = setTimeout(() => {
        const element = document.getElementById(pendingAnchor);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
          setPendingAnchor(null);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [selectedNote, pendingAnchor]);

  // Handle auto-updates
  useEffect(() => {
    const removeListener = window.electronAPI.onUpdateStatus((status: any) => {
      setUpdateStatus(status);
      if (status.type === 'available') {
        const skippedVersion = localStorage.getItem('skipped-update-version');
        if (skippedVersion !== status.version) {
          setUpdateVersion(status.version);
          setIsUpdateModalOpen(true);
        }
      }
    });

    // Initial check on mount
    window.electronAPI.checkForUpdates();

    return () => {
      if (typeof removeListener === 'function') removeListener();
    };
  }, []);

  const handleUpdate = () => {
    window.electronAPI.downloadUpdate();
    // Do not close modal, status will update to 'downloading'
  };

  const handleInstallUpdate = () => {
    window.electronAPI.quitAndInstall();
  };

  const handleSkipUpdate = () => {
    if (updateVersion) {
      localStorage.setItem('skipped-update-version', updateVersion);
    }
    setIsUpdateModalOpen(false);
  };


  if (!currentFolder) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 text-gray-800 dark:bg-gray-900 dark:text-gray-100 p-6 text-center">
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

  const handleDeleteCategory = (mode: 'recursive' | 'move') => {
    if (categoryToDelete) {
      deleteFolder(categoryToDelete, mode);
      setCategoryToDelete(null);
    }
  };

  const handleEditCategory = async (newName: string, meta: FolderMetadata) => {
    if (!categoryToEdit) return;

    // Rename if name changed
    if (newName !== categoryToEdit) {
      const result = await renameFolder(categoryToEdit, newName);
      if (!result?.success) return; // Error handled in renameFolder
    }

    // Update metadata (icon/color)
    await updateFolderMetadata(newName, meta);
    setCategoryToEdit(null);
  };



  return (
    <div
      className="flex h-screen w-full bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-100 overflow-hidden"
      style={{ fontFamily: fontFamily === 'inter' ? "'Inter', sans-serif" : fontFamily === 'roboto' ? "'Roboto', sans-serif" : "ui-sans-serif, system-ui, sans-serif" }}
    >
      <Sidebar
        folders={folders}
        metadata={metadata}
        selectedCategory={selectedCategory}
        isCollapsed={isSidebarCollapsed}
        onCreateNote={createNote}
        onCreateFolder={createFolder}
        onDeleteCategory={setCategoryToDelete}
        onEditCategory={setCategoryToEdit}
        onSelectCategory={setSelectedCategory}
        onReorderFolders={reorderFolders}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <NoteList
        className="w-80 flex-shrink-0 border-r border-gray-100 dark:border-gray-800"
        notes={notes}
        folders={folders}
        selectedNote={selectedNote}
        onSelectNote={(note) => {
          setSelectedNote(getNoteId(note));
        }}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onDeleteNote={deleteNote}
        onMoveNote={moveNote}
        onTogglePin={togglePinNote}
        isNotePinned={isNotePinned}
        getNoteId={getNoteId}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {selectedNote ? (
          <Editor
            note={selectedNote}
            allNotes={allNotes}
            onSave={saveNote}
            onUpdateLocally={updateNoteLocally}
            onNavigate={handleNavigate}
            markdownEnabled={markdownEnabled}
            spellcheckEnabled={spellcheckEnabled}
            toolbarVisible={toolbarVisible}
            setToolbarVisible={setToolbarVisible}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-400 p-8 text-center animate-in fade-in duration-500">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <Folder size={32} />
            </div>
            <h2 className="text-xl font-medium text-gray-600 dark:text-gray-300 mb-1">No Note Selected</h2>
            <p className="text-sm">Select a note from the list or create a new one to start writing.</p>
          </div>
        )}
      </div>

      <FolderEditModal
        isOpen={!!categoryToEdit}
        onClose={() => setCategoryToEdit(null)}
        folderName={categoryToEdit || ""}
        metadata={categoryToEdit ? (metadata.folders[categoryToEdit] || {}) : {}}
        onSave={handleEditCategory}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
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
    </div>
  );
}

export default App;

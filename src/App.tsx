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
import { Folder, Loader2 } from 'lucide-react';
import { UpdateModal } from './components/UpdateModal';
import clsx from 'clsx';
import type { Note, FolderMetadata } from './types';

const normalizeStr = (s: string) => s.normalize('NFC').toLowerCase();

/**
 * App.tsx - Main Application Component
 * Manages core layout, responsive views, and integration of logic hooks.
 */
function App() {
  /**
   * --- STATE & CONFIGURATION ---
   */

  // Sidebar Collapse state
  // Configuration Point: Default behavior collapses sidebar when window width < 1024px
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return window.innerWidth < 1024;
  });

  // Automated sidebar behavior on window resize
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      // Configuration Point: Breakpoints for automatic layout shifts
      if (width < 1024 && !isSidebarCollapsed) {
        setIsSidebarCollapsed(true);
      } else if (width >= 1024 && isSidebarCollapsed) {
        setIsSidebarCollapsed(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isSidebarCollapsed]);

  // Modal & Popup States
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [categoryToEdit, setCategoryToEdit] = useState<string | null>(null);
  // Navigation & Update System
  const [pendingAnchor, setPendingAnchor] = useState<string | null>(null);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<{
    type: 'idle' | 'available' | 'downloading' | 'downloaded' | 'error';
    progress?: number;
    error?: string;
    version?: string;
  }>({ type: 'idle' });

  // Mobile View Management
  // 'sidebar/notelist' (default): Shows combined view (collapsed sidebar + note list)
  // 'editor': Shows only the editor in full screen on mobile
  const [activeView, setActiveView] = useState<'sidebar' | 'notelist' | 'editor'>('sidebar');

  /**
   * --- HOOKS (Logic & Data Layer) ---
   */

  const { theme, setTheme } = useTheme();

  // Central hook for file system operations, note management and metadata
  const {
    currentFolder,
    notes,
    allNotes,
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
    isLoading,
  } = useNotes();

  // User preference management (Colors, Markdown, Typography)
  const {
    markdownEnabled, setMarkdownEnabled,
    accentColor, setAccentColor,
    fontFamily, setFontFamily,
    fontSize, setFontSize,
    toolbarVisible, setToolbarVisible,
    spellcheckEnabled, setSpellcheckEnabled
  } = useSettings(metadata.settings, saveSettings);

  /**
   * --- SIDE EFFECTS ---
   */

  // Global application of appearance settings
  // Configuration Point: Design tokens are applied to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accentColor);
  }, [accentColor]);

  useEffect(() => {
    // Configuration Point: Font size mappings for accessibility
    document.documentElement.style.fontSize = fontSize === 'small' ? '14px' : fontSize === 'large' ? '18px' : '16px';
  }, [fontSize]);

  // Ref maintenance for navigation reference consistency
  const allNotesRef = useRef(allNotes);
  useEffect(() => {
    allNotesRef.current = allNotes;
  }, [allNotes]);

  /**
   * --- HANDLERS ---
   */

  // Logic for navigating between notes (e.g., via Wiki-links [[Note Name]])
  const handleNavigate = useCallback((id: string, anchor?: string) => {
    if (id) {
      const note = allNotesRef.current.find((n: Note) => getNoteId(n) === id.toLowerCase());
      if (note) {
        setSelectedNote(getNoteId(note));
        if (anchor) setPendingAnchor(anchor);
      }
    } else if (anchor) {
      const element = document.getElementById(anchor);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [getNoteId, setSelectedNote]);

  // Handles deep-linking/scrolling to anchors after a note content has loaded
  useEffect(() => {
    if (pendingAnchor && selectedNote) {
      const timer = setTimeout(() => {
        const element = document.getElementById(pendingAnchor);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
          setPendingAnchor(null);
        }
      }, 500); // Configuration Point: Scroll delay to ensure DOM is ready
      return () => clearTimeout(timer);
    }
  }, [selectedNote, pendingAnchor]);

  // Auto-Update integration via Tauri API
  useEffect(() => {
    const removeListener = window.tauriAPI.onUpdateStatus((status: any) => {
      setUpdateStatus(status);
      if (status.type === 'available') {
        const skippedVersion = localStorage.getItem('skipped-update-version');
        if (skippedVersion !== status.version) {
          setUpdateVersion(status.version);
          setIsUpdateModalOpen(true);
        }
      }
    });

    window.tauriAPI.checkForUpdates();
    return () => { if (typeof removeListener === 'function') removeListener(); };
  }, []);

  const handleUpdate = () => {
    window.tauriAPI.downloadUpdate();
  };

  const handleInstallUpdate = () => {
    window.tauriAPI.quitAndInstall();
  };

  const handleSkipUpdate = () => {
    if (updateVersion) {
      localStorage.setItem('skipped-update-version', updateVersion);
    }
    setIsUpdateModalOpen(false);
  };

  const handleDeleteCategory = (mode: 'recursive' | 'move') => {
    if (categoryToDelete) {
      deleteFolder(categoryToDelete, mode);
      setCategoryToDelete(null);
    }
  };

  const handleEditCategory = async (newName: string, meta: FolderMetadata) => {
    if (!categoryToEdit) return;

    let targetName = categoryToEdit;

    if (newName !== categoryToEdit) {
      const result = await renameFolder(categoryToEdit, newName);
      if (result?.success) {
        targetName = newName;
        setCategoryToEdit(prev => prev ? newName : null);
      } else {
        return;
      }
    }

    await updateFolderMetadata(targetName, meta);
  };

  const handleSelectCategory = (category: string | null) => {
    setSelectedCategory(category);
    setActiveView('notelist'); // Switch view for mobile responsiveness
  };

  const handleSelectNote = (noteId: string) => {
    setSelectedNote(noteId);
    setActiveView('editor'); // Switch to editor focus for mobile responsiveness
  };

  /**
   * --- RENDER LAYER ---
   */

  if (!currentFolder) {
    // Welcome Screen when no workspace folder is selected
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

  return (
    <div
      className="flex h-screen w-full bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-100 overflow-hidden"
      style={{ fontFamily: fontFamily === 'inter' ? "'Inter', sans-serif" : fontFamily === 'roboto' ? "'Roboto', sans-serif" : "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* 
          COLUMN 1: SIDEBAR (NAVIGATION)
          Responsiveness:
          - Desktop (md:flex): Always present.
          - Mobile: Visible in combined mode, hidden when editor is focused.
      */}
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
        onEditCategory={setCategoryToEdit}
        onSelectCategory={handleSelectCategory}
        onReorderFolders={reorderFolders}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* 
          COLUMN 2: NOTE LIST
          Responsiveness: Sibling to Sidebar
          Configuration Point: Fixed desktop width 'md:w-80' (320px)
      */}
      <NoteList
        className={clsx(
          "flex-shrink-0 border-r border-gray-100 dark:border-gray-800 md:flex md:w-80",
          activeView === 'editor' ? "hidden md:flex" : "flex-1 md:flex-initial"
        )}
        notes={notes}
        folders={folders}
        selectedNote={selectedNote}
        selectedCategory={selectedCategory}
        onSelectNote={(note) => handleSelectNote(getNoteId(note))}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onDeleteNote={deleteNote}
        onMoveNote={moveNote}
        onTogglePin={togglePinNote}
        isNotePinned={isNotePinned}
        getNoteId={getNoteId}
      />

      {/* 
          COLUMN 3: EDITOR (CONTENT)
          Responsiveness:
          - Desktop: Occupies remaining space.
          - Mobile: Full screen when focused.
      */}
      <div className={clsx(
        "flex-1 flex flex-col h-full overflow-hidden md:flex",
        activeView === 'editor' ? "flex w-full" : "hidden"
      )}>
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
            onBack={() => setActiveView('notelist')}
          />
        ) : (
          // Default state when no note is active
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-400 p-8 text-center animate-in fade-in duration-500">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <Folder size={32} />
            </div>
            <h2 className="text-xl font-medium text-gray-600 dark:text-gray-300 mb-1">No Note Selected</h2>
            <p className="text-sm">Select a note from the list or create a new one to start writing.</p>
          </div>
        )}
      </div>

      {/** MODALS & OVERLAYS **/}

      <FolderEditModal
        isOpen={!!categoryToEdit}
        onClose={() => setCategoryToEdit(null)}
        folderName={categoryToEdit || ""}
        metadata={categoryToEdit ? (metadata.folders[Object.keys(metadata.folders).find(k => normalizeStr(k) === normalizeStr(categoryToEdit)) || categoryToEdit] || {}) : {}}
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
      {isLoading && (
        <div className="fixed bottom-6 right-6 z-50 bg-white dark:bg-gray-800 rounded-full shadow-lg p-3 border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in duration-300">
          <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />
        </div>
      )}
    </div>
  );
}

export default App;

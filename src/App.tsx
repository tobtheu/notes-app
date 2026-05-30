import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { NoteList } from './components/NoteList';
import { Editor } from './components/Editor';
import { MobileSwipeContainer } from './components/MobileSwipeContainer';
import { TitleBar } from './components/TitleBar';
import { SettingsModal } from './components/SettingsModal';
import { DeleteFolderModal } from './components/DeleteFolderModal';
import { UpdateModal } from './components/UpdateModal';
import { FolderEditModal } from './components/FolderEditModal';
import { OnboardingScreen } from './components/OnboardingScreen';
import { useNotes } from './hooks/useNotes';
import { useSettings } from './hooks/useSettings';
import { useTheme } from './hooks/useTheme';
import { getDb } from './lib/electric';
import type { Note } from './types';
import { Loader2, Book } from 'lucide-react';
import clsx from 'clsx';
import { platform } from '@tauri-apps/plugin-os';
import { getCurrentWindow } from '@tauri-apps/api/window';

import { initGlobalHandlers } from './utils/initGlobalHandlers';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { PGliteWrapper } from './components/PGliteWrapper';
import { useSidebarGestures } from './hooks/useSidebarGestures';
import { useTauriUpdater } from './hooks/useTauriUpdater';
import { useViewport } from './hooks/useViewport';

const appWindow = getCurrentWindow();

// Kick off PGlite init immediately at module load time so it's ready
void getDb();

// Setup global error and helper window methods
initGlobalHandlers();

function App() {
  const isQuickNote = appWindow.label === 'quick-note';
  const {
    userId,
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
    hasPending,
    setupDefaultWorkspace,
    changeFolder,
    signIn,
    signUp,
    signOut,
    deleteAccount,
    userEmail,
    importFolder,
    goLocalOnly,
  } = useNotes();

  // If this Webview is the Quick Note window, display only the QuickNote component rather than the full app.
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
    setToolbarVisible,
    landscapeFullscreen,
    setLandscapeFullscreen,
    monochromeIcons,
    setMonochromeIcons,
  } = useSettings(metadata.settings, () => {});

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  useEffect(() => { if (syncStatus === 'unauthenticated') setIsSettingsOpen(false); }, [syncStatus]);
  const [isIOS, setIsIOS] = useState(false);
  useEffect(() => { try { setIsIOS(platform() === 'ios'); } catch { } }, []);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => window.innerWidth < 768);
  const [isFocusMode, setIsFocusMode] = useState(false);

  // Tauri updater hook logic
  const {
    isUpdateModalOpen,
    setIsUpdateModalOpen,
    updateVersion,
    updateStatus,
    handleUpdate,
    handleInstallUpdate,
    handleSkipUpdate,
  } = useTauriUpdater();

  // Viewport custom hook logic
  const {
    isMobile: _isMobile,
    isLandscape,
  } = useViewport(isSidebarCollapsed, setIsSidebarCollapsed);

  // Sidebar gestures logic
  const [activeView, setActiveView] = useState<'sidebar' | 'notelist' | 'editor'>('notelist');
  const {
    containerRef,
    sidebarRef,
  } = useSidebarGestures({
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    activeView,
    isFocusMode,
  });

  const [selectionCount, setSelectionCount] = useState(0);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);

  // Hide native iOS toolbar accessory bar whenever the user leaves the editor view
  useEffect(() => {
    if (isIOS && activeView !== 'editor') {
      (window as any).webkit?.messageHandlers?.toolbarVisible?.postMessage(false);
    }
  }, [isIOS, activeView]);

  const { theme, setTheme } = useTheme();

  // Apply font size to <html> so all rem-based Tailwind classes scale with it
  useEffect(() => {
    const px = fontSize === 'small' ? '14px' : fontSize === 'large' ? '18px' : '16px';
    document.documentElement.style.fontSize = px;
  }, [fontSize]);

  // Apply accent color to document root for CSS variable overrides
  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accentColor);
  }, [accentColor]);

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
      setEditingCategory(prev => prev === oldName ? newName : prev);
    }

    // 2. Update visual meta (icon, color)
    await updateFolderMetadata(newName, folderMeta);
  };

  const handleDeleteCategory = async (mode: 'recursive' | 'move') => {
    if (categoryToDelete) {
      await deleteFolder(categoryToDelete, mode);
      setCategoryToDelete(null);
    }
  };

  if (!currentFolder || syncStatus === 'unauthenticated') {
    return (
      <OnboardingScreen
        onSelectFolder={selectFolder}
        onSetupWorkspace={async () => { await setupDefaultWorkspace(true); }}
        onSignIn={signIn}
        onSignUp={signUp}
        onLocalOnly={goLocalOnly}
      />
    );
  }

  const sharedSidebarProps = {
    folders,
    metadata,
    selectedCategory,
    isCollapsed: isSidebarCollapsed,
    onCreateNote: handleCreateNote,
    onCreateFolder: createFolder,
    onDeleteCategory: setCategoryToDelete,
    onEditCategory: setEditingCategory,
    onSelectCategory: handleSelectCategory,
    onReorderFolders: reorderFolders,
    onOpenSettings: () => setIsSettingsOpen(true),
    monochromeIcons,
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 flex text-gray-700 dark:text-gray-100 overflow-hidden transition-colors duration-500"
      style={{
        backgroundColor: 'var(--app-bg)',
        fontFamily: fontFamily === 'inter' ? "'Inter', sans-serif" : fontFamily === 'roboto' ? "'Roboto', sans-serif" : "ui-sans-serif, system-ui, sans-serif",
        flexDirection: isIOS ? 'row' : 'column',
        borderRadius: '12px',
      }}
    >
      <div
        id="app-background"
        className="flex-1 flex overflow-hidden w-full h-full"
        style={{
          flexDirection: isIOS ? 'row' : 'column',
        }}
      >
        {/* iOS only: Sidebar as first column spanning full height */}
        {isIOS && !isFocusMode && (
          <Sidebar
            sidebarRef={sidebarRef}
            className={clsx(
              "flex",
              activeView === 'editor' ? (_isMobile ? "flex" : (isLandscape && !landscapeFullscreen ? "flex" : "hidden")) : "flex"
            )}
            {...sharedSidebarProps}
            isIOS={isIOS}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
        )}

        {/* Right column (iOS) or full layout (desktop): TitleBar + content */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">

          {!isFocusMode && (
            <TitleBar
              isSidebarCollapsed={isSidebarCollapsed}
              onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              activeView={activeView}
              onBack={() => setActiveView('notelist')}
            />
          )}

          <div 
            className={clsx(
              "flex-1 flex overflow-hidden",
              _isMobile && "relative"
            )}
          >
            {/* Desktop sidebar inside content row */}
            {!isIOS && !isFocusMode && (
              <Sidebar
                sidebarRef={sidebarRef}
                className={clsx(
                  "md:flex",
                  activeView === 'editor' ? "hidden md:flex" : "flex"
                )}
                {...sharedSidebarProps}
              />
            )}

            {/* NOTELIST — visible when not in sidebar-only or editor view */}
            {!isFocusMode && (
              <NoteList
                className={clsx(
                  "flex-1 min-w-0 md:flex-none md:w-80 md:shrink-0 transition-all duration-300 ease-in-out",
                  activeView === 'editor' ? (isIOS && isLandscape && !landscapeFullscreen ? "flex" : "flex") :
                    activeView === 'sidebar' ? "hidden md:flex" : "flex"
                )}
                notes={notes}
                selectedNote={activeView === 'editor' ? selectedNote : null}
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
                isIOS={isIOS}
              />
            )}

            {/* EDITOR — on desktop, it is rendered inline */}
            {selectedNote && !_isMobile && (
              <Editor
                key={selectionCount}
                className={clsx(
                  "flex-1",
                  activeView === 'editor' ? "flex" : "hidden md:flex"
                )}
                note={selectedNote}
                allNotes={allNotes}
                workspacePath={currentFolder || ''}
                imageCloudSync={userId === 'local'}
                onSave={(id, filename, content, folder, skipRename) => saveNote(id, filename, content, folder, skipRename)}
                onUpdateLocally={updateNoteLocally}
                markdownEnabled={markdownEnabled}
                toolbarVisible={toolbarVisible}
                setToolbarVisible={setToolbarVisible}
                spellcheckEnabled={spellcheckEnabled}
                isFocusMode={isFocusMode}
                onToggleFocus={() => setIsFocusMode(!isFocusMode)}
                onSync={triggerSync}
                onNavigate={(id, _anchor) => handleNavigate(id)}
                isIOS={isIOS}
                iosLandscapeFullscreen={isIOS && isLandscape && landscapeFullscreen}
              />
            )}

            {!selectedNote && (
              <div className={clsx(
                "flex-1 items-center justify-center text-gray-400",
                activeView === 'editor' ? "flex" : "hidden md:flex"
              )} style={{ backgroundColor: 'var(--app-bg)' }}>
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                    <Book className="text-gray-300 dark:text-gray-600" size={32} />
                  </div>
                  <p className="text-sm font-medium">Select a note to start editing</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* EDITOR on mobile: floating overlay sibling */}
      {selectedNote && _isMobile && (
        <MobileSwipeContainer
          active={activeView === 'editor'}
          onBack={() => setActiveView('notelist')}
          className="flex-1 flex"
          isIOS={isIOS}
          isMobile={_isMobile}
        >
          <Editor
            key={selectionCount}
            className="flex-1 flex"
            note={selectedNote}
            allNotes={allNotes}
            workspacePath={currentFolder || ''}
            imageCloudSync={userId === 'local'}
            onSave={(id, filename, content, folder, skipRename) => saveNote(id, filename, content, folder, skipRename)}
            onUpdateLocally={updateNoteLocally}
            markdownEnabled={markdownEnabled}
            toolbarVisible={toolbarVisible}
            setToolbarVisible={setToolbarVisible}
            spellcheckEnabled={spellcheckEnabled}
            isFocusMode={isFocusMode}
            onToggleFocus={() => setIsFocusMode(!isFocusMode)}
            onSync={triggerSync}
            onNavigate={(id, _anchor) => handleNavigate(id)}
            isIOS={isIOS}
            iosLandscapeFullscreen={isIOS && isLandscape && landscapeFullscreen}
          />
        </MobileSwipeContainer>
      )}

      {isSettingsOpen && (
        <SettingsModal
          isOpen={true}
          onClose={() => setIsSettingsOpen(false)}
          isIOS={isIOS}
          currentPath={currentFolder}
          onChangePath={changeFolder}
          theme={theme}
          setTheme={setTheme}
          markdownEnabled={markdownEnabled}
          onToggleMarkdown={setMarkdownEnabled}
          accentColor={accentColor}
          setAccentColor={setAccentColor}
          monochromeIcons={monochromeIcons}
          onToggleMonochromeIcons={setMonochromeIcons}
          fontFamily={fontFamily}
          setFontFamily={setFontFamily}
          fontSize={fontSize}
          setFontSize={setFontSize}
          spellcheckEnabled={spellcheckEnabled}
          onToggleSpellcheck={setSpellcheckEnabled}
          landscapeFullscreen={landscapeFullscreen}
          onToggleLandscapeFullscreen={setLandscapeFullscreen}
          syncStatus={syncStatus}
          hasPending={hasPending}
          userEmail={userEmail}
          onSignIn={signIn}
          onSignUp={signUp}
          onSignOut={signOut}
          onDeleteAccount={deleteAccount}
          onImportFolder={isIOS ? undefined : importFolder}
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
      <PGliteWrapper>
        <App />
      </PGliteWrapper>
    </AppErrorBoundary>
  );
}

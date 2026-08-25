import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { NoteList } from './components/NoteList';
import { Editor } from './components/Editor';
import { MobileSwipeContainer } from './components/MobileSwipeContainer';
import { TitleBar } from './components/TitleBar';
import { EmptyStateTutorial } from './components/EmptyStateTutorial';
import { OnboardingScreen } from './components/OnboardingScreen';
import { AppModals } from './components/AppModals';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { PGliteWrapper } from './components/PGliteWrapper';

import { useNotes } from './hooks/useNotes';
import { useSettings } from './hooks/useSettings';
import { useTheme } from './hooks/useTheme';
import { useSessionExpiryHandler } from './hooks/useSessionExpiryHandler';
import { useSidebarGestures } from './hooks/useSidebarGestures';
import { useTauriUpdater } from './hooks/useTauriUpdater';
import { useViewport } from './hooks/useViewport';
import { usePlatformInfo } from './hooks/usePlatformInfo';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';

import { getDb } from './lib/electric';
import type { Note, FolderMetadata } from './types';
import clsx from 'clsx';
import { initGlobalHandlers } from './utils/initGlobalHandlers';

// Kick off PGlite init immediately at module load time so it's ready
void getDb();

// Setup global error and helper window methods
initGlobalHandlers();

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
    renameFolder,
    updateFolderMetadata,
    reorderFolders,
    saveSettings,
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
    hasPending,
    setupDefaultWorkspace,
    signIn,
    signUp,
    signOut,
    deleteAccount,
    userId,
    userEmail,
    importFolder,
    importFiles,
    exportBackup,
    resetDatabase,
    goLocalOnly,
    trashNotes,
    restoreNote,
    permanentlyDeleteNote,
    emptyTrash,
  } = useNotes();

  const {
    theme: syncTheme,
    setTheme: setSyncTheme,
    autoTheme: syncAutoTheme,
    setAutoTheme: setSyncAutoTheme,
    preferredLightTheme: syncPrefLight,
    setPreferredLightTheme: setSyncPrefLight,
    markdownEnabled,
    setMarkdownEnabled,
    accentColor,
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
    showIconsWhenCollapsed,
    setShowIconsWhenCollapsed,
    showNoteCounts,
    setShowNoteCounts,
  } = useSettings(metadata.settings, saveSettings);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  useEffect(() => { if (syncStatus === 'unauthenticated') setIsSettingsOpen(false); }, [syncStatus]);

  useSessionExpiryHandler({
    syncStatus,
    syncError,
    signOut,
    setIsSettingsOpen,
  });

  const { isIOS, isWindows } = usePlatformInfo();
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => window.innerWidth < 768);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [activeView, setActiveView] = useState<'sidebar' | 'notelist' | 'editor'>('notelist');

  // Tauri updater hook
  const {
    isUpdateModalOpen,
    setIsUpdateModalOpen,
    updateVersion,
    updateStatus,
    handleUpdate,
    handleInstallUpdate,
    handleSkipUpdate,
  } = useTauriUpdater();

  // Viewport hook
  const {
    isMobile: _isMobile,
    isLandscape,
    isMaximized,
  } = useViewport(isSidebarCollapsed, setIsSidebarCollapsed);

  // Sidebar gestures
  const {
    containerRef,
    sidebarRef,
  } = useSidebarGestures({
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    activeView,
    isFocusMode,
  });

  // Hide native iOS toolbar accessory bar whenever the user leaves the editor view
  useEffect(() => {
    if (isIOS && activeView !== 'editor') {
      window.webkit?.messageHandlers?.toolbarVisible?.postMessage(false);
    }
  }, [isIOS, activeView]);

  const { theme, setTheme, autoTheme, setAutoTheme, preferredLightTheme } = useTheme({
    theme: syncTheme,
    onThemeChange: setSyncTheme,
    autoTheme: syncAutoTheme,
    onAutoThemeChange: setSyncAutoTheme,
    preferredLightTheme: syncPrefLight,
    onPreferredLightThemeChange: setSyncPrefLight,
  });

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
    window.__noteOpenStartTime = performance.now();
    setSelectedNote(getNoteId(note));
    setActiveView('editor');
  };

  const handleCreateNote = async () => {
    await createNote();
    setActiveView('editor');
  };

  // Global Keyboard Shortcuts
  useGlobalShortcuts({
    onCreateNote: handleCreateNote,
    onOpenSettings: () => setIsSettingsOpen(true),
    onToggleSidebar: () => setIsSidebarCollapsed(prev => !prev),
  });

  const handleNavigate = (id: string) => {
    setSelectedNote(id);
    setActiveView('editor');
  };

  const handleSaveCategory = (newName: string, folderMeta: FolderMetadata) => {
    if (editingCategory) {
      if (newName !== editingCategory) {
        renameFolder(editingCategory, newName);
      }
      updateFolderMetadata(newName, folderMeta);
      setEditingCategory(null);
    }
  };

  const handleDeleteCategory = async (mode: 'recursive' | 'move') => {
    if (categoryToDelete) {
      await deleteFolder(categoryToDelete, mode);
      setCategoryToDelete(null);
    }
  };

  if (!currentFolder || syncStatus === 'unauthenticated') {
    return (
      <div
        className={clsx(
          "absolute inset-0 flex flex-col overflow-hidden",
          !isMaximized && !isIOS && !_isMobile && !isWindows && "rounded-[12px] border border-[var(--border-subtle)]"
        )}
        style={{ backgroundColor: 'var(--app-bg)' }}
      >
        {!isIOS && (
          <TitleBar
            isSidebarCollapsed={true}
            onToggleCollapse={() => {}}
            activeView="notelist"
            onBack={() => {}}
            hideSidebarToggle={true}
          />
        )}
        <div className="flex-1 relative overflow-hidden">
          <OnboardingScreen
            onSelectFolder={selectFolder}
            onSetupWorkspace={async () => { await setupDefaultWorkspace(true); }}
            onSignIn={signIn}
            onSignUp={signUp}
            onLocalOnly={goLocalOnly}
          />
        </div>
      </div>
    );
  }

  const sharedSidebarProps = {
    folders,
    metadata,
    selectedCategory,
    isCollapsed: isSidebarCollapsed,
    allNotes,
    onCreateNote: handleCreateNote,
    onCreateFolder: createFolder,
    onDeleteCategory: setCategoryToDelete,
    onEditCategory: setEditingCategory,
    onSelectCategory: handleSelectCategory,
    onReorderFolders: reorderFolders,
    onOpenSettings: () => setIsSettingsOpen(true),
    monochromeIcons,
    showIconsWhenCollapsed,
    showNoteCounts,
    userId,
    userEmail,
    syncStatus,
    hasPending,
  };

  const isAnyModalOpen = isSettingsOpen || editingCategory !== null || categoryToDelete !== null || isUpdateModalOpen;

  const renderEditor = (extraClassName: string) => {
    if (!selectedNote) return null;
    return (
      <Editor
        className={extraClassName}
        note={selectedNote}
        allNotes={allNotes}
        workspacePath={currentFolder || ''}
        onSave={(id, filename, content, folder) => saveNote(id, filename, content, folder)}
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
    );
  };

  return (
    <div
      ref={containerRef}
      className={clsx(
        "absolute inset-0 flex text-[var(--text-main)] overflow-hidden transition-colors duration-500",
        !isMaximized && !isIOS && !_isMobile && !isWindows && "rounded-[12px] border border-[var(--border-subtle)]",
        fontFamily === 'inter' && "font-inter",
        fontFamily === 'roboto' && "font-roboto",
        fontFamily === 'courier' && "font-courier",
        fontFamily === 'sfmono' && "font-sfmono",
        fontFamily === 'serif' && "font-serif"
      )}
      style={{
        backgroundColor: 'var(--shell-bg)',
        flexDirection: isIOS ? 'row' : 'column',
      }}
    >
      <div
        id="app-background"
        className={clsx(
          "flex-1 flex overflow-hidden w-full h-full transition-[filter] duration-200",
          isAnyModalOpen && "filter blur-md pointer-events-none select-none"
        )}
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
              "flex-1 flex overflow-hidden pb-1.5 pr-1.5 pl-1.5",
              _isMobile && "relative pb-0 pr-0 pl-0"
            )}
          >
            {/* Desktop sidebar inside content row */}
            {!isIOS && (
              <Sidebar
                sidebarRef={sidebarRef}
                className={clsx(
                  "md:flex rounded-xl overflow-hidden transition-all duration-300",
                  (!isSidebarCollapsed || showIconsWhenCollapsed) ? "mr-1.5" : "mr-0",
                  activeView === 'editor' ? "hidden md:flex" : "flex"
                )}
                {...sharedSidebarProps}
              />
            )}

            {/* UNIFIED FLOATING CANVAS (NoteList + Editor in Unified Background) */}
            <section
              id="floating-canvas"
              className={clsx(
                "flex-1 bg-[var(--canvas-bg)] flex overflow-hidden relative transition-colors duration-500",
                !_isMobile && "rounded-[18px] shadow-sm border border-[var(--border-subtle)]"
              )}
            >
              {/* NOTELIST */}
              <NoteList
                className={clsx(
                  "flex-1 min-w-0 md:flex-none md:w-80 md:shrink-0 transition-all duration-300 ease-in-out border-r border-[var(--border-subtle)]",
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
                onCreateNote={handleCreateNote}
              />

              {/* EDITOR — desktop inline */}
              {selectedNote && !_isMobile && renderEditor(clsx(
                "flex-1",
                activeView === 'editor' ? "flex" : "hidden md:flex"
              ))}

              {!selectedNote && (
                <EmptyStateTutorial
                  onCreateNote={handleCreateNote}
                  className={activeView === 'editor' ? "flex" : "hidden md:flex"}
                />
              )}
            </section>
          </div>
        </div>
      </div>

      {/* EDITOR on mobile: floating overlay sibling */}
      {selectedNote && _isMobile && (
        <MobileSwipeContainer
          active={activeView === 'editor'}
          onBack={() => setActiveView('notelist')}
          className={clsx(
            "flex-1 flex transition-[filter] duration-200",
            isAnyModalOpen && "filter blur-md pointer-events-none select-none"
          )}
          isIOS={isIOS}
          isMobile={_isMobile}
        >
          {renderEditor("flex-1 flex")}
        </MobileSwipeContainer>
      )}

      {/* Modals & Dialogs */}
      <AppModals
        isSettingsOpen={isSettingsOpen}
        onCloseSettings={() => setIsSettingsOpen(false)}
        isIOS={isIOS}
        theme={theme}
        setTheme={setTheme}
        autoTheme={autoTheme}
        setAutoTheme={setAutoTheme}
        preferredLightTheme={preferredLightTheme}
        markdownEnabled={markdownEnabled}
        setMarkdownEnabled={setMarkdownEnabled}
        monochromeIcons={monochromeIcons}
        setMonochromeIcons={setMonochromeIcons}
        showIconsWhenCollapsed={showIconsWhenCollapsed}
        setShowIconsWhenCollapsed={setShowIconsWhenCollapsed}
        showNoteCounts={showNoteCounts}
        setShowNoteCounts={setShowNoteCounts}
        fontFamily={fontFamily}
        setFontFamily={setFontFamily}
        fontSize={fontSize}
        setFontSize={setFontSize}
        spellcheckEnabled={spellcheckEnabled}
        setSpellcheckEnabled={setSpellcheckEnabled}
        landscapeFullscreen={landscapeFullscreen}
        setLandscapeFullscreen={setLandscapeFullscreen}
        syncStatus={syncStatus}
        hasPending={hasPending}
        userEmail={userEmail}
        onSignIn={signIn}
        onSignUp={signUp}
        onSignOut={signOut}
        onDeleteAccount={deleteAccount}
        onImportFolder={isIOS ? undefined : importFolder}
        onImportFiles={isIOS ? undefined : importFiles}
        onExportBackup={isIOS ? undefined : () => exportBackup(allNotes)}
        onResetDatabase={resetDatabase}
        trashNotes={trashNotes}
        onRestoreNote={restoreNote}
        onPermanentlyDeleteNote={permanentlyDeleteNote}
        onEmptyTrash={emptyTrash}
        editingCategory={editingCategory}
        onCloseEditingCategory={() => setEditingCategory(null)}
        metadata={metadata}
        onSaveCategory={handleSaveCategory}
        categoryToDelete={categoryToDelete}
        onCloseCategoryToDelete={() => setCategoryToDelete(null)}
        onDeleteCategory={handleDeleteCategory}
        isUpdateModalOpen={isUpdateModalOpen}
        updateVersion={updateVersion}
        updateStatus={updateStatus}
        onUpdate={handleUpdate}
        onSkipUpdate={handleSkipUpdate}
        onCancelUpdate={() => setIsUpdateModalOpen(false)}
        onInstallUpdate={handleInstallUpdate}
        isLoading={isLoading}
      />
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

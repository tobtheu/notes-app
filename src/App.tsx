import { useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { MobileSwipeContainer } from './components/MobileSwipeContainer';
import { TitleBar } from './components/TitleBar';
import { OnboardingScreen } from './components/OnboardingScreen';
import { AppModals } from './components/AppModals';
import { AppCanvas } from './components/AppCanvas';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { PGliteWrapper } from './components/PGliteWrapper';
import { I18nProvider } from './i18n';

import { useNotes } from './hooks/useNotes';
import { useSessionExpiryHandler } from './hooks/useSessionExpiryHandler';
import { useTauriUpdater } from './hooks/useTauriUpdater';
import { usePlatformInfo } from './hooks/usePlatformInfo';
import { useAppViewTransitions } from './hooks/useAppViewTransitions';
import { useAppThemeAndFont } from './hooks/useAppThemeAndFont';
import { useAppWindowControls } from './hooks/useAppWindowControls';

import { getDb } from './lib/electric';
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
    theme,
    setTheme,
    autoTheme,
    setAutoTheme,
    preferredLightTheme,
    markdownEnabled,
    setMarkdownEnabled,
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
    language,
    setLanguage,
  } = useAppThemeAndFont({
    settings: metadata.settings,
    saveSettings,
  });

  const { isIOS, isWindows } = usePlatformInfo();

  // View transitions & navigation
  const {
    activeView,
    setActiveView,
    categoryToDelete,
    setCategoryToDelete,
    editingCategory,
    setEditingCategory,
    handleSelectCategory,
    handleSelectNote,
    handleCreateNote,
    handleNavigate,
    handleSaveCategory,
    handleDeleteCategory,
  } = useAppViewTransitions({
    setSelectedCategory,
    setSelectedNote,
    getNoteId,
    createNote,
    renameFolder,
    updateFolderMetadata,
    deleteFolder,
  });

  // Window, layout, viewport & shortcuts
  const {
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    isFocusMode,
    setIsFocusMode,
    isSettingsOpen,
    setIsSettingsOpen,
    isMobile: _isMobile,
    isLandscape,
    isMaximized,
    containerRef,
    sidebarRef,
  } = useAppWindowControls({
    syncStatus,
    activeView,
    onCreateNote: handleCreateNote,
  });

  useSessionExpiryHandler({
    syncStatus,
    syncError,
    signOut,
    setIsSettingsOpen,
  });

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

  // Hide native iOS toolbar accessory bar whenever the user leaves the editor view
  useEffect(() => {
    if (isIOS && activeView !== 'editor') {
      window.webkit?.messageHandlers?.toolbarVisible?.postMessage(false);
    }
  }, [isIOS, activeView]);

  if (!currentFolder || syncStatus === 'unauthenticated') {
    return (
      <I18nProvider language={language} onLanguageChange={setLanguage}>
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
      </I18nProvider>
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

  return (
    <I18nProvider language={language} onLanguageChange={setLanguage}>
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
              <AppCanvas
                notes={notes}
                allNotes={allNotes}
                selectedNote={selectedNote}
                selectedCategory={selectedCategory}
                folders={folders}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onSelectNote={handleSelectNote}
                onDeleteNote={deleteNote}
                onMoveNote={moveNote}
                onTogglePin={togglePinNote}
                isNotePinned={isNotePinned}
                getNoteId={getNoteId}
                onCreateNote={handleCreateNote}
                activeView={activeView}
                isIOS={isIOS}
                isLandscape={isLandscape}
                landscapeFullscreen={landscapeFullscreen}
                isMobile={_isMobile}
                workspacePath={currentFolder || ''}
                onSaveNote={saveNote}
                onUpdateLocally={updateNoteLocally}
                markdownEnabled={markdownEnabled}
                toolbarVisible={toolbarVisible}
                setToolbarVisible={setToolbarVisible}
                spellcheckEnabled={spellcheckEnabled}
                isFocusMode={isFocusMode}
                onToggleFocus={() => setIsFocusMode(!isFocusMode)}
                onSync={triggerSync}
                onNavigate={handleNavigate}
              />
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
            <Editor
              className="flex-1 flex"
              note={selectedNote}
              allNotes={allNotes}
              workspacePath={currentFolder || ''}
              onSave={saveNote}
              onUpdateLocally={updateNoteLocally}
              markdownEnabled={markdownEnabled}
              toolbarVisible={toolbarVisible}
              setToolbarVisible={setToolbarVisible}
              spellcheckEnabled={spellcheckEnabled}
              isFocusMode={isFocusMode}
              onToggleFocus={() => setIsFocusMode(!isFocusMode)}
              onSync={triggerSync}
              onNavigate={handleNavigate}
              isIOS={isIOS}
              iosLandscapeFullscreen={isIOS && isLandscape && landscapeFullscreen}
            />
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
          language={language}
          onLanguageChange={setLanguage}
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
    </I18nProvider>
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

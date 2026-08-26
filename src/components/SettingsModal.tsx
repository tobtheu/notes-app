import { useState, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import type { SyncStatus } from '../hooks/useNotes';
import type { Theme, ThemeOrigin } from '../hooks/useTheme';
import type { Note } from '../types';
import { useSettingsModal } from '../hooks/useSettingsModal';
import { SettingsNav, type TabKey } from './SettingsNav';
import { FEATURES } from '../config/features';
import { useTranslation, type LanguageOption } from '../i18n';

import { CloudSyncSection } from './CloudSyncSection';
import { AppearanceSection } from './AppearanceSection';
import { StorageSection } from './StorageSection';
import { EditorSection } from './EditorSection';
import { TrashSection } from './TrashSection';
import { AboutSection } from './AboutSection';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    isIOS?: boolean;
    currentPath?: string | null;
    onChangePath?: () => void;
    theme: Theme;
    setTheme: (theme: Theme, origin?: ThemeOrigin) => void;
    autoTheme?: boolean;
    onToggleAutoTheme?: (enabled: boolean) => void;
    preferredLightTheme?: 'clay' | 'sage';
    markdownEnabled: boolean;
    onToggleMarkdown: (enabled: boolean) => void;
    monochromeIcons: boolean;
    onToggleMonochromeIcons: (v: boolean) => void;
    showIconsWhenCollapsed?: boolean;
    onToggleShowIconsWhenCollapsed?: (v: boolean) => void;
    showNoteCounts?: boolean;
    onToggleShowNoteCounts?: (v: boolean) => void;
    fontFamily: 'inter' | 'roboto' | 'courier' | 'sfmono' | 'serif' | 'system';
    setFontFamily: (fontFamily: 'inter' | 'roboto' | 'courier' | 'sfmono' | 'serif' | 'system') => void;
    fontSize: 'small' | 'medium' | 'large';
    setFontSize: (fontSize: 'small' | 'medium' | 'large') => void;
    spellcheckEnabled: boolean;
    onToggleSpellcheck: (enabled: boolean) => void;
    landscapeFullscreen?: boolean;
    onToggleLandscapeFullscreen?: (enabled: boolean) => void;
    language?: LanguageOption;
    setLanguage?: (lang: LanguageOption) => void;
    // Trash props
    trashNotes?: Note[];
    onRestoreNote?: (id: string) => Promise<void> | void;
    onPermanentlyDeleteNote?: (id: string) => Promise<void> | void;
    onEmptyTrash?: () => Promise<void> | void;
    // ElectricSQL sync props
    syncStatus?: SyncStatus;
    hasPending?: boolean;
    userEmail?: string | null;
    onSignIn?: (email: string, password: string) => Promise<{ userId: string; email: string }>;
    onSignUp?: (email: string, password: string) => Promise<{ userId: string; email: string }>;
    onSignOut?: (deleteLocal: boolean) => Promise<void>;
    onDeleteAccount?: () => Promise<void>;
    onImportFolder?: (onProgress?: (prog: any) => void) => Promise<number>;
    onImportFiles?: (onProgress?: (prog: any) => void) => Promise<number>;
    onExportBackup?: () => Promise<number>;
    onResetDatabase?: () => Promise<void>;
    onInstallUpdate?: () => Promise<void>;
}

/**
 * SettingsModal Component
 * 5-Tab Spring Modal managing theme, storage path, typography, sync, and software updates.
 */
export function SettingsModal(props: SettingsModalProps) {
    const {
        isOpen,
        onClose,
        isIOS = false,
        theme,
        setTheme,
        autoTheme,
        onToggleAutoTheme,
        preferredLightTheme,
        markdownEnabled,
        onToggleMarkdown,
        monochromeIcons,
        onToggleMonochromeIcons,
        showIconsWhenCollapsed,
        onToggleShowIconsWhenCollapsed,
        showNoteCounts,
        onToggleShowNoteCounts,
        fontFamily,
        setFontFamily,
        fontSize,
        setFontSize,
        spellcheckEnabled,
        onToggleSpellcheck,
        landscapeFullscreen = false,
        onToggleLandscapeFullscreen,
        syncStatus,
        hasPending = false,
        userEmail,
        trashNotes = [],
        onRestoreNote,
        onPermanentlyDeleteNote,
        onEmptyTrash,
    } = props;

    const [activeTab, setActiveTab] = useState<TabKey>('appearance');
    const effectiveTab = (!FEATURES.SYNC && activeTab === 'sync') ? 'appearance' : activeTab;
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            setIsClosing(false);
            onClose();
        }, 220);
    }, [onClose]);

    // Handle Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleClose]);

    const {
        version,
        updateStatus,
        diagResults,
        isDiagnosing,
        scrollContainerRef,
        importState,
        importCount,
        handleImportFolder,
        importFolderProgress,
        importFilesState,
        importFilesCount,
        importFilesProgress,
        handleImportFiles,
        exportState,
        exportCount,
        handleExportBackup,
        resetDbState,
        resetDbStep,
        setResetDbStep,
        handleResetDatabase,
        authMode,
        setAuthMode,
        authEmail,
        setAuthEmail,
        authPassword,
        setAuthPassword,
        authLoading,
        authError,
        signOutStep,
        setSignOutStep,
        signOutLoading,
        deleteAccountStep,
        setDeleteAccountStep,
        deleteAccountLoading,
        handleAuth,
        handleSignOutConfirm,
        handleDeleteAccountConfirm,
        handleCheckForUpdates,
        handleDownloadUpdate,
        handleInstallUpdate,
        handleRunDiagnostics,
    } = useSettingsModal(props);
    const { t } = useTranslation();

    if (!isOpen) return null;

    return (
        <div
            className={clsx(
                "fixed inset-0 z-[10001] flex p-3 sm:p-4 bg-black/40 dark:bg-black/70 backdrop-blur-md transition-opacity duration-300",
                isIOS && window.innerWidth < 768 ? "items-start" : "items-center justify-center",
                isClosing ? "opacity-0" : "opacity-100"
            )}
            style={isIOS && window.innerWidth < 768 ? { paddingTop: 'max(env(safe-area-inset-top, 0px), 24px)' } : undefined}
            onClick={handleClose}
        >
            <div
                className={clsx(
                    "bg-[var(--canvas-bg)] rounded-[24px] border border-[var(--border-subtle)] shadow-2xl w-full max-w-[780px] h-[550px] max-h-[88vh] flex overflow-hidden relative",
                    isClosing ? "animate-modal-close" : "animate-modal-spring"
                )}
                onClick={e => e.stopPropagation()}
            >
                {/* Left Navigation Sidebar */}
                <SettingsNav activeTab={effectiveTab} onSelectTab={setActiveTab} />

                {/* Right Content Panel */}
                <section className="flex-1 flex flex-col justify-between p-4 sm:p-5 overflow-hidden">
                    <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] shrink-0">
                        <h2 className="text-sm font-bold text-[var(--text-main)]">
                            {effectiveTab === 'appearance' && t('settings.tabs.appearance')}
                            {effectiveTab === 'editor' && t('settings.tabs.editor')}
                            {effectiveTab === 'sync' && t('settings.tabs.sync')}
                            {effectiveTab === 'storage' && t('settings.tabs.storage')}
                            {effectiveTab === 'trash' && t('settings.tabs.trash')}
                            {effectiveTab === 'about' && t('settings.tabs.about')}
                        </h2>
                    </div>

                    {/* Scrollable Tab Content Container */}
                    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0 pt-3 pr-1.5 sm:pr-2.5 custom-scrollbar">
                            {/* TAB 1: APPEARANCE */}
                            {effectiveTab === 'appearance' && (
                                <AppearanceSection
                                    theme={theme}
                                    setTheme={setTheme}
                                    autoTheme={autoTheme}
                                    onToggleAutoTheme={onToggleAutoTheme}
                                    preferredLightTheme={preferredLightTheme}
                                    monochromeIcons={monochromeIcons}
                                    onToggleMonochromeIcons={onToggleMonochromeIcons}
                                    showIconsWhenCollapsed={showIconsWhenCollapsed}
                                    onToggleShowIconsWhenCollapsed={onToggleShowIconsWhenCollapsed}
                                    showNoteCounts={showNoteCounts}
                                    onToggleShowNoteCounts={onToggleShowNoteCounts}
                                    fontFamily={fontFamily}
                                    setFontFamily={setFontFamily}
                                    fontSize={fontSize}
                                    setFontSize={setFontSize}
                                    language={props.language}
                                    setLanguage={props.setLanguage}
                                />
                            )}

                            {/* TAB 2: EDITOR */}
                            {effectiveTab === 'editor' && (
                                <EditorSection
                                    markdownEnabled={markdownEnabled}
                                    onToggleMarkdown={onToggleMarkdown}
                                    spellcheckEnabled={spellcheckEnabled}
                                    onToggleSpellcheck={onToggleSpellcheck}
                                    isIOS={isIOS}
                                    landscapeFullscreen={landscapeFullscreen}
                                    onToggleLandscapeFullscreen={onToggleLandscapeFullscreen}
                                />
                            )}

                            {/* TAB 3: CLOUD SYNC */}
                            {effectiveTab === 'sync' && (
                                <CloudSyncSection
                                    userEmail={userEmail}
                                    syncStatus={syncStatus}
                                    hasPending={hasPending}
                                    signOutStep={signOutStep}
                                    setSignOutStep={setSignOutStep}
                                    signOutLoading={signOutLoading}
                                    deleteAccountStep={deleteAccountStep}
                                    setDeleteAccountStep={setDeleteAccountStep}
                                    deleteAccountLoading={deleteAccountLoading}
                                    authMode={authMode}
                                    setAuthMode={setAuthMode}
                                    authEmail={authEmail}
                                    setAuthEmail={setAuthEmail}
                                    authPassword={authPassword}
                                    setAuthPassword={setAuthPassword}
                                    authError={authError}
                                    authLoading={authLoading}
                                    handleAuth={handleAuth}
                                    handleSignOutConfirm={handleSignOutConfirm}
                                    handleDeleteAccountConfirm={handleDeleteAccountConfirm}
                                />
                            )}

                            {/* TAB 4: STORAGE & BACKUP */}
                            {effectiveTab === 'storage' && (
                                <StorageSection
                                    hasImportFolderOption={!!props.onImportFolder}
                                    importState={importState}
                                    importCount={importCount}
                                    importFolderProgress={importFolderProgress}
                                    onImportFolderClick={handleImportFolder}
                                    importFilesState={importFilesState}
                                    importFilesCount={importFilesCount}
                                    importFilesProgress={importFilesProgress}
                                    onImportFilesClick={props.onImportFiles ? handleImportFiles : undefined}
                                    exportState={exportState}
                                    exportCount={exportCount}
                                    onExportBackup={props.onExportBackup ? handleExportBackup : undefined}
                                    resetDbState={resetDbState}
                                    resetDbStep={resetDbStep}
                                    setResetDbStep={setResetDbStep}
                                    onResetDatabaseClick={props.onResetDatabase ? handleResetDatabase : undefined}
                                />
                            )}

                            {/* TAB 5: TRASH */}
                            {effectiveTab === 'trash' && (
                                <TrashSection
                                    trashNotes={trashNotes}
                                    onRestoreNote={onRestoreNote ?? (() => {})}
                                    onPermanentlyDeleteNote={onPermanentlyDeleteNote ?? (() => {})}
                                    onEmptyTrash={onEmptyTrash ?? (() => {})}
                                />
                            )}

                            {/* TAB 6: ABOUT */}
                            {effectiveTab === 'about' && (
                                <AboutSection
                                    isIOS={isIOS}
                                    version={version}
                                    updateStatus={updateStatus}
                                    diagResults={diagResults}
                                    isDiagnosing={isDiagnosing}
                                    handleCheckForUpdates={handleCheckForUpdates}
                                    handleDownloadUpdate={handleDownloadUpdate}
                                    handleInstallUpdate={handleInstallUpdate}
                                    handleRunDiagnostics={handleRunDiagnostics}
                                />
                            )}
                    </div>

                    {/* Bottom Done Button */}
                    <div className="pt-3.5 border-t border-[var(--border-subtle)] flex justify-end gap-2 shrink-0 bg-[var(--canvas-bg)]">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="smooth-transition px-4 py-1.5 text-xs font-semibold text-white bg-[var(--accent-color)] hover:opacity-90 rounded-xl shadow-sm active:scale-95"
                        >
                            {t('common.done')}
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
}

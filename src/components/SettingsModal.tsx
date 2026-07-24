import { X } from 'lucide-react';
import clsx from 'clsx';
import type { SyncStatus } from '../hooks/useNotes';
import { useSettingsModal } from '../hooks/useSettingsModal';

import { CloudSyncSection } from './CloudSyncSection';
import { AppearanceSection } from './AppearanceSection';
import { StorageSection } from './StorageSection';
import { EditorSection } from './EditorSection';
import { AboutSection } from './AboutSection';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    isIOS?: boolean;
    currentPath: string | null;
    onChangePath: () => void;
    theme: 'light' | 'dark' | 'system';
    setTheme: (theme: 'light' | 'dark' | 'system') => void;
    markdownEnabled: boolean;
    onToggleMarkdown: (enabled: boolean) => void;
    accentColor: string;
    setAccentColor: (color: string) => void;
    monochromeIcons: boolean;
    onToggleMonochromeIcons: (v: boolean) => void;
    fontFamily: 'inter' | 'roboto' | 'system';
    setFontFamily: (fontFamily: 'inter' | 'roboto' | 'system') => void;
    fontSize: 'small' | 'medium' | 'large';
    setFontSize: (fontSize: 'small' | 'medium' | 'large') => void;
    spellcheckEnabled: boolean;
    onToggleSpellcheck: (enabled: boolean) => void;
    landscapeFullscreen?: boolean;
    onToggleLandscapeFullscreen?: (enabled: boolean) => void;
    // ElectricSQL sync props
    syncStatus?: SyncStatus;
    hasPending?: boolean;
    userEmail?: string | null;
    onSignIn?: (email: string, password: string) => Promise<{ userId: string; email: string }>;
    onSignUp?: (email: string, password: string) => Promise<{ userId: string; email: string }>;
    onSignOut?: (deleteLocal: boolean) => Promise<void>;
    onDeleteAccount?: () => Promise<void>;
    onImportFolder?: () => Promise<number>;
    onExportBackup?: () => void;
    onInstallUpdate?: () => Promise<void>;
}

/**
 * SettingsModal Component
 * Manages application-wide configurations including theme, storage path,
 * typography, and software updates.
 */
export function SettingsModal(props: SettingsModalProps) {
    const {
        isOpen,
        onClose,
        isIOS = false,
        currentPath,
        onChangePath,
        theme,
        setTheme,
        markdownEnabled,
        onToggleMarkdown,
        accentColor,
        setAccentColor,
        monochromeIcons,
        onToggleMonochromeIcons,
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
        onImportFolder
    } = props;

    const {
        version,
        updateStatus,
        diagResults,
        isDiagnosing,
        scrollContainerRef,
        importState,
        importCount,
        handleImportFolder,
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

    if (!isOpen) return null;

    return (
        <div
            className={clsx("fixed inset-0 z-[10001] flex p-4 bg-black/50 backdrop-blur-sm", isIOS && window.innerWidth < 768 ? "items-start" : "items-center justify-center")}
            style={isIOS && window.innerWidth < 768 ? { paddingTop: 'max(env(safe-area-inset-top, 0px), 24px)' } : undefined}
            onClick={onClose}
        >
            <div className="rounded-xl shadow-xl w-full max-w-md p-6 relative animate-in fade-in zoom-in duration-200 flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()} style={{ backgroundColor: 'var(--app-bg)' }}>
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors z-10"
                >
                    <X size={20} />
                </button>

                <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white shrink-0">Settings</h2>

                <div
                    ref={scrollContainerRef}
                    className="overflow-y-auto flex-1 pr-2 -mr-2 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700"
                >
                    {/* --- SYNC SECTION --- */}
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

                    {/* --- STORAGE SECTION --- */}
                    <StorageSection
                        currentPath={currentPath}
                        onChangePath={onChangePath}
                        hasImportFolderOption={!!onImportFolder}
                        importState={importState}
                        importCount={importCount}
                        onImportFolderClick={handleImportFolder}
                        onExportBackup={props.onExportBackup}
                    />

                    {/* --- APPEARANCE SECTION --- */}
                    <AppearanceSection
                        theme={theme}
                        setTheme={setTheme}
                        accentColor={accentColor}
                        setAccentColor={setAccentColor}
                        monochromeIcons={monochromeIcons}
                        onToggleMonochromeIcons={onToggleMonochromeIcons}
                        fontFamily={fontFamily}
                        setFontFamily={setFontFamily}
                        fontSize={fontSize}
                        setFontSize={setFontSize}
                    />

                    {/* --- EDITOR CONFIGURATION SECTION --- */}
                    <EditorSection
                        markdownEnabled={markdownEnabled}
                        onToggleMarkdown={onToggleMarkdown}
                        spellcheckEnabled={spellcheckEnabled}
                        onToggleSpellcheck={onToggleSpellcheck}
                        isIOS={isIOS}
                        landscapeFullscreen={landscapeFullscreen}
                        onToggleLandscapeFullscreen={onToggleLandscapeFullscreen}
                    />

                    {/* --- ABOUT & UPDATER SECTION --- */}
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
                </div>
            </div>
        </div>
    );
}

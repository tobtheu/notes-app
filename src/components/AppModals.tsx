import React from 'react';
import { Loader2 } from 'lucide-react';
import { SettingsModal } from './SettingsModal';
import { FolderEditModal } from './FolderEditModal';
import { DeleteFolderModal } from './DeleteFolderModal';
import { UpdateModal } from './UpdateModal';
import type { Note, AppMetadata, FolderMetadata, SyncStatus } from '../types';
import type { Theme, ThemeOrigin } from '../hooks/useTheme';
import type { FontFamily, FontSize } from '../hooks/useSettings';

interface AppModalsProps {
    isSettingsOpen: boolean;
    onCloseSettings: () => void;
    isIOS: boolean;
    theme: Theme;
    setTheme: (theme: Theme, origin?: ThemeOrigin) => void;
    autoTheme: boolean;
    setAutoTheme: (enabled: boolean) => void;
    preferredLightTheme?: 'clay' | 'sage';
    markdownEnabled: boolean;
    setMarkdownEnabled: (enabled: boolean) => void;
    monochromeIcons: boolean;
    setMonochromeIcons: (enabled: boolean) => void;
    showIconsWhenCollapsed?: boolean;
    setShowIconsWhenCollapsed?: (enabled: boolean) => void;
    showNoteCounts?: boolean;
    setShowNoteCounts?: (enabled: boolean) => void;
    fontFamily: FontFamily;
    setFontFamily: (fontFamily: FontFamily) => void;
    fontSize: FontSize;
    setFontSize: (fontSize: FontSize) => void;
    spellcheckEnabled: boolean;
    setSpellcheckEnabled: (enabled: boolean) => void;
    landscapeFullscreen: boolean;
    setLandscapeFullscreen: (enabled: boolean) => void;
    syncStatus: SyncStatus;
    hasPending: boolean;
    userEmail?: string | null;
    onSignIn: (email: string, pass: string) => Promise<void>;
    onSignUp: (email: string, pass: string) => Promise<void>;
    onSignOut: () => Promise<void>;
    onDeleteAccount: () => Promise<void>;
    onImportFolder?: (prog?: (p: any) => void) => Promise<number>;
    onImportFiles?: (prog?: (p: any) => void) => Promise<number>;
    onExportBackup?: () => Promise<number>;
    onResetDatabase?: () => Promise<void>;
    trashNotes: Note[];
    onRestoreNote: (id: string) => Promise<void> | void;
    onPermanentlyDeleteNote: (id: string) => Promise<void> | void;
    onEmptyTrash: () => Promise<void> | void;
    editingCategory: string | null;
    onCloseEditingCategory: () => void;
    metadata: AppMetadata;
    onSaveCategory: (newName: string, meta: FolderMetadata) => void;
    categoryToDelete: string | null;
    onCloseCategoryToDelete: () => void;
    onDeleteCategory: (mode: 'recursive' | 'move') => Promise<void>;
    isUpdateModalOpen: boolean;
    updateVersion?: string;
    updateStatus: any;
    onUpdate: () => Promise<void>;
    onSkipUpdate: () => void;
    onCancelUpdate: () => void;
    onInstallUpdate: () => Promise<void>;
    isLoading: boolean;
}

export const AppModals: React.FC<AppModalsProps> = ({
    isSettingsOpen,
    onCloseSettings,
    isIOS,
    theme,
    setTheme,
    autoTheme,
    setAutoTheme,
    preferredLightTheme,
    markdownEnabled,
    setMarkdownEnabled,
    monochromeIcons,
    setMonochromeIcons,
    showIconsWhenCollapsed,
    setShowIconsWhenCollapsed,
    showNoteCounts,
    setShowNoteCounts,
    fontFamily,
    setFontFamily,
    fontSize,
    setFontSize,
    spellcheckEnabled,
    setSpellcheckEnabled,
    landscapeFullscreen,
    setLandscapeFullscreen,
    syncStatus,
    hasPending,
    userEmail,
    onSignIn,
    onSignUp,
    onSignOut,
    onDeleteAccount,
    onImportFolder,
    onImportFiles,
    onExportBackup,
    onResetDatabase,
    trashNotes,
    onRestoreNote,
    onPermanentlyDeleteNote,
    onEmptyTrash,
    editingCategory,
    onCloseEditingCategory,
    metadata,
    onSaveCategory,
    categoryToDelete,
    onCloseCategoryToDelete,
    onDeleteCategory,
    isUpdateModalOpen,
    updateVersion,
    updateStatus,
    onUpdate,
    onSkipUpdate,
    onCancelUpdate,
    onInstallUpdate,
    isLoading,
}) => {
    return (
        <>
            {isSettingsOpen && (
                <SettingsModal
                    isOpen={true}
                    onClose={onCloseSettings}
                    isIOS={isIOS}
                    theme={theme}
                    setTheme={setTheme}
                    autoTheme={autoTheme}
                    onToggleAutoTheme={setAutoTheme}
                    preferredLightTheme={preferredLightTheme}
                    markdownEnabled={markdownEnabled}
                    onToggleMarkdown={setMarkdownEnabled}
                    monochromeIcons={monochromeIcons}
                    onToggleMonochromeIcons={setMonochromeIcons}
                    showIconsWhenCollapsed={showIconsWhenCollapsed}
                    onToggleShowIconsWhenCollapsed={setShowIconsWhenCollapsed}
                    showNoteCounts={showNoteCounts}
                    onToggleShowNoteCounts={setShowNoteCounts}
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
                    onSignIn={onSignIn}
                    onSignUp={onSignUp}
                    onSignOut={onSignOut}
                    onDeleteAccount={onDeleteAccount}
                    onImportFolder={onImportFolder}
                    onImportFiles={onImportFiles}
                    onExportBackup={onExportBackup}
                    onResetDatabase={onResetDatabase}
                    trashNotes={trashNotes}
                    onRestoreNote={restoreNote}
                    onPermanentlyDeleteNote={permanentlyDeleteNote}
                    onEmptyTrash={emptyTrash}
                />
            )}

            {editingCategory && (
                <FolderEditModal
                    isOpen={true}
                    onClose={onCloseEditingCategory}
                    folderName={editingCategory}
                    metadata={metadata.folders[editingCategory] || {}}
                    onSave={onSaveCategory}
                />
            )}

            {categoryToDelete && (
                <DeleteFolderModal
                    folderName={categoryToDelete}
                    onClose={onCloseCategoryToDelete}
                    onConfirm={onDeleteCategory}
                />
            )}

            {isUpdateModalOpen && updateVersion && (
                <UpdateModal
                    version={updateVersion}
                    onUpdate={onUpdate}
                    onSkip={onSkipUpdate}
                    onCancel={onCancelUpdate}
                    onInstall={onInstallUpdate}
                    status={updateStatus}
                />
            )}

            {isLoading && (
                <div className="fixed bottom-6 right-6 z-50 bg-white dark:bg-gray-900 rounded-full shadow-lg p-3 border border-gray-100 dark:border-gray-700">
                    <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />
                </div>
            )}
        </>
    );
};

import { useState } from 'react';
import type { ImportProgress } from './useNotesWorkspace';
import { useSettingsImportExport } from './useSettingsImportExport';
import { useSettingsDiagnostics } from './useSettingsDiagnostics';

interface UseSettingsModalProps {
    isOpen: boolean;
    onSignIn?: (email: string, password: string) => Promise<{ userId: string; email: string }>;
    onSignUp?: (email: string, password: string) => Promise<{ userId: string; email: string }>;
    onSignOut?: (deleteLocal: boolean) => Promise<void>;
    onDeleteAccount?: () => Promise<void>;
    onImportFolder?: (onProgress?: (prog: ImportProgress) => void) => Promise<number>;
    onImportFiles?: (onProgress?: (prog: ImportProgress) => void) => Promise<number>;
    onExportBackup?: () => Promise<number>;
    onResetDatabase?: () => Promise<void>;
    onInstallUpdate?: () => Promise<void>;
}

export function useSettingsModal({
    isOpen,
    onSignIn,
    onSignUp,
    onSignOut,
    onDeleteAccount,
    onImportFolder,
    onImportFiles,
    onExportBackup,
    onResetDatabase,
    onInstallUpdate,
}: UseSettingsModalProps) {
    // Import, Export & Reset Database subsystem
    const {
        importState,
        importCount,
        importFolderProgress,
        handleImportFolder,
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
    } = useSettingsImportExport({
        onImportFolder,
        onImportFiles,
        onExportBackup,
        onResetDatabase,
    });

    // Diagnostics, Versions & Updates subsystem
    const {
        version,
        updateStatus,
        diagResults,
        isDiagnosing,
        scrollContainerRef,
        handleCheckForUpdates,
        handleDownloadUpdate,
        handleInstallUpdate,
        handleRunDiagnostics,
    } = useSettingsDiagnostics({
        isOpen,
        onInstallUpdate,
    });

    // Auth form state
    const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
    const [authEmail, setAuthEmail] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);

    // Sign-out confirmation: idle → ask → confirm-delete
    const [signOutStep, setSignOutStep] = useState<'idle' | 'ask' | 'confirm-delete'>('idle');
    const [signOutLoading, setSignOutLoading] = useState(false);

    // Delete account confirmation
    const [deleteAccountStep, setDeleteAccountStep] = useState<'idle' | 'confirm'>('idle');
    const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);

    const handleAuth = async () => {
        if (!authEmail || !authPassword || !onSignIn || !onSignUp) return;
        setAuthLoading(true);
        setAuthError(null);
        try {
            if (authMode === 'signin') {
                await onSignIn(authEmail, authPassword);
            } else {
                await onSignUp(authEmail, authPassword);
            }
            setAuthEmail('');
            setAuthPassword('');
        } catch (e: any) {
            const msg = e?.toString() ?? '';
            if (msg.includes('Invalid login credentials') || msg.includes('invalid_grant')) {
                setAuthError('Email or password is incorrect.');
            } else if (msg.includes('User already registered')) {
                setAuthError('This email is already registered. Please sign in instead.');
            } else if (msg.includes('Password should be at least')) {
                setAuthError('Password must be at least 6 characters long.');
            } else {
                setAuthError('Connection failed. Please check your internet connection.');
            }
        } finally {
            setAuthLoading(false);
        }
    };

    const handleSignOutConfirm = async (deleteLocal: boolean) => {
        setSignOutLoading(true);
        try {
            await onSignOut?.(deleteLocal);
            setSignOutStep('idle');
        } finally {
            setSignOutLoading(false);
        }
    };

    const handleDeleteAccountConfirm = async () => {
        setDeleteAccountLoading(true);
        try {
            await onDeleteAccount?.();
            setDeleteAccountStep('idle');
        } finally {
            setDeleteAccountLoading(false);
        }
    };

    return {
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
    };
}

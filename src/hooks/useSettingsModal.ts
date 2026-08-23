import { useState, useEffect, useRef } from 'react';
import { runDiagnostics } from '../utils/health';
import type { HealthStatus } from '../utils/health';
import type { ImportProgress } from './useNotesWorkspace';

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
    const [version, setVersion] = useState<string>('0.0.0');
    const [updateStatus, setUpdateStatus] = useState<{
        type: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
        progress?: number;
        error?: string;
        version?: string;
    }>({ type: 'idle' });
    const [diagResults, setDiagResults] = useState<HealthStatus[] | null>(null);
    const [isDiagnosing, setIsDiagnosing] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    
    const [importState, setImportState] = useState<'idle' | 'loading' | 'done'>('idle');
    const [importCount, setImportCount] = useState(0);
    const [importFolderProgress, setImportFolderProgress] = useState<ImportProgress | null>(null);

    const [importFilesState, setImportFilesState] = useState<'idle' | 'loading' | 'done'>('idle');
    const [importFilesCount, setImportFilesCount] = useState(0);
    const [importFilesProgress, setImportFilesProgress] = useState<ImportProgress | null>(null);

    const [exportState, setExportState] = useState<'idle' | 'loading' | 'done'>('idle');
    const [exportCount, setExportCount] = useState(0);

    const [resetDbState, setResetDbState] = useState<'idle' | 'loading' | 'done'>('idle');
    const [resetDbStep, setResetDbStep] = useState<'idle' | 'confirm'>('idle');

    const handleImportFolder = async () => {
        if (!onImportFolder) return;
        setImportState('loading');
        setImportFolderProgress({ stage: 'selecting', current: 0, total: 0 });
        try {
            const count = await onImportFolder((prog) => {
                setImportFolderProgress(prog);
            });
            setImportCount(count);
            setImportState('done');
            setTimeout(() => {
                setImportState('idle');
                setImportFolderProgress(null);
            }, 3500);
        } catch {
            setImportState('idle');
            setImportFolderProgress(null);
        }
    };

    const handleImportFiles = async () => {
        if (!onImportFiles) return;
        setImportFilesState('loading');
        setImportFilesProgress({ stage: 'selecting', current: 0, total: 0 });
        try {
            const count = await onImportFiles((prog) => {
                setImportFilesProgress(prog);
            });
            setImportFilesCount(count);
            setImportFilesState('done');
            setTimeout(() => {
                setImportFilesState('idle');
                setImportFilesProgress(null);
            }, 3500);
        } catch {
            setImportFilesState('idle');
            setImportFilesProgress(null);
        }
    };

    const handleExportBackup = async () => {
        if (!onExportBackup) return;
        setExportState('loading');
        try {
            const count = await onExportBackup();
            setExportCount(count);
            setExportState('done');
            setTimeout(() => setExportState('idle'), 3500);
        } catch {
            setExportState('idle');
        }
    };

    const handleResetDatabase = async () => {
        if (!onResetDatabase) return;
        setResetDbState('loading');
        try {
            await onResetDatabase();
            setResetDbState('done');
            setResetDbStep('idle');
            setTimeout(() => setResetDbState('idle'), 3500);
        } catch {
            setResetDbState('idle');
            setResetDbStep('idle');
        }
    };

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

    // Auto-scroll to update status box when it appears
    useEffect(() => {
        if (updateStatus.type !== 'idle' && scrollContainerRef.current) {
            setTimeout(() => {
                scrollContainerRef.current?.scrollTo({
                    top: scrollContainerRef.current.scrollHeight,
                    behavior: 'smooth'
                });
            }, 50);
        }
    }, [updateStatus.type]);

    /**
     * --- INITIALIZATION & TAURI INTEROP ---
     */
    useEffect(() => {
        if (!isOpen) return;
        window.tauriAPI.getAppVersion().then(setVersion);
        const unsubscribe = window.tauriAPI.onUpdateStatus((status) => {
            setUpdateStatus(status);
        });
        return () => unsubscribe();
    }, [isOpen]);

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

    const handleCheckForUpdates = () => {
        setUpdateStatus({ type: 'checking' });
        window.tauriAPI.checkForUpdates();
    };

    const handleDownloadUpdate = () => {
        window.tauriAPI.downloadUpdate();
    };

    const handleInstallUpdate = async () => {
        if (onInstallUpdate) await onInstallUpdate();
        else window.tauriAPI.quitAndInstall();
    };

    const handleRunDiagnostics = async () => {
        setIsDiagnosing(true);
        try {
            const results = await runDiagnostics();
            setDiagResults(results);
        } catch (err) {
            console.error('Diagnostics failed:', err);
        } finally {
            setIsDiagnosing(false);
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

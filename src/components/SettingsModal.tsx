import { useState, useEffect, useRef } from 'react';
import { X, Moon, Sun, Monitor, FolderOpen, RefreshCw, CheckCircle2, AlertCircle, Cloud, CloudOff, Clock, LogOut, Download, Rocket, Upload, Trash2, AlertTriangle, Palette, Activity, Wifi, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import type { SyncStatus } from '../hooks/useNotes';
import { runDiagnostics } from '../utils/health';
import type { HealthStatus } from '../utils/health';

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
    onInstallUpdate?: () => Promise<void>;
}

/**
 * SettingsModal Component
 * Manages application-wide configurations including theme, storage path,
 * typography, and software updates.
 */
export function SettingsModal({
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
    onSignIn,
    onSignUp,
    onSignOut,
    onDeleteAccount,
    onImportFolder,
    onInstallUpdate,
}: SettingsModalProps) {
    /**
     * --- LOCAL STATE ---
     */
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

    const handleImportFolder = async () => {
        if (!onImportFolder) return;
        setImportState('loading');
        try {
            const count = await onImportFolder();
            setImportCount(count);
            setImportState('done');
            setTimeout(() => setImportState('idle'), 3000);
        } catch {
            setImportState('idle');
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
                    {/* --- SYNC SECTION (ElectricSQL) --- */}
                    <div className="mb-8">
                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Cloud Sync</h3>
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                            {userEmail ? (
                                <div className="flex flex-col gap-3">
                                    {/* Connected state */}
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                                            <Cloud className="text-primary-600 dark:text-primary-400" size={20} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">Cloud Sync active</p>
                                            <p className="text-xs text-gray-500 truncate">{userEmail}</p>
                                        </div>
                                        {syncStatus === 'synced' && !hasPending && <CheckCircle2 className="text-green-500 shrink-0" size={18} />}
                                        {syncStatus === 'pending' && <Clock className="text-amber-500 shrink-0" size={18} />}
                                        {syncStatus === 'offline' && <CloudOff className="text-gray-400 shrink-0" size={18} />}
                                    </div>
                                    {syncStatus === 'pending' && (
                                        <p className="text-xs text-amber-600 dark:text-amber-400">
                                            Pending changes will sync as soon as you're back online.
                                        </p>
                                    )}

                                    {/* Sign-out flow */}
                                    {signOutStep === 'idle' && (
                                        <button
                                            type="button"
                                            onClick={() => setSignOutStep('ask')}
                                            className="flex items-center justify-center gap-2 w-full px-3 py-2 text-xs font-semibold bg-white dark:bg-gray-800 border border-red-200 dark:border-red-900/50 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                        >
                                            <LogOut size={14} />
                                            Sign Out
                                        </button>
                                    )}
                                    {signOutStep === 'ask' && (
                                        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 flex flex-col gap-2">
                                            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Keep local files after signing out?</p>
                                            <div className="flex gap-2">
                                                <button type="button" onClick={() => setSignOutStep('idle')} className="flex-1 px-2 py-1.5 text-xs rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Cancel</button>
                                                <button type="button" onClick={() => handleSignOutConfirm(false)} disabled={signOutLoading} className="flex-1 px-2 py-1.5 text-xs rounded-md bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-60">Keep</button>
                                                <button type="button" onClick={() => setSignOutStep('confirm-delete')} className="flex-1 px-2 py-1.5 text-xs rounded-md bg-white dark:bg-gray-900 border border-red-300 dark:border-red-800 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">Delete</button>
                                            </div>
                                        </div>
                                    )}
                                    {signOutStep === 'confirm-delete' && (
                                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex flex-col gap-2">
                                            <div className="flex items-start gap-2">
                                                <AlertTriangle size={14} className="text-red-600 shrink-0 mt-0.5" />
                                                <p className="text-xs text-red-700 dark:text-red-400">All local notes will be <strong>permanently deleted</strong>. This action cannot be undone.</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button type="button" onClick={() => setSignOutStep('ask')} className="flex-1 px-2 py-1.5 text-xs rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Back</button>
                                                <button type="button" onClick={() => handleSignOutConfirm(true)} disabled={signOutLoading} className="flex-1 px-2 py-1.5 text-xs rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-60">
                                                    {signOutLoading ? 'Deleting...' : 'Delete & Sign Out'}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Delete account */}
                                    {signOutStep === 'idle' && deleteAccountStep === 'idle' && (
                                        <button
                                            type="button"
                                            onClick={() => setDeleteAccountStep('confirm')}
                                            className="flex items-center justify-center gap-2 w-full px-3 py-2 text-xs font-semibold bg-white dark:bg-gray-800 border border-red-200 dark:border-red-900/50 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                        >
                                            <Trash2 size={14} />
                                            Delete Account
                                        </button>
                                    )}
                                    {deleteAccountStep === 'confirm' && (
                                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex flex-col gap-2">
                                            <div className="flex items-start gap-2">
                                                <AlertTriangle size={14} className="text-red-600 shrink-0 mt-0.5" />
                                                <p className="text-xs text-red-700 dark:text-red-400">Your account and <strong>all stored data will be permanently deleted</strong>. This action cannot be undone.</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button type="button" onClick={() => setDeleteAccountStep('idle')} className="flex-1 px-2 py-1.5 text-xs rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Cancel</button>
                                                <button type="button" onClick={handleDeleteAccountConfirm} disabled={deleteAccountLoading} className="flex-1 px-2 py-1.5 text-xs rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-60">
                                                    {deleteAccountLoading ? 'Deleting...' : 'Delete Account'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-start gap-3 mb-1">
                                        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mt-0.5 shrink-0">
                                            <Cloud className="text-primary-600 dark:text-primary-400" size={16} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">Cloud Sync</p>
                                            <p className="text-xs text-gray-500">
                                                Sign in to sync your notes across devices.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 text-xs font-semibold">
                                        <button
                                            type="button"
                                            onClick={() => setAuthMode('signin')}
                                            className={`flex-1 py-1.5 transition-colors ${authMode === 'signin' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}
                                        >Sign In</button>
                                        <button
                                            type="button"
                                            onClick={() => setAuthMode('signup')}
                                            className={`flex-1 py-1.5 transition-colors ${authMode === 'signup' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}
                                        >Sign Up</button>
                                    </div>

                                    <input
                                        type="email"
                                        placeholder="Email"
                                        value={authEmail}
                                        onChange={e => setAuthEmail(e.target.value)}
                                        className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                    <input
                                        type="password"
                                        placeholder="Password"
                                        value={authPassword}
                                        onChange={e => setAuthPassword(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAuth()}
                                        className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                                    />

                                    {authError && (
                                        <p className="text-xs text-red-500 text-center break-words">{authError}</p>
                                    )}

                                    <button
                                        type="button"
                                        onClick={handleAuth}
                                        disabled={authLoading || !authEmail || !authPassword}
                                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
                                    >
                                        {authLoading ? (
                                            <><RefreshCw size={14} className="animate-spin" /> Please wait…</>
                                        ) : authMode === 'signin' ? 'Sign In' : 'Create Account'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* --- STORAGE SECTION --- */}
                    <div className="mb-8">
                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Storage</h3>
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                            <p className="text-xs text-gray-500 mb-1">Current Folder</p>
                            <p className="font-mono text-sm text-gray-700 dark:text-gray-300 break-all mb-3">
                                {currentPath || 'Not selected'}
                            </p>
                            <div className="flex items-center gap-3 flex-wrap">
                                <button
                                    type="button"
                                    onClick={onChangePath}
                                    className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
                                >
                                    <FolderOpen size={16} />
                                    Change Location
                                </button>
                                {onImportFolder && (
                                    <button
                                        type="button"
                                        onClick={handleImportFolder}
                                        disabled={importState === 'loading'}
                                        className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors disabled:opacity-50"
                                    >
                                        {importState === 'loading' ? (
                                            <RefreshCw size={16} className="animate-spin" />
                                        ) : importState === 'done' ? (
                                            <CheckCircle2 size={16} className="text-emerald-500" />
                                        ) : (
                                            <Upload size={16} />
                                        )}
                                        {importState === 'done'
                                            ? `${importCount} notes imported`
                                            : 'Import Folder'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* --- APPEARANCE SECTION --- */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Appearance</h3>

                        {/* Theme Configuration */}
                        <div className="grid grid-cols-3 gap-3 mb-6">
                            <button
                                onClick={() => setTheme('light')}
                                className={clsx(
                                    "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all",
                                    theme === 'light'
                                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                                        : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                                )}
                            >
                                <Sun size={20} />
                                <span className="text-xs font-medium">Light</span>
                            </button>
                            <button
                                onClick={() => setTheme('dark')}
                                className={clsx(
                                    "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all",
                                    theme === 'dark'
                                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                                        : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                                )}
                            >
                                <Moon size={20} />
                                <span className="text-xs font-medium">Dark</span>
                            </button>
                            <button
                                onClick={() => setTheme('system')}
                                className={clsx(
                                    "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all",
                                    theme === 'system'
                                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                                        : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                                )}
                            >
                                <Monitor size={20} />
                                <span className="text-xs font-medium">System</span>
                            </button>
                        </div>

                        {/* Accent Color Selection */}
                        <div className="mb-6">
                            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">Accent Color</h4>
                            <div className="flex items-center gap-3 px-3 py-1 -mx-1 mb-4">
                                {([
                                    ['blue', '#3b82f6'],
                                    ['purple', '#a855f7'],
                                    ['green', '#59FFA0'],
                                    ['red', '#ef4444'],
                                    ['orange', '#f97316'],
                                    ['jasmine', '#FFD972'],
                                    ['periwinkle', '#B4ADEA'],
                                    ['watermelon', '#E84855'],
                                ] as [string, string][]).map(([color, hex]) => (
                                    <button
                                        key={color}
                                        onClick={() => setAccentColor(color)}
                                        data-accent={color}
                                        className={clsx(
                                            "w-8 h-8 rounded-full flex items-center justify-center transition-all ring-offset-2 dark:ring-offset-gray-800",
                                            accentColor === color ? "ring-2 ring-gray-400 dark:ring-gray-400 scale-110" : "hover:scale-110"
                                        )}
                                        style={{ backgroundColor: hex }}
                                        title={color.charAt(0).toUpperCase() + color.slice(1)}
                                    >
                                        {accentColor === color && (
                                            <div className="w-2.5 h-2.5 bg-white rounded-full shadow-sm" />
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* Premium Themes Selection */}
                            <div className="mb-6">
                                <div className="flex items-center gap-2 mb-3">
                                    <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400">Premium Themes</h4>
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 uppercase tracking-wider">Pro</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {([
                                        ['terracotta', '#8c4a4a', '#f2ebe1', 'Terracotta'],
                                        ['sage', '#5d6d5d', '#ecebe4', 'Sage & Stone'],
                                        ['indigo', '#3f4d71', '#f1f1f1', 'Lava & Indigo'],
                                    ] as [string, string, string, string][]).map(([color, primary, bg, label]) => (
                                        <button
                                            key={color}
                                            onClick={() => setAccentColor(color)}
                                            className={clsx(
                                                "relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all overflow-hidden group",
                                                accentColor === color
                                                    ? "border-[var(--primary-500)] shadow-md shadow-[var(--primary-500)]/20"
                                                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm"
                                            )}
                                            style={{ backgroundColor: theme === 'dark' ? '#111' : bg }}
                                        >
                                            <div
                                                className="w-10 h-10 rounded-full mb-2 flex items-center justify-center shadow-sm"
                                                style={{ backgroundColor: primary }}
                                            >
                                                {accentColor === color && <div className="w-3 h-3 bg-white rounded-full" />}
                                            </div>
                                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                                {label}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Monochrome Icons Toggle */}
                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-500">
                                        <Palette size={16} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Monochrome Sidebar Icons</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => onToggleMonochromeIcons(!monochromeIcons)}
                                    className={clsx(
                                        "w-10 h-5 rounded-full transition-colors relative",
                                        monochromeIcons ? "bg-primary-600" : "bg-gray-200 dark:bg-gray-700"
                                    )}
                                >
                                    <div className={clsx(
                                        "absolute top-1 w-3 h-3 rounded-full bg-white transition-transform",
                                        monochromeIcons ? "translate-x-6" : "translate-x-1"
                                    )} />
                                </button>
                            </div>
                        </div>

                        {/* Typography Configuration */}
                        <div className="mt-6">
                            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">Typography</h4>

                            {/* Font Family Selection */}
                            <div className="flex items-center gap-2 mb-4 p-1 bg-gray-100 dark:bg-gray-900/50 rounded-lg">
                                <button
                                    onClick={() => setFontFamily('system')}
                                    className={clsx(
                                        "flex-1 text-xs font-medium py-1.5 px-3 rounded-md transition-all",
                                        fontFamily === 'system' ? "bg-white dark:bg-gray-800 shadow text-gray-800 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                    )}
                                    style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
                                >
                                    System
                                </button>
                                <button
                                    onClick={() => setFontFamily('inter')}
                                    className={clsx(
                                        "flex-1 text-xs font-medium py-1.5 px-3 rounded-md transition-all",
                                        fontFamily === 'inter' ? "bg-white dark:bg-gray-800 shadow text-gray-800 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                    )}
                                    style={{ fontFamily: "'Inter', sans-serif" }}
                                >
                                    Inter
                                </button>
                                <button
                                    onClick={() => setFontFamily('roboto')}
                                    className={clsx(
                                        "flex-1 text-xs font-medium py-1.5 px-3 rounded-md transition-all",
                                        fontFamily === 'roboto' ? "bg-white dark:bg-gray-800 shadow text-gray-800 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                    )}
                                    style={{ fontFamily: "'Roboto', sans-serif" }}
                                >
                                    Roboto
                                </button>
                            </div>

                            {/* Font Size Selection */}
                            <div className="flex items-center gap-2 p-1 bg-gray-100 dark:bg-gray-900/50 rounded-lg">
                                <button
                                    onClick={() => setFontSize('small')}
                                    className={clsx(
                                        "flex-1 py-1.5 px-3 rounded-md transition-all flex items-center justify-center",
                                        fontSize === 'small' ? "bg-white dark:bg-gray-800 shadow text-gray-800 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                    )}
                                    title="Small Text"
                                >
                                    <span className="text-[12px] font-medium leading-none">Small</span>
                                </button>
                                <button
                                    onClick={() => setFontSize('medium')}
                                    className={clsx(
                                        "flex-1 py-1.5 px-3 rounded-md transition-all flex items-center justify-center",
                                        fontSize === 'medium' ? "bg-white dark:bg-gray-800 shadow text-gray-800 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                    )}
                                    title="Medium Text"
                                >
                                    <span className="font-medium text-[14px] leading-none">Medium</span>
                                </button>
                                <button
                                    onClick={() => setFontSize('large')}
                                    className={clsx(
                                        "flex-1 py-1.5 px-3 rounded-md transition-all flex items-center justify-center",
                                        fontSize === 'large' ? "bg-white dark:bg-gray-800 shadow text-gray-800 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                    )}
                                    title="Large Text"
                                >
                                    <span className="font-medium text-[16px] leading-none">Large</span>
                                </button>
                            </div>
                        </div>
                    </div>


                    {/* --- EDITOR CONFIGURATION SECTION --- */}
                    <div className="mt-8 border-t border-gray-100 dark:border-gray-700 pt-6">
                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Editor</h3>

                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg mb-3">
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Markdown Formatting</span>
                                <span className="text-xs text-gray-500">Live preview and auto-formatting</span>
                            </div>
                            <button
                                onClick={() => onToggleMarkdown(!markdownEnabled)}
                                className={clsx(
                                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                                    markdownEnabled ? "bg-primary-600" : "bg-gray-300 dark:bg-gray-700"
                                )}
                            >
                                <span
                                    className={clsx(
                                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                        markdownEnabled ? "translate-x-6" : "translate-x-1"
                                    )}
                                />
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Spellcheck</span>
                                <span className="text-xs text-gray-500">Enable Windows spellcheck lines</span>
                            </div>
                            <button
                                onClick={() => onToggleSpellcheck(!spellcheckEnabled)}
                                className={clsx(
                                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                                    spellcheckEnabled ? "bg-primary-600" : "bg-gray-300 dark:bg-gray-700"
                                )}
                            >
                                <span
                                    className={clsx(
                                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                        spellcheckEnabled ? "translate-x-6" : "translate-x-1"
                                    )}
                                />
                            </button>
                        </div>
                    </div>

                    {/* Landscape Fullscreen — iOS only */}
                    {isIOS && (
                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg mt-3">
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Landscape Fullscreen</span>
                                <span className="text-xs text-gray-500">Note in landscape mode across the full screen</span>
                            </div>
                            <button
                                type="button"
                                title={landscapeFullscreen ? "Disable landscape fullscreen" : "Enable landscape fullscreen"}
                                onClick={() => onToggleLandscapeFullscreen?.(!landscapeFullscreen)}
                                className={clsx(
                                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                                    landscapeFullscreen ? "bg-primary-600" : "bg-gray-300 dark:bg-gray-700"
                                )}
                            >
                                <span className={clsx(
                                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                    landscapeFullscreen ? "translate-x-6" : "translate-x-1"
                                )} />
                            </button>
                        </div>
                    )}

                    {/* --- ABOUT & UPDATER SECTION --- */}
                    <div className="mt-8 border-t border-gray-100 dark:border-gray-700 pt-6 mb-2">
                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">About</h3>

                        <div className="flex items-center justify-between mb-4">
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Version</span>
                                <span className="text-xs text-gray-500">{version}</span>
                            </div>

                            {!isIOS && (updateStatus.type === 'idle' || updateStatus.type === 'not-available' || updateStatus.type === 'error') && (
                                <button
                                    onClick={handleCheckForUpdates}
                                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors"
                                >
                                    <RefreshCw size={14} />
                                    Check for Updates
                                </button>
                            )}
                        </div>

                        {/* Real-time Update Status Display */}
                        {updateStatus.type !== 'idle' && (
                            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                {updateStatus.type === 'checking' && (
                                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                        <RefreshCw size={14} className="animate-spin" />
                                        <span>Checking for updates...</span>
                                    </div>
                                )}

                                {updateStatus.type === 'available' && (
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-start gap-2 text-sm text-primary-600 dark:text-primary-400">
                                            <RefreshCw size={14} className="mt-0.5" />
                                            <div>
                                                <p className="font-semibold">Update Available ({updateStatus.version})</p>
                                                <p className="text-xs opacity-80">A new version is ready to download.</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleDownloadUpdate}
                                            className="w-full flex items-center justify-center gap-2 py-2 text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors"
                                        >
                                            <Download size={14} />
                                            Download Now
                                        </button>
                                    </div>
                                )}

                                {updateStatus.type === 'downloading' && (
                                    <div className="flex flex-col gap-2">
                                        <div className="flex justify-between text-xs font-medium mb-1">
                                            <span className="text-gray-600 dark:text-gray-400">Downloading...</span>
                                            <span className="text-primary-600 dark:text-primary-400">{Math.round(updateStatus.progress || 0)}%</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary-500 transition-all duration-300"
                                                style={{ width: `${updateStatus.progress || 0}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {updateStatus.type === 'downloaded' && (
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-start gap-2 text-sm text-green-600 dark:text-green-400">
                                            <CheckCircle2 size={14} className="mt-0.5" />
                                            <div>
                                                <p className="font-semibold">Update Ready</p>
                                                <p className="text-xs opacity-80">Download complete. Restart to apply.</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleInstallUpdate}
                                            className="w-full flex items-center justify-center gap-2 py-2 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
                                        >
                                            <Rocket size={14} />
                                            Restart & Install
                                        </button>
                                    </div>
                                )}

                                {updateStatus.type === 'not-available' && (
                                    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                                        <CheckCircle2 size={14} />
                                        <span>You are on the latest version!</span>
                                    </div>
                                )}

                                {updateStatus.type === 'error' && (
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                                            <AlertCircle size={14} />
                                            <span>Update failed</span>
                                        </div>
                                        <p className="text-[10px] text-red-500 pl-6 break-all">{updateStatus.error}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Connection Diagnostic - Only shown in DEV mode */}
                        {import.meta.env.DEV && (
                            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
                                <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Activity size={12} />
                                    Connection Diagnostic
                                </h3>

                                <button
                                    onClick={handleRunDiagnostics}
                                    disabled={isDiagnosing}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md transition-colors disabled:opacity-50"
                                >
                                    {isDiagnosing ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <Wifi size={14} />
                                    )}
                                    {isDiagnosing ? 'Checking Connections...' : 'Test Connection Status'}
                                </button>

                                {diagResults && (
                                    <div className="mt-4 space-y-2">
                                        {diagResults.map((res, i) => (
                                            <div key={i} className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-gray-900/50">
                                                <div className="flex items-center gap-2">
                                                    {res.ok ? (
                                                        <div className="w-2 h-2 rounded-full bg-green-500" />
                                                    ) : (
                                                        <div className="w-2 h-2 rounded-full bg-red-500" />
                                                    )}
                                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{res.service}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {res.latency !== undefined && res.latency > 0 && (
                                                        <span className="text-[10px] text-gray-400">{res.latency}ms</span>
                                                    )}
                                                    {res.ok ? (
                                                        <CheckCircle2 size={14} className="text-green-500" />
                                                    ) : (
                                                        <AlertCircle size={14} className="text-red-500" />
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {!diagResults.every(r => r.ok) && (
                                            <div className="p-2 mt-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-100 dark:border-red-900/30">
                                                <p className="text-[10px] text-red-600 dark:text-red-400 leading-relaxed">
                                                    One or more services are unreachable. If you are on iOS, check if the server uses HTTPS.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div >
    );
}

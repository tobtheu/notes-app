import { useState, useEffect, useRef } from 'react';
import { X, Moon, Sun, Monitor, FolderOpen, RefreshCw, CheckCircle2, AlertCircle, Cloud, LogOut, Download, Rocket, RotateCcw } from 'lucide-react';
import clsx from 'clsx';

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
    fontFamily: 'inter' | 'roboto' | 'system';
    setFontFamily: (fontFamily: 'inter' | 'roboto' | 'system') => void;
    fontSize: 'small' | 'medium' | 'large';
    setFontSize: (fontSize: 'small' | 'medium' | 'large') => void;
    spellcheckEnabled: boolean;
    onToggleSpellcheck: (enabled: boolean) => void;
    landscapeFullscreen?: boolean;
    onToggleLandscapeFullscreen?: (enabled: boolean) => void;
    onTriggerSync?: () => void;
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
    fontFamily,
    setFontFamily,
    fontSize,
    setFontSize,
    spellcheckEnabled,
    onToggleSpellcheck,
    landscapeFullscreen = false,
    onToggleLandscapeFullscreen,
    onTriggerSync,
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
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Supabase Sync State
    const [syncEmail, setSyncEmail] = useState<string | null>(null);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'signing-in' | 'resetting' | 'error'>('idle');
    const [syncError, setSyncError] = useState<string | null>(null);
    const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
    const [authEmail, setAuthEmail] = useState('');
    const [authPassword, setAuthPassword] = useState('');

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

        // Fetch current app version from the backend
        window.tauriAPI.getAppVersion().then(setVersion);

        // Fetch connected Supabase account
        window.tauriAPI.getSupabaseUser().then(data => {
            if (data) setSyncEmail(data.email);
        });

        // Subscribe to real-time update events from the Tauri updater
        const unsubscribe = window.tauriAPI.onUpdateStatus((status) => {
            setUpdateStatus(status);
        });

        return () => unsubscribe();
    }, [isOpen]);

    const handleSupabaseAuth = async () => {
        if (!authEmail || !authPassword) return;
        setSyncStatus('signing-in');
        setSyncError(null);
        try {
            const fn = authMode === 'signin'
                ? window.tauriAPI.supabaseSignIn
                : window.tauriAPI.supabaseSignUp;
            const result = await fn(authEmail, authPassword);
            setSyncEmail(result.email);
            setAuthEmail('');
            setAuthPassword('');
            setSyncStatus('idle');
            // Immediately pull notes from server after signing in
            onTriggerSync?.();
        } catch (e: any) {
            setSyncError(e?.toString() || 'Fehler beim Anmelden');
            setSyncStatus('error');
        }
    };

    const handleSupabaseSignOut = async () => {
        await window.tauriAPI.supabaseSignOut();
        setSyncEmail(null);
        setSyncStatus('idle');
        setSyncError(null);
    };

    const handleForceFullSync = async () => {
        if (!currentPath) return;
        setSyncStatus('resetting');
        try {
            await window.tauriAPI.resetSyncState(currentPath);
            onTriggerSync?.();
        } finally {
            setSyncStatus('idle');
        }
    };

    const handleCheckForUpdates = () => {
        setUpdateStatus({ type: 'checking' });
        window.tauriAPI.checkForUpdates();
    };

    const handleDownloadUpdate = () => {
        window.tauriAPI.downloadUpdate();
    };

    const handleInstallUpdate = () => {
        window.tauriAPI.quitAndInstall();
    };

    if (!isOpen) return null;

    return (
        <div
            className={clsx("fixed inset-0 z-[10001] flex p-4 bg-black/50 backdrop-blur-sm", isIOS && window.innerWidth < 768 ? "items-start" : "items-center justify-center")}
            style={isIOS && window.innerWidth < 768 ? { paddingTop: 'max(env(safe-area-inset-top, 0px), 24px)' } : undefined}
        >
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6 relative animate-in fade-in zoom-in duration-200 flex flex-col max-h-[85vh]">
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
                    <div className="mb-8">
                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Cloud Sync</h3>
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                            {syncEmail ? (
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                                            <Cloud className="text-primary-600 dark:text-primary-400" size={20} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">Cloud Sync aktiv</p>
                                            <p className="text-xs text-gray-500 truncate">{syncEmail}</p>
                                        </div>
                                        <CheckCircle2 className="text-green-500 shrink-0" size={18} />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleForceFullSync}
                                        disabled={syncStatus === 'resetting'}
                                        className="flex items-center justify-center gap-2 w-full px-3 py-2 text-xs font-semibold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50"
                                    >
                                        <RotateCcw size={14} className={syncStatus === 'resetting' ? 'animate-spin' : ''} />
                                        {syncStatus === 'resetting' ? 'Wird synchronisiert...' : 'Alle Notizen synchronisieren'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSupabaseSignOut}
                                        className="flex items-center justify-center gap-2 w-full px-3 py-2 text-xs font-semibold bg-white dark:bg-gray-800 border border-red-200 dark:border-red-900/50 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                    >
                                        <LogOut size={14} />
                                        Abmelden
                                    </button>
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
                                                Melde dich an, um deine Notizen geräteübergreifend zu synchronisieren.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Toggle sign-in / sign-up */}
                                    <div className="flex rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 text-xs font-semibold">
                                        <button
                                            type="button"
                                            onClick={() => setAuthMode('signin')}
                                            className={`flex-1 py-1.5 transition-colors ${authMode === 'signin' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}
                                        >Anmelden</button>
                                        <button
                                            type="button"
                                            onClick={() => setAuthMode('signup')}
                                            className={`flex-1 py-1.5 transition-colors ${authMode === 'signup' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}
                                        >Registrieren</button>
                                    </div>

                                    <input
                                        type="email"
                                        placeholder="E-Mail"
                                        value={authEmail}
                                        onChange={e => setAuthEmail(e.target.value)}
                                        className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                    <input
                                        type="password"
                                        placeholder="Passwort"
                                        value={authPassword}
                                        onChange={e => setAuthPassword(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSupabaseAuth()}
                                        className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                                    />

                                    {syncStatus === 'error' && syncError && (
                                        <p className="text-xs text-red-500 text-center break-words">{syncError}</p>
                                    )}

                                    <button
                                        type="button"
                                        onClick={handleSupabaseAuth}
                                        disabled={syncStatus === 'signing-in' || !authEmail || !authPassword}
                                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
                                    >
                                        {syncStatus === 'signing-in' ? (
                                            <><RefreshCw size={14} className="animate-spin" /> Bitte warten…</>
                                        ) : authMode === 'signin' ? 'Anmelden' : 'Konto erstellen'}
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
                            <button
                                onClick={onChangePath}
                                className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
                            >
                                <FolderOpen size={16} />
                                Change Location
                            </button>
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
                        <div>
                            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">Accent Color</h4>
                            <div className="flex items-center gap-3 px-3 py-1 -mx-1">
                                {([
                                    ['blue',        '#3b82f6'],
                                    ['purple',      '#a855f7'],
                                    ['green',       '#59FFA0'],
                                    ['red',         '#ef4444'],
                                    ['orange',      '#f97316'],
                                    ['jasmine',     '#FFD972'],
                                    ['periwinkle',  '#B4ADEA'],
                                    ['watermelon',  '#E84855'],
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
                        <div className="flex items-center justify-between mt-4">
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Landscape Vollbild</span>
                                <span className="text-xs text-gray-500">Notiz im Querformat über den ganzen Bildschirm</span>
                            </div>
                            <button
                                type="button"
                                title={landscapeFullscreen ? "Landscape Vollbild deaktivieren" : "Landscape Vollbild aktivieren"}
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

                            {(updateStatus.type === 'idle' || updateStatus.type === 'not-available' || updateStatus.type === 'error') && (
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
                    </div>
                </div>
            </div>
        </div >
    );
}

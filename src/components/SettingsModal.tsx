import { useState, useEffect, useRef } from 'react';
import { X, Moon, Sun, Monitor, FolderOpen, RefreshCw, CheckCircle2, AlertCircle, Cloud, Github, LogOut, Download, Rocket } from 'lucide-react';
import clsx from 'clsx';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
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
}

/**
 * SettingsModal Component
 * Manages application-wide configurations including theme, storage path,
 * typography, and software updates.
 */
export function SettingsModal({
    isOpen,
    onClose,
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
    onToggleSpellcheck
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

    // GitHub Sync State
    const [syncUsername, setSyncUsername] = useState<string | null>(null);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'waiting-code' | 'polling' | 'error'>('idle');
    const [syncError, setSyncError] = useState<string | null>(null);
    const [deviceFlow, setDeviceFlow] = useState<{
        deviceCode: string;
        userCode: string;
        verificationUri: string;
        interval: number;
    } | null>(null);

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

        // Fetch connected GitHub account
        window.tauriAPI.getGithubToken().then(data => {
            if (data) setSyncUsername(data.username);
        });

        // Subscribe to real-time update events from the Tauri updater
        const unsubscribe = window.tauriAPI.onUpdateStatus((status) => {
            setUpdateStatus(status);
        });

        return () => unsubscribe();
    }, [isOpen]);

    const handleConnectGithub = async () => {
        if (!currentPath) return;
        setSyncStatus('waiting-code');
        setSyncError(null);
        try {
            const flow = await window.tauriAPI.startGithubOAuth();
            setDeviceFlow(flow);
            setSyncStatus('polling');
            // Poll in the background — complete_github_oauth blocks until approved
            const username = await window.tauriAPI.completeGithubOAuth(flow.deviceCode, flow.interval, currentPath);
            setSyncUsername(username);
            setDeviceFlow(null);
            setSyncStatus('idle');
        } catch (e: any) {
            setSyncError(e?.toString() || 'Login failed');
            setDeviceFlow(null);
            setSyncStatus('error');
        }
    };

    const handleDisconnectGithub = async () => {
        await window.tauriAPI.disconnectGithub();
        setSyncUsername(null);
        setSyncStatus('idle');
        setSyncError(null);
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
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50 backdrop-blur-sm">
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
                            {syncUsername ? (
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                            <Cloud className="text-blue-600 dark:text-blue-400" size={20} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">Connected to GitHub</p>
                                            <p className="text-xs text-gray-500 truncate">@{syncUsername}</p>
                                        </div>
                                        <CheckCircle2 className="text-green-500 shrink-0" size={18} />
                                    </div>
                                    <button
                                        onClick={handleDisconnectGithub}
                                        className="flex items-center justify-center gap-2 mt-1 w-full px-3 py-2 text-xs font-semibold bg-white dark:bg-gray-800 border border-red-200 dark:border-red-900/50 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                    >
                                        <LogOut size={14} />
                                        Disconnect
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-start gap-3 mb-2">
                                        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center mt-0.5 shrink-0">
                                            <Github className="text-gray-600 dark:text-gray-400" size={16} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">GitHub Sync</p>
                                            <p className="text-xs text-gray-500">
                                                Verbinde dein GitHub-Konto, um deine Notizen automatisch zu synchronisieren.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Device Flow: show code when waiting */}
                                    {deviceFlow && (syncStatus === 'polling' || syncStatus === 'waiting-code') && (
                                        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 text-center border border-gray-200 dark:border-gray-700">
                                            <p className="text-xs text-gray-500 mb-2">Gib diesen Code auf GitHub ein:</p>
                                            <p className="text-2xl font-mono font-bold tracking-widest text-gray-900 dark:text-white mb-3 select-all">
                                                {deviceFlow.userCode}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                Browser wurde geöffnet →{' '}
                                                <a
                                                    href={deviceFlow.verificationUri}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-blue-500 hover:underline"
                                                >
                                                    {deviceFlow.verificationUri}
                                                </a>
                                            </p>
                                            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-400">
                                                <RefreshCw size={12} className="animate-spin" />
                                                Warte auf Bestätigung…
                                            </div>
                                        </div>
                                    )}

                                    {syncStatus === 'error' && syncError && (
                                        <p className="text-xs text-red-500 text-center break-words">{syncError}</p>
                                    )}

                                    {!deviceFlow && (
                                        <button
                                            onClick={handleConnectGithub}
                                            disabled={syncStatus === 'polling' || syncStatus === 'waiting-code' || !currentPath}
                                            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
                                        >
                                            <Github size={15} />
                                            Mit GitHub verbinden
                                        </button>
                                    )}

                                    {!currentPath && (
                                        <p className="text-xs text-red-500 text-center mt-1">
                                            Bitte zuerst einen Ordner auswählen.
                                        </p>
                                    )}
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
                                className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
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
                                {['blue', 'purple', 'green', 'red', 'orange'].map((color) => (
                                    <button
                                        key={color}
                                        onClick={() => setAccentColor(color)}
                                        data-accent={color}
                                        className={clsx(
                                            "w-8 h-8 rounded-full flex items-center justify-center transition-all ring-offset-2 dark:ring-offset-gray-800",
                                            accentColor === color ? "ring-2 ring-gray-400 dark:ring-gray-400 scale-110" : "hover:scale-110"
                                        )}
                                        style={{
                                            backgroundColor: color === 'blue' ? '#3b82f6' :
                                                color === 'purple' ? '#a855f7' :
                                                    color === 'green' ? '#22c55e' :
                                                        color === 'red' ? '#ef4444' :
                                                            '#f97316'
                                        }}
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
                                    markdownEnabled ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-700"
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
                                    spellcheckEnabled ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-700"
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

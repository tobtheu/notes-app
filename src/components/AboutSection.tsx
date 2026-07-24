import { RefreshCw, Download, CheckCircle2, Rocket, AlertCircle, Activity, Loader2, Wifi } from 'lucide-react';
import type { HealthStatus } from '../utils/health';

interface AboutSectionProps {
    isIOS: boolean;
    version: string;
    updateStatus: {
        type: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
        progress?: number;
        error?: string;
        version?: string;
    };
    diagResults: HealthStatus[] | null;
    isDiagnosing: boolean;
    handleCheckForUpdates: () => void;
    handleDownloadUpdate: () => void;
    handleInstallUpdate: () => void;
    handleRunDiagnostics: () => void;
}

export function AboutSection({
    isIOS,
    version,
    updateStatus,
    diagResults,
    isDiagnosing,
    handleCheckForUpdates,
    handleDownloadUpdate,
    handleInstallUpdate,
    handleRunDiagnostics
}: AboutSectionProps) {
    return (
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
    );
}

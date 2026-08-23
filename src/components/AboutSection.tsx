import { RefreshCw, Download, CheckCircle2, Rocket, AlertCircle, Activity, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import type { HealthStatus } from '../utils/health';
import logo from '../assets/logo.png';

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
        <div className="space-y-6 text-xs select-none pb-6">
            {/* Hero App Branding Section */}
            <div>
                <label className="block font-semibold text-[var(--text-main)] mb-2.5">Application Info</label>
                <div className="text-center py-5 bg-[var(--card-hover)] rounded-2xl border border-[var(--border-subtle)] p-5">
                    <img
                        src={logo}
                        alt="Lama Notes"
                        className="w-14 h-14 mx-auto mb-2.5 rounded-2xl shadow-sm object-contain select-none pointer-events-none"
                    />
                    <h4 className="font-bold text-[var(--text-main)] text-sm">LamaNotes</h4>
                    <p className="text-[var(--text-muted)] font-mono text-xs mt-0.5">Version {version || '0.7.12'}</p>
                    <p className="text-[var(--text-muted)] text-[11px] mt-1 font-medium">© Tobias Theunissen</p>
                    
                    <div className="flex justify-center gap-2 mt-4">
                        {!isIOS && (
                            <button
                                type="button"
                                onClick={handleCheckForUpdates}
                                className="smooth-transition px-3.5 py-1.5 rounded-xl bg-[var(--canvas-bg)] border border-[var(--border-subtle)] text-[var(--text-main)] hover:border-[var(--accent-color)] font-medium text-xs shadow-sm active:scale-95 flex items-center gap-1.5"
                            >
                                <RefreshCw size={12} className={updateStatus.type === 'checking' ? 'animate-spin' : ''} />
                                <span>Check for Updates</span>
                            </button>
                        )}
                        {import.meta.env.DEV && (
                            <button
                                type="button"
                                onClick={handleRunDiagnostics}
                                disabled={isDiagnosing}
                                className="smooth-transition px-3.5 py-1.5 rounded-xl bg-[var(--canvas-bg)] border border-[var(--border-subtle)] text-[var(--text-main)] hover:border-[var(--accent-color)] font-medium text-xs shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {isDiagnosing ? <Loader2 size={12} className="animate-spin" /> : <Activity size={12} />}
                                <span>Diagnostics</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Real-time Update Status Display */}
            {updateStatus.type !== 'idle' && (
                <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2.5">
                    <label className="block font-semibold text-[var(--text-main)] mb-2">Software Update</label>
                    <div className="bg-[var(--card-hover)] rounded-2xl p-4 border border-[var(--border-subtle)]">
                        {updateStatus.type === 'checking' && (
                            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                                <RefreshCw size={13} className="animate-spin text-[var(--accent-color)]" />
                                <span>Checking for updates...</span>
                            </div>
                        )}

                        {updateStatus.type === 'available' && (
                            <div className="flex flex-col gap-2.5">
                                <div className="flex items-start gap-2 text-xs text-[var(--accent-color)]">
                                    <RefreshCw size={14} className="mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-bold">Update Available ({updateStatus.version})</p>
                                        <p className="text-[11px] opacity-80 text-[var(--text-muted)]">A new version is ready to download.</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleDownloadUpdate}
                                    className="smooth-transition w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold bg-[var(--accent-color)] text-white rounded-xl shadow-sm hover:opacity-90 active:scale-95"
                                >
                                    <Download size={14} />
                                    Download Now
                                </button>
                            </div>
                        )}

                        {updateStatus.type === 'downloading' && (
                            <div className="flex flex-col gap-1.5">
                                <div className="flex justify-between text-xs font-medium mb-1">
                                    <span className="text-[var(--text-muted)]">Downloading update...</span>
                                    <span className="text-[var(--accent-color)] font-bold">{Math.round(updateStatus.progress || 0)}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-[var(--accent-color)] transition-all duration-300"
                                        style={{ width: `${updateStatus.progress || 0}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {updateStatus.type === 'downloaded' && (
                            <div className="flex flex-col gap-2.5">
                                <div className="flex items-start gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-bold">Update Ready</p>
                                        <p className="text-[11px] text-[var(--text-muted)]">Download complete. Restart application to apply.</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleInstallUpdate}
                                    className="smooth-transition w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm active:scale-95"
                                >
                                    <Rocket size={14} />
                                    Restart & Install
                                </button>
                            </div>
                        )}

                        {updateStatus.type === 'not-available' && (
                            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 size={14} />
                                <span>You are on the latest version!</span>
                            </div>
                        )}

                        {updateStatus.type === 'error' && (
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2 text-xs text-red-500">
                                    <AlertCircle size={14} />
                                    <span className="font-semibold">Update check failed</span>
                                </div>
                                <p className="text-[10px] text-red-400 pl-5 break-all">{updateStatus.error}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Connection Diagnostic Results */}
            {import.meta.env.DEV && diagResults && (
                <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2.5">
                    <label className="block font-semibold text-[var(--text-main)] mb-2">Connection Diagnostics</label>
                    <div className="space-y-1.5 p-3 rounded-2xl bg-[var(--card-hover)] border border-[var(--border-subtle)]">
                        {diagResults.map((res, i) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-[var(--canvas-bg)] text-xs border border-[var(--border-subtle)]">
                                <div className="flex items-center gap-2">
                                    <span className={clsx("w-2 h-2 rounded-full", res.ok ? "bg-emerald-500" : "bg-red-500")} />
                                    <span className="font-medium text-[var(--text-main)]">{res.service}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {res.latency !== undefined && res.latency > 0 && (
                                        <span className="text-[10px] font-mono text-[var(--text-muted)]">{res.latency}ms</span>
                                    )}
                                    {res.ok ? (
                                        <CheckCircle2 size={13} className="text-emerald-500" />
                                    ) : (
                                        <AlertCircle size={13} className="text-red-500" />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

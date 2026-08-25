import { Cloud, CloudOff, CheckCircle2, Clock, LogOut, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
import type { SyncStatus } from '../types';

interface CloudSyncStatusCardProps {
    userEmail: string;
    syncStatus?: SyncStatus;
    hasPending?: boolean;
    signOutStep: 'idle' | 'ask' | 'confirm-delete';
    setSignOutStep: (step: 'idle' | 'ask' | 'confirm-delete') => void;
    signOutLoading: boolean;
    deleteAccountStep: 'idle' | 'confirm';
    setDeleteAccountStep: (step: 'idle' | 'confirm') => void;
    deleteAccountLoading: boolean;
    handleSignOutConfirm: (deleteLocal: boolean) => void;
    handleDeleteAccountConfirm: () => void;
}

export function CloudSyncStatusCard({
    userEmail,
    syncStatus,
    hasPending = false,
    signOutStep,
    setSignOutStep,
    signOutLoading,
    deleteAccountStep,
    setDeleteAccountStep,
    deleteAccountLoading,
    handleSignOutConfirm,
    handleDeleteAccountConfirm,
}: CloudSyncStatusCardProps) {
    return (
        <div className="flex flex-col gap-3.5">
            {/* Connected state */}
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[var(--canvas-bg)] flex items-center justify-center text-[var(--accent-color)] shrink-0 border border-[var(--border-subtle)] shadow-sm">
                    <Cloud size={18} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-xs text-[var(--text-main)] truncate">Cloud Sync Active</p>
                    <p className="text-[11px] text-[var(--text-muted)] truncate">{userEmail}</p>
                </div>
                {syncStatus === 'synced' && !hasPending && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium shrink-0">
                        <CheckCircle2 size={13} />
                        <span>Synced</span>
                    </div>
                )}
                {syncStatus === 'pending' && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[11px] font-medium shrink-0">
                        <Clock size={13} />
                        <span>Syncing</span>
                    </div>
                )}
                {syncStatus === 'offline' && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-500/10 border border-gray-500/20 text-[var(--text-muted)] text-[11px] font-medium shrink-0">
                        <CloudOff size={13} />
                        <span>Offline</span>
                    </div>
                )}
            </div>

            {syncStatus === 'pending' && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed pl-0.5">
                    {navigator.onLine
                        ? "Syncing pending changes in the background..."
                        : "Pending changes will sync as soon as you're back online."}
                </p>
            )}

            {/* Sign-out & Delete Account Actions */}
            <div className="space-y-2 pt-3 border-t border-[var(--border-subtle)]">
                {signOutStep === 'idle' && (
                    <button
                        type="button"
                        onClick={() => setSignOutStep('ask')}
                        className="smooth-transition flex items-center justify-center gap-2 w-full py-2 text-xs font-semibold bg-[var(--canvas-bg)] border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors active:scale-95 shadow-sm"
                    >
                        <LogOut size={13} />
                        <span>Sign Out</span>
                    </button>
                )}

                {signOutStep === 'ask' && (
                    <div className="space-y-2 p-3 bg-[var(--canvas-bg)] rounded-xl border border-[var(--border-subtle)]">
                        <p className="font-semibold text-xs text-[var(--text-main)] text-center">Do you want to keep your notes on this device?</p>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => handleSignOutConfirm(false)}
                                disabled={signOutLoading}
                                className="smooth-transition py-1.5 px-2 text-xs font-medium bg-[var(--card-hover)] hover:bg-[var(--accent-color)] hover:text-white rounded-lg border border-[var(--border-subtle)] text-[var(--text-main)] transition-colors active:scale-95 disabled:opacity-50"
                            >
                                Keep Local Notes
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSignOutConfirm(true)}
                                disabled={signOutLoading}
                                className="smooth-transition py-1.5 px-2 text-xs font-medium bg-red-500/10 hover:bg-red-500 hover:text-white rounded-lg border border-red-500/20 text-red-600 dark:text-red-400 transition-colors active:scale-95 disabled:opacity-50"
                            >
                                Delete Local Notes
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSignOutStep('idle')}
                            className="w-full text-center text-[11px] text-[var(--text-muted)] hover:text-[var(--text-main)] pt-1"
                        >
                            Cancel
                        </button>
                    </div>
                )}

                {/* Delete Account */}
                {deleteAccountStep === 'idle' && (
                    <button
                        type="button"
                        onClick={() => setDeleteAccountStep('confirm')}
                        className="w-full text-center text-[11px] text-[var(--text-muted)] hover:text-red-500 transition-colors py-1"
                    >
                        Delete Account Permanently...
                    </button>
                )}

                {deleteAccountStep === 'confirm' && (
                    <div className="space-y-2 p-3 bg-red-500/5 rounded-xl border border-red-500/20">
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                            <AlertTriangle size={14} className="shrink-0" />
                            <p className="font-semibold text-xs">Delete Cloud Account?</p>
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                            All your notes and account data in the cloud will be permanently deleted. Local notes on this device will remain intact.
                        </p>
                        <div className="flex items-center gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setDeleteAccountStep('idle')}
                                disabled={deleteAccountLoading}
                                className="smooth-transition flex-1 py-1.5 text-xs font-medium bg-[var(--canvas-bg)] hover:bg-[var(--card-hover)] rounded-lg border border-[var(--border-subtle)] text-[var(--text-main)] active:scale-95 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteAccountConfirm}
                                disabled={deleteAccountLoading}
                                className="smooth-transition flex-1 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
                            >
                                {deleteAccountLoading ? (
                                    <RefreshCw size={12} className="animate-spin text-white" />
                                ) : (
                                    <Trash2 size={12} />
                                )}
                                <span>{deleteAccountLoading ? 'Deleting...' : 'Delete Permanently'}</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

import { Cloud, CloudOff, CheckCircle2, Clock, LogOut, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import type { SyncStatus } from '../hooks/useNotes';

interface CloudSyncSectionProps {
    userEmail?: string | null;
    syncStatus?: SyncStatus;
    hasPending?: boolean;
    signOutStep: 'idle' | 'ask' | 'confirm-delete';
    setSignOutStep: (step: 'idle' | 'ask' | 'confirm-delete') => void;
    signOutLoading: boolean;
    deleteAccountStep: 'idle' | 'confirm';
    setDeleteAccountStep: (step: 'idle' | 'confirm') => void;
    deleteAccountLoading: boolean;
    authMode: 'signin' | 'signup';
    setAuthMode: (mode: 'signin' | 'signup') => void;
    authEmail: string;
    setAuthEmail: (email: string) => void;
    authPassword: string;
    setAuthPassword: (password: string) => void;
    authError: string | null;
    authLoading: boolean;
    handleAuth: () => void;
    handleSignOutConfirm: (deleteLocal: boolean) => void;
    handleDeleteAccountConfirm: () => void;
}

export function CloudSyncSection({
    userEmail,
    syncStatus,
    hasPending = false,
    signOutStep,
    setSignOutStep,
    signOutLoading,
    deleteAccountStep,
    setDeleteAccountStep,
    deleteAccountLoading,
    authMode,
    setAuthMode,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    authError,
    authLoading,
    handleAuth,
    handleSignOutConfirm,
    handleDeleteAccountConfirm,
}: CloudSyncSectionProps) {
    return (
        <div className="space-y-6 text-xs select-none pb-6">
            <div className="bg-[var(--card-hover)] rounded-2xl p-4 border border-[var(--border-subtle)]">
                {userEmail ? (
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
                                <div className="bg-[var(--canvas-bg)] rounded-xl p-3 border border-[var(--border-subtle)] flex flex-col gap-2">
                                    <p className="text-xs font-medium text-[var(--text-main)]">Keep local notes after signing out?</p>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => setSignOutStep('idle')} className="smooth-transition flex-1 py-1.5 text-xs rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5 active:scale-95">Cancel</button>
                                        <button type="button" onClick={() => handleSignOutConfirm(false)} disabled={signOutLoading} className="smooth-transition flex-1 py-1.5 text-xs rounded-lg bg-[var(--accent-color)] text-white hover:opacity-90 disabled:opacity-50 active:scale-95">Keep</button>
                                        <button type="button" onClick={() => setSignOutStep('confirm-delete')} className="smooth-transition flex-1 py-1.5 text-xs rounded-lg border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 active:scale-95">Delete</button>
                                    </div>
                                </div>
                            )}

                            {signOutStep === 'confirm-delete' && (
                                <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-500/30 rounded-xl p-3 flex flex-col gap-2">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle size={14} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                                        <p className="text-[11px] text-red-600 dark:text-red-400">All local notes will be <strong>permanently deleted</strong>. This action cannot be undone.</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => setSignOutStep('ask')} className="smooth-transition flex-1 py-1.5 text-xs rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] active:scale-95">Back</button>
                                        <button type="button" onClick={() => handleSignOutConfirm(true)} disabled={signOutLoading} className="smooth-transition flex-1 py-1.5 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 active:scale-95">
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
                                    className="smooth-transition flex items-center justify-center gap-2 w-full py-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-red-500 transition-colors active:scale-95"
                                >
                                    <Trash2 size={13} />
                                    <span>Delete Account</span>
                                </button>
                            )}

                            {deleteAccountStep === 'confirm' && (
                                <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-500/30 rounded-xl p-3 flex flex-col gap-2">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle size={14} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                                        <p className="text-[11px] text-red-600 dark:text-red-400">Your account and <strong>all stored data will be permanently deleted</strong>.</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => setDeleteAccountStep('idle')} className="smooth-transition flex-1 py-1.5 text-xs rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] active:scale-95">Cancel</button>
                                        <button type="button" onClick={handleDeleteAccountConfirm} disabled={deleteAccountLoading} className="smooth-transition flex-1 py-1.5 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 active:scale-95">
                                            {deleteAccountLoading ? 'Deleting...' : 'Delete Account'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {/* Local Mode Status & Exit */}
                        <div className="p-3.5 rounded-2xl bg-[var(--card-hover)] border border-[var(--border-subtle)] space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-[var(--canvas-bg)] flex items-center justify-center text-gray-500 dark:text-gray-400 shrink-0 border border-[var(--border-subtle)] shadow-sm">
                                    <CloudOff size={18} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-xs text-[var(--text-main)] truncate">Lokaler Modus (Offline)</p>
                                    <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                                        Notizen werden ausschließlich lokal auf diesem Gerät gespeichert.
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => handleSignOutConfirm(false)}
                                disabled={signOutLoading}
                                className="smooth-transition flex items-center justify-center gap-2 w-full py-2 text-xs font-semibold bg-[var(--canvas-bg)] border border-[var(--border-subtle)] text-[var(--text-main)] hover:border-[var(--accent-color)] rounded-xl transition-colors active:scale-95 shadow-sm disabled:opacity-50"
                            >
                                <LogOut size={13} />
                                <span>Zum Startbildschirm wechseln</span>
                            </button>
                        </div>

                        {/* Cloud Connect Section */}
                        <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-[var(--canvas-bg)] flex items-center justify-center text-[var(--accent-color)] shrink-0 border border-[var(--border-subtle)] shadow-sm">
                                    <Cloud size={18} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-xs text-[var(--text-main)] truncate">LamaNotes Cloud verbinden</p>
                                    <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                                        Melde dich an, um Notizen nahtlos auf allen Geräten zu synchronisieren.
                                    </p>
                                </div>
                            </div>

                            {/* Sign In / Sign Up Switcher */}
                            <div className="flex items-center gap-1.5 p-1 bg-[var(--canvas-bg)] rounded-xl border border-[var(--border-subtle)]">
                                <button
                                    type="button"
                                    onClick={() => setAuthMode('signin')}
                                    className={clsx(
                                        "flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all min-w-0 truncate active:scale-98",
                                        authMode === 'signin'
                                            ? 'bg-[var(--card-hover)] text-[var(--text-main)] shadow-sm border border-[var(--border-subtle)]'
                                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                                    )}
                                >
                                    Sign In
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAuthMode('signup')}
                                    className={clsx(
                                        "flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all min-w-0 truncate active:scale-98",
                                        authMode === 'signup'
                                            ? 'bg-[var(--card-hover)] text-[var(--text-main)] shadow-sm border border-[var(--border-subtle)]'
                                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                                    )}
                                >
                                    Sign Up
                                </button>
                            </div>

                            <div className="space-y-2">
                                <input
                                    type="email"
                                    placeholder="Email address"
                                    value={authEmail}
                                    onChange={e => setAuthEmail(e.target.value)}
                                    className="smooth-transition w-full px-3 py-2 text-xs rounded-xl border border-[var(--border-subtle)] bg-[var(--canvas-bg)] text-[var(--text-main)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent-color)] focus:ring-1 focus:ring-[var(--accent-color)]/30"
                                />
                                <input
                                    type="password"
                                    placeholder="Password"
                                    value={authPassword}
                                    onChange={e => setAuthPassword(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAuth()}
                                    className="smooth-transition w-full px-3 py-2 text-xs rounded-xl border border-[var(--border-subtle)] bg-[var(--canvas-bg)] text-[var(--text-main)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent-color)] focus:ring-1 focus:ring-[var(--accent-color)]/30"
                                />
                            </div>

                            {authError && (
                                <p className="text-[11px] text-red-500 text-center break-words bg-red-500/10 p-2 rounded-lg border border-red-500/20">{authError}</p>
                            )}

                            <button
                                type="button"
                                onClick={handleAuth}
                                disabled={authLoading || !authEmail || !authPassword}
                                className="smooth-transition w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold bg-[var(--accent-color)] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-sm active:scale-95"
                            >
                                {authLoading ? (
                                    <><RefreshCw size={13} className="animate-spin" /> Please wait…</>
                                ) : authMode === 'signin' ? 'Sign In' : 'Create Account'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

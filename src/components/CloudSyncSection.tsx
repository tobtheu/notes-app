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
                                {navigator.onLine
                                    ? "Syncing pending changes in the background..."
                                    : "Pending changes will sync as soon as you're back online."}
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
                                className={clsx(
                                    "flex-1 py-1.5 transition-colors",
                                    authMode === 'signin'
                                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                                )}
                            >Sign In</button>
                            <button
                                type="button"
                                onClick={() => setAuthMode('signup')}
                                className={clsx(
                                    "flex-1 py-1.5 transition-colors",
                                    authMode === 'signup'
                                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                                )}
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
    );
}

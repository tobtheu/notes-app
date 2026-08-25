import type { SyncStatus } from '../types';
import { CloudSyncStatusCard } from './CloudSyncStatusCard';
import { CloudSyncAuthForm } from './CloudSyncAuthForm';

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
                    <CloudSyncStatusCard
                        userEmail={userEmail}
                        syncStatus={syncStatus}
                        hasPending={hasPending}
                        signOutStep={signOutStep}
                        setSignOutStep={setSignOutStep}
                        signOutLoading={signOutLoading}
                        deleteAccountStep={deleteAccountStep}
                        setDeleteAccountStep={setDeleteAccountStep}
                        deleteAccountLoading={deleteAccountLoading}
                        handleSignOutConfirm={handleSignOutConfirm}
                        handleDeleteAccountConfirm={handleDeleteAccountConfirm}
                    />
                ) : (
                    <CloudSyncAuthForm
                        authMode={authMode}
                        setAuthMode={setAuthMode}
                        authEmail={authEmail}
                        setAuthEmail={setAuthEmail}
                        authPassword={authPassword}
                        setAuthPassword={setAuthPassword}
                        authError={authError}
                        authLoading={authLoading}
                        handleAuth={handleAuth}
                        handleSignOutConfirm={handleSignOutConfirm}
                        signOutLoading={signOutLoading}
                    />
                )}
            </div>
        </div>
    );
}

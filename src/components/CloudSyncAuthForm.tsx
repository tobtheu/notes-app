import { Cloud, CloudOff, LogOut, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from '../i18n';

interface CloudSyncAuthFormProps {
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
    signOutLoading?: boolean;
}

export function CloudSyncAuthForm({
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
    signOutLoading = false,
}: CloudSyncAuthFormProps) {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col gap-4">
            {/* Local Mode Status & Exit */}
            <div className="p-3.5 rounded-2xl bg-[var(--card-hover)] border border-[var(--border-subtle)] space-y-3">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[var(--canvas-bg)] flex items-center justify-center text-gray-500 dark:text-gray-400 shrink-0 border border-[var(--border-subtle)] shadow-sm">
                        <CloudOff size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="font-semibold text-xs text-[var(--text-main)] truncate">{t('onboarding.localTitle')}</p>
                        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                            {t('onboarding.localDesc')}
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
                    <span>{t('onboarding.useLocally')}</span>
                </button>
            </div>

            {/* Cloud Connect Section */}
            <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[var(--canvas-bg)] flex items-center justify-center text-[var(--accent-color)] shrink-0 border border-[var(--border-subtle)] shadow-sm">
                        <Cloud size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="font-semibold text-xs text-[var(--text-main)] truncate">{t('settings.syncSection.title')}</p>
                        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                            {t('settings.syncSection.description')}
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
                        {t('settings.syncSection.signIn')}
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
                        {t('settings.syncSection.signUp')}
                    </button>
                </div>

                <div className="space-y-2">
                    <input
                        type="email"
                        placeholder={t('settings.syncSection.email')}
                        value={authEmail}
                        onChange={e => setAuthEmail(e.target.value)}
                        className="smooth-transition w-full px-3 py-2 text-xs rounded-xl border border-[var(--border-subtle)] bg-[var(--canvas-bg)] text-[var(--text-main)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent-color)] focus:ring-1 focus:ring-[var(--accent-color)]/30"
                    />
                    <input
                        type="password"
                        placeholder={t('settings.syncSection.password')}
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
                        <><RefreshCw size={13} className="animate-spin" /> {t('common.loading')}</>
                    ) : authMode === 'signin' ? t('settings.syncSection.signIn') : t('settings.syncSection.signUp')}
                </button>
            </div>
        </div>
    );
}


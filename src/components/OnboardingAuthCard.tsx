import { Loader2, ArrowLeft, Check } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from '../i18n';

interface OnboardingAuthCardProps {
    authMode: 'signin' | 'signup';
    setAuthMode: (mode: 'signin' | 'signup') => void;
    email: string;
    setEmail: (email: string) => void;
    password: string;
    setPassword: (password: string) => void;
    isLoading: boolean;
    error: string | null;
    success: boolean;
    onSubmit: (e: React.FormEvent) => void;
    onBack: () => void;
}

export function OnboardingAuthCard({
    authMode,
    setAuthMode,
    email,
    setEmail,
    password,
    setPassword,
    isLoading,
    error,
    success,
    onSubmit,
    onBack,
}: OnboardingAuthCardProps) {
    const { t } = useTranslation();

    return (
        <div className="w-full animate-note-fade">
            <button
                type="button"
                onClick={onBack}
                className="smooth-transition flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] mb-4 -ml-1 py-1 px-2 rounded-lg hover:bg-[var(--card-hover)] active:scale-95"
            >
                <ArrowLeft size={14} />
                <span>{t('onboarding.back')}</span>
            </button>

            <h1 className="text-xl sm:text-2xl font-extrabold mb-1 tracking-tight text-[var(--text-main)]">
                {authMode === 'signin' ? t('onboarding.signInTitle') : t('onboarding.signUpTitle')}
            </h1>
            <p className="mb-5 text-[var(--text-muted)] text-xs leading-relaxed">
                {authMode === 'signin'
                    ? t('onboarding.signInSubtitle')
                    : t('onboarding.signUpSubtitle')}
            </p>

            <form onSubmit={onSubmit} className="space-y-3 w-full">
                <input
                    type="email"
                    required
                    placeholder={t('onboarding.emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading || success}
                    className="smooth-transition w-full px-3.5 py-2.5 bg-[var(--card-hover)]/70 border border-[var(--border-subtle)]/60 rounded-xl text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-color)] focus:bg-[var(--card-hover)]"
                />
                <input
                    type="password"
                    required
                    placeholder={t('onboarding.passwordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading || success}
                    className="smooth-transition w-full px-3.5 py-2.5 bg-[var(--card-hover)]/70 border border-[var(--border-subtle)]/60 rounded-xl text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-color)] focus:bg-[var(--card-hover)]"
                />

                {error && (
                    <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs text-left">
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isLoading || success}
                    className={clsx(
                        "smooth-transition w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-white shadow-sm active:scale-[0.98] flex items-center justify-center gap-2",
                        success ? "bg-emerald-500" : "bg-[var(--accent-color)] hover:opacity-90 disabled:opacity-50"
                    )}
                >
                    {isLoading ? (
                        <Loader2 size={14} className="animate-spin" />
                    ) : success ? (
                        <>
                            <Check size={14} />
                            <span>{t('onboarding.signedIn')}</span>
                        </>
                    ) : (
                        <span>{authMode === 'signin' ? t('onboarding.signInBtn') : t('onboarding.signUpBtn')}</span>
                    )}
                </button>

                <div className="pt-2 text-center">
                    <button
                        type="button"
                        onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
                        className="smooth-transition text-xs text-[var(--text-muted)] hover:text-[var(--accent-color)] py-1 px-2 rounded-lg hover:bg-[var(--card-hover)]"
                    >
                        {authMode === 'signin'
                            ? t('onboarding.needAccount')
                            : t('onboarding.haveAccount')}
                    </button>
                </div>
            </form>
        </div>
    );
}


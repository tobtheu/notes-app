import { useState } from 'react';
import { Loader2, Mail, FolderOpen, ChevronRight, ArrowLeft, Check } from 'lucide-react';
import logo from '../assets/logo.png';

interface Props {
    onSelectFolder: () => void;
    onSetupWorkspace: () => Promise<void>;
    onSignIn?: (email: string, password: string) => Promise<{ userId: string; email: string }>;
    onSignUp?: (email: string, password: string) => Promise<{ userId: string; email: string }>;
    onLocalOnly?: () => Promise<void>;
}

type Screen = 'choice' | 'email';
type AuthMode = 'signin' | 'signup';

export function OnboardingScreen({ onSelectFolder, onSetupWorkspace, onSignIn, onSignUp, onLocalOnly }: Props) {
    const [screen, setScreen] = useState<Screen>('choice');
    const [authMode, setAuthMode] = useState<AuthMode>('signin');

    // Email auth state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleLocalOnly = async () => {
        setIsLoading(true);
        try {
            if (onLocalOnly) {
                await onLocalOnly();
            } else {
                onSelectFolder();
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            if (authMode === 'signin') {
                if (onSignIn) {
                    await onSignIn(email, password);
                } else {
                    await (window as any).tauriAPI?.supabaseSignIn(email, password);
                }
            } else {
                if (onSignUp) {
                    await onSignUp(email, password);
                } else {
                    await (window as any).tauriAPI?.supabaseSignUp(email, password);
                }
            }
            setSuccess(true);
            // Short delay so user sees the checkmark, then load the workspace
            setTimeout(async () => {
                await onSetupWorkspace();
            }, 600);
        } catch (e: any) {
            const msg = e?.toString() ?? '';
            if (msg.includes('Invalid login credentials') || msg.includes('invalid_grant')) {
                setError('Email or password is incorrect.');
            } else if (msg.includes('User already registered')) {
                setError('This email is already registered. Please sign in instead.');
            } else if (msg.includes('Password should be at least')) {
                setError('Password must be at least 6 characters long.');
            } else {
                setError('Connection failed. Please check your internet connection.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center absolute inset-0 w-full h-full bg-[var(--shell-bg)] text-[var(--text-main)] p-4 sm:p-6 text-center select-none transition-colors duration-500">
            <div className="w-full max-w-[440px] bg-[var(--canvas-bg)] border border-[var(--border-subtle)] rounded-[28px] p-6 sm:p-8 shadow-2xl animate-modal-spring flex flex-col items-center">
                {/* App Logo */}
                <img
                    src={logo}
                    alt="Logo"
                    className="w-16 h-16 rounded-2xl shadow-md object-contain select-none pointer-events-none mb-5"
                />

                {screen === 'choice' && (
                    <div className="w-full animate-note-fade">
                        <h1 className="text-2xl sm:text-3xl font-extrabold mb-1.5 tracking-tight text-[var(--text-main)]">Welcome to Lama</h1>
                        <p className="mb-6 text-[var(--text-muted)] text-sm leading-relaxed">
                            Your thoughts, beautifully formatted and synced everywhere.
                        </p>

                        <div className="grid gap-2.5 w-full">
                            {/* Supabase email auth */}
                            <button
                                type="button"
                                onClick={() => { setScreen('email'); setAuthMode('signin'); }}
                                className="group flex items-center justify-between p-3.5 bg-[var(--card-hover)] hover:bg-[var(--card-active)] border border-[var(--border-subtle)] rounded-2xl transition-all shadow-sm active:scale-[0.98]"
                            >
                                <div className="flex items-center gap-3.5 text-left">
                                    <div className="w-10 h-10 bg-[var(--accent-color)] rounded-xl flex items-center justify-center text-white shrink-0">
                                        <Mail className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-[var(--text-main)]">Sign in with Email</div>
                                        <div className="text-xs text-[var(--text-muted)]">Cloud sync across all devices</div>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-main)] transition-colors" />
                            </button>

                            {/* Google — future */}
                            <button
                                type="button"
                                disabled
                                className="flex items-center justify-between p-3.5 bg-[var(--card-hover)] border border-[var(--border-subtle)] rounded-2xl opacity-40 cursor-not-allowed"
                            >
                                <div className="flex items-center gap-3.5 text-left">
                                    <div className="w-10 h-10 bg-white dark:bg-gray-800 border border-[var(--border-subtle)] rounded-xl flex items-center justify-center shrink-0">
                                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-[var(--text-main)]">Sign in with Google</div>
                                        <div className="text-xs text-[var(--text-muted)]">Coming soon</div>
                                    </div>
                                </div>
                            </button>

                            {/* Apple — future */}
                            <button
                                type="button"
                                disabled
                                className="flex items-center justify-between p-3.5 bg-[var(--card-hover)] border border-[var(--border-subtle)] rounded-2xl opacity-40 cursor-not-allowed"
                            >
                                <div className="flex items-center gap-3.5 text-left">
                                    <div className="w-10 h-10 bg-black dark:bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                                        <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
                                            <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-[var(--text-main)]">Sign in with Apple</div>
                                        <div className="text-xs text-[var(--text-muted)]">Coming soon</div>
                                    </div>
                                </div>
                            </button>

                            {/* Divider */}
                            <div className="flex items-center gap-3 my-1">
                                <div className="flex-1 h-px bg-[var(--border-subtle)]" />
                                <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">or</span>
                                <div className="flex-1 h-px bg-[var(--border-subtle)]" />
                            </div>

                            {/* Local only */}
                            <button
                                type="button"
                                onClick={handleLocalOnly}
                                disabled={isLoading}
                                className="group flex items-center justify-between p-3.5 bg-transparent border border-[var(--border-subtle)] hover:bg-[var(--card-hover)] rounded-2xl transition-all active:scale-[0.98] disabled:opacity-60"
                            >
                                <div className="flex items-center gap-3.5 text-left">
                                    <div className="w-10 h-10 bg-black/5 dark:bg-white/5 rounded-xl flex items-center justify-center text-[var(--text-muted)] shrink-0">
                                        {isLoading ? (
                                            <Loader2 className="w-5 h-5 animate-spin text-[var(--accent-color)]" />
                                        ) : (
                                            <FolderOpen className="w-5 h-5" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="font-semibold text-sm text-[var(--text-main)]">Use locally only</div>
                                        <div className="text-xs text-[var(--text-muted)]">No account required, 100% offline</div>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>
                )}

                {screen === 'email' && (
                    <div className="w-full animate-note-fade">
                        <button
                            type="button"
                            onClick={() => { setScreen('choice'); setError(null); }}
                            className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] mb-5 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </button>

                        <h2 className="text-xl font-bold mb-1 text-left text-[var(--text-main)]">
                            {authMode === 'signin' ? 'Sign In' : 'Create Account'}
                        </h2>
                        <p className="text-xs text-[var(--text-muted)] mb-5 text-left">
                            {authMode === 'signin'
                                ? 'Sign in to sync your notes seamlessly.'
                                : 'Create an account for cloud synchronization.'}
                        </p>

                        <form onSubmit={handleEmailAuth} className="flex flex-col gap-2.5">
                            <input
                                type="email"
                                placeholder="Email address"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                                className="w-full px-3.5 py-2.5 bg-[var(--card-hover)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent-color)] focus:ring-2 focus:ring-[var(--accent-color)]/20 transition-all placeholder-[var(--text-muted)]"
                            />
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                                minLength={6}
                                className="w-full px-3.5 py-2.5 bg-[var(--card-hover)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent-color)] focus:ring-2 focus:ring-[var(--accent-color)]/20 transition-all placeholder-[var(--text-muted)]"
                            />

                            {error && (
                                <p className="text-red-500 text-xs text-left font-medium">{error}</p>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading || success}
                                className="w-full py-2.5 bg-[var(--accent-color)] hover:opacity-90 text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-1 shadow-sm active:scale-[0.98]"
                            >
                                {success ? (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Success!
                                    </>
                                ) : isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Please wait...
                                    </>
                                ) : authMode === 'signin' ? 'Sign In' : 'Create Account'}
                            </button>
                        </form>

                        <div className="mt-4 text-xs text-[var(--text-muted)]">
                            {authMode === 'signin' ? (
                                <>
                                    Don't have an account?{' '}
                                    <button
                                        type="button"
                                        onClick={() => { setAuthMode('signup'); setError(null); }}
                                        className="text-[var(--accent-color)] hover:underline font-semibold"
                                    >
                                        Sign Up
                                    </button>
                                </>
                            ) : (
                                <>
                                    Already registered?{' '}
                                    <button
                                        type="button"
                                        onClick={() => { setAuthMode('signin'); setError(null); }}
                                        className="text-[var(--accent-color)] hover:underline font-semibold"
                                    >
                                        Sign In
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

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

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            if (authMode === 'signin') {
                if (onSignIn) {
                    await onSignIn(email, password);
                } else {
                    await window.tauriAPI.supabaseSignIn(email, password);
                }
            } else {
                if (onSignUp) {
                    await onSignUp(email, password);
                } else {
                    await window.tauriAPI.supabaseSignUp(email, password);
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
                setError('E-Mail oder Passwort ist falsch.');
            } else if (msg.includes('User already registered')) {
                setError('Diese E-Mail ist bereits registriert. Melde dich stattdessen an.');
            } else if (msg.includes('Password should be at least')) {
                setError('Das Passwort muss mindestens 6 Zeichen lang sein.');
            } else {
                setError('Verbindung fehlgeschlagen. Bitte überprüfe deine Internetverbindung.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center fixed inset-0 bg-gray-50 text-gray-800 dark:bg-gray-900 dark:text-gray-100 p-6 text-center">
            {/* Logo */}
            <div className="w-20 h-20 bg-white dark:bg-gray-800 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-primary-500/10 rotate-3 animate-in fade-in zoom-in duration-500 overflow-hidden">
                <img src={logo} alt="Logo" className="w-16 h-16 object-contain" />
            </div>

            {screen === 'choice' && (
                <div className="max-w-sm w-full animate-in slide-in-from-bottom-4 duration-500">
                    <h1 className="text-4xl font-black mb-3 tracking-tight">Willkommen</h1>
                    <p className="mb-10 text-gray-500 dark:text-gray-400 text-lg leading-relaxed">
                        Deine Gedanken, überall synchronisiert.
                    </p>

                    <div className="grid gap-3 w-full">
                        {/* Supabase email auth */}
                        <button
                            onClick={() => { setScreen('email'); setAuthMode('signin'); }}
                            className="group flex items-center justify-between px-6 py-5 bg-white dark:bg-gray-800 border-2 border-transparent hover:border-primary-500 rounded-2xl transition-all shadow-sm hover:shadow-xl active:scale-[0.98]"
                        >
                            <div className="flex items-center gap-4 text-left">
                                <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center text-white">
                                    <Mail className="w-6 h-6" />
                                </div>
                                <div>
                                    <div className="font-bold text-lg">Mit Email anmelden</div>
                                    <div className="text-sm text-gray-500">Cloud-Sync über alle Geräte</div>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary-600 transition-colors" />
                        </button>

                        {/* Google — future */}
                        <button
                            disabled
                            className="flex items-center justify-between px-6 py-5 bg-white dark:bg-gray-800 border-2 border-transparent rounded-2xl opacity-40 cursor-not-allowed shadow-sm"
                        >
                            <div className="flex items-center gap-4 text-left">
                                <div className="w-12 h-12 bg-white border border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-center">
                                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                </div>
                                <div>
                                    <div className="font-bold text-lg">Mit Google anmelden</div>
                                    <div className="text-sm text-gray-500">Demnächst verfügbar</div>
                                </div>
                            </div>
                        </button>

                        {/* Apple — future */}
                        <button
                            disabled
                            className="flex items-center justify-between px-6 py-5 bg-white dark:bg-gray-800 border-2 border-transparent rounded-2xl opacity-40 cursor-not-allowed shadow-sm"
                        >
                            <div className="flex items-center gap-4 text-left">
                                <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center">
                                    <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24">
                                        <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
                                    </svg>
                                </div>
                                <div>
                                    <div className="font-bold text-lg">Mit Apple anmelden</div>
                                    <div className="text-sm text-gray-500">Demnächst verfügbar</div>
                                </div>
                            </div>
                        </button>

                        {/* Divider */}
                        <div className="flex items-center gap-3 my-1">
                            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                            <span className="text-xs text-gray-400">oder</span>
                            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                        </div>

                        {/* Local only */}
                        <button
                            type="button"
                            onClick={onLocalOnly ?? onSelectFolder}
                            className="group flex items-center justify-between px-6 py-4 bg-transparent border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 rounded-2xl transition-all active:scale-[0.98]"
                        >
                            <div className="flex items-center gap-4 text-left">
                                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center text-gray-500">
                                    <FolderOpen className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="font-semibold">Nur lokal nutzen</div>
                                    <div className="text-xs text-gray-400">Kein Account erforderlich</div>
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
            )}

            {screen === 'email' && (
                <div className="max-w-sm w-full animate-in slide-in-from-right-4 duration-300">
                    <button
                        onClick={() => { setScreen('choice'); setError(null); }}
                        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-white mb-6 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Zurück
                    </button>

                    <h2 className="text-2xl font-bold mb-1 text-left">
                        {authMode === 'signin' ? 'Anmelden' : 'Registrieren'}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-left">
                        {authMode === 'signin'
                            ? 'Melde dich mit deinem Lama Notes-Konto an.'
                            : 'Erstelle ein kostenloses Konto für Cloud-Sync.'}
                    </p>

                    <form onSubmit={handleEmailAuth} className="flex flex-col gap-3">
                        <input
                            type="email"
                            placeholder="E-Mail"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                            className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                        />
                        <input
                            type="password"
                            placeholder="Passwort"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                            minLength={6}
                            className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                        />

                        {error && (
                            <p className="text-red-500 text-sm text-left">{error}</p>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading || success}
                            className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-1"
                        >
                            {success ? (
                                <>
                                    <Check className="w-4 h-4" />
                                    Erfolgreich!
                                </>
                            ) : isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Bitte warten...
                                </>
                            ) : authMode === 'signin' ? 'Anmelden' : 'Konto erstellen'}
                        </button>
                    </form>

                    <div className="mt-5 text-sm text-gray-500">
                        {authMode === 'signin' ? (
                            <>
                                Noch kein Konto?{' '}
                                <button
                                    onClick={() => { setAuthMode('signup'); setError(null); }}
                                    className="text-primary-600 hover:underline font-medium"
                                >
                                    Registrieren
                                </button>
                            </>
                        ) : (
                            <>
                                Bereits registriert?{' '}
                                <button
                                    onClick={() => { setAuthMode('signin'); setError(null); }}
                                    className="text-primary-600 hover:underline font-medium"
                                >
                                    Anmelden
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

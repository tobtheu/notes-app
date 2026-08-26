import { useState } from 'react';
import logo from '../assets/logo.png';
import { OnboardingAuthCard } from './OnboardingAuthCard';
import { OnboardingStorageCard } from './OnboardingStorageCard';
import { useTranslation } from '../i18n';

interface Props {
    onSelectFolder?: () => void;
    onSetupWorkspace: () => Promise<void>;
    onSignIn?: (email: string, password: string) => Promise<{ userId: string; email: string }>;
    onSignUp?: (email: string, password: string) => Promise<{ userId: string; email: string }>;
    onLocalOnly?: () => Promise<void>;
}

type Screen = 'choice' | 'email';
type AuthMode = 'signin' | 'signup';

export function OnboardingScreen({ onSelectFolder, onSetupWorkspace, onSignIn, onSignUp, onLocalOnly }: Props) {
    const { t } = useTranslation();
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
            } else if (onSelectFolder) {
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
                setError(t('onboarding.errInvalidCredentials'));
            } else if (msg.includes('User already registered')) {
                setError(t('onboarding.errAlreadyRegistered'));
            } else if (msg.includes('Password should be at least')) {
                setError(t('onboarding.errPasswordShort'));
            } else {
                setError(t('onboarding.errConnectionFailed'));
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center absolute inset-0 w-full h-full bg-[var(--shell-bg)] text-[var(--text-main)] p-4 sm:p-6 text-center select-none transition-colors duration-500">
            <div className="w-full max-w-[440px] bg-[var(--canvas-bg)]/95 backdrop-blur-xl border border-[var(--border-subtle)]/70 rounded-[28px] p-6 sm:p-8 shadow-2xl animate-modal-spring flex flex-col items-center">
                {/* App Logo */}
                <img
                    src={logo}
                    alt="Logo"
                    className="w-16 h-16 rounded-2xl shadow-md object-contain select-none pointer-events-none mb-5"
                />

                {screen === 'choice' ? (
                    <OnboardingStorageCard
                        onOpenEmailAuth={(mode) => {
                            setScreen('email');
                            setAuthMode(mode);
                        }}
                        onLocalOnly={handleLocalOnly}
                        isLoading={isLoading}
                    />
                ) : (
                    <OnboardingAuthCard
                        authMode={authMode}
                        setAuthMode={setAuthMode}
                        email={email}
                        setEmail={setEmail}
                        password={password}
                        setPassword={setPassword}
                        isLoading={isLoading}
                        error={error}
                        success={success}
                        onSubmit={handleEmailAuth}
                        onBack={() => {
                            setScreen('choice');
                            setError(null);
                        }}
                    />
                )}

                {/* Footer Credits */}
                <div className="w-full flex items-center justify-between mt-6 pt-3.5 border-t border-[var(--border-subtle)]/40 text-[10px] text-[var(--text-muted)] select-none">
                    <span>Copyright Tobias Theunissen</span>
                    <span>Made in Germany</span>
                </div>
            </div>
        </div>
    );
}

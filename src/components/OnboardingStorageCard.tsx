import { Cloud, FolderOpen, ChevronRight } from 'lucide-react';
import { FEATURES } from '../config/features';
import clsx from 'clsx';

interface OnboardingStorageCardProps {
    onOpenEmailAuth: (mode: 'signin' | 'signup') => void;
    onLocalOnly: () => Promise<void>;
    isLoading?: boolean;
}

export function OnboardingStorageCard({
    onOpenEmailAuth,
    onLocalOnly,
    isLoading = false,
}: OnboardingStorageCardProps) {
    const isSyncEnabled = FEATURES.SYNC;

    return (
        <div className="w-full animate-note-fade">
            <h1 className="text-2xl sm:text-3xl font-extrabold mb-1.5 tracking-tight text-[var(--text-main)]">
                Welcome to Lama
            </h1>
            <p className="mb-6 text-[var(--text-muted)] text-sm leading-relaxed">
                Your thoughts, beautifully formatted and stored securely.
            </p>

            <div className="grid gap-3 w-full">
                {/* Supabase email auth (Enabled if FEATURES.SYNC, otherwise Disabled "Coming Soon") */}
                <button
                    type="button"
                    data-testid="onboarding-cloud-auth-btn"
                    onClick={() => {
                        if (isSyncEnabled) onOpenEmailAuth('signin');
                    }}
                    disabled={!isSyncEnabled || isLoading}
                    className={clsx(
                        "smooth-transition group w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border text-left shadow-sm",
                        isSyncEnabled
                            ? "bg-[var(--card-hover)]/70 hover:bg-[var(--card-hover)] border-[var(--border-subtle)]/60 hover:border-[var(--accent-color)]/60 active:scale-[0.98] cursor-pointer"
                            : "bg-[var(--card-hover)]/40 border-[var(--border-subtle)]/40 opacity-60 cursor-not-allowed select-none"
                    )}
                >
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-[var(--canvas-bg)] flex items-center justify-center text-[var(--accent-color)] border border-[var(--border-subtle)]/60 shadow-sm shrink-0">
                            <Cloud size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs sm:text-sm text-[var(--text-main)]">Sign In / Register</span>
                                {!isSyncEnabled && (
                                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-[var(--accent-color)]/15 text-[var(--accent-color)] border border-[var(--accent-color)]/30">
                                        Coming Soon
                                    </span>
                                )}
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                                {isSyncEnabled ? 'Sync across all your devices' : 'Cloud synchronization in development'}
                            </div>
                        </div>
                    </div>
                    {isSyncEnabled ? (
                        <ChevronRight size={16} className="text-[var(--text-muted)] group-hover:text-[var(--text-main)] group-hover:translate-x-0.5 transition-all shrink-0" />
                    ) : null}
                </button>

                {/* Offline / Local-only Option */}
                <button
                    type="button"
                    data-testid="onboarding-local-btn"
                    onClick={onLocalOnly}
                    disabled={isLoading}
                    className={clsx(
                        "smooth-transition group w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border text-left shadow-sm active:scale-[0.98] disabled:opacity-50",
                        !isSyncEnabled
                            ? "bg-[var(--card-hover)] border-[var(--accent-color)]/50 ring-1 ring-[var(--accent-color)]/30 hover:border-[var(--accent-color)]"
                            : "bg-[var(--card-hover)]/70 hover:bg-[var(--card-hover)] border-[var(--border-subtle)]/60 hover:border-[var(--accent-color)]/60"
                    )}
                >
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-[var(--canvas-bg)] flex items-center justify-center text-[var(--text-muted)] border border-[var(--border-subtle)]/60 shadow-sm shrink-0">
                            <FolderOpen size={18} />
                        </div>
                        <div>
                            <div className="font-semibold text-xs sm:text-sm text-[var(--text-main)]">Use locally only</div>
                            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">Save notes offline on this device</div>
                        </div>
                    </div>
                    <ChevronRight size={16} className="text-[var(--text-muted)] group-hover:text-[var(--text-main)] group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
            </div>
        </div>
    );
}

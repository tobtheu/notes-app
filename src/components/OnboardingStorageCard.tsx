import { Cloud, FolderOpen, ChevronRight } from 'lucide-react';

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
    return (
        <div className="w-full animate-note-fade">
            <h1 className="text-2xl sm:text-3xl font-extrabold mb-1.5 tracking-tight text-[var(--text-main)]">
                Welcome to Lama
            </h1>
            <p className="mb-6 text-[var(--text-muted)] text-sm leading-relaxed">
                Your thoughts, beautifully formatted and synced everywhere.
            </p>

            <div className="grid gap-3 w-full">
                {/* Supabase email auth */}
                <button
                    type="button"
                    onClick={() => onOpenEmailAuth('signin')}
                    className="smooth-transition group w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-[var(--card-hover)]/70 hover:bg-[var(--card-hover)] border border-[var(--border-subtle)]/60 hover:border-[var(--accent-color)]/60 text-left shadow-sm active:scale-[0.98]"
                >
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-[var(--canvas-bg)] flex items-center justify-center text-[var(--accent-color)] border border-[var(--border-subtle)]/60 shadow-sm shrink-0">
                            <Cloud size={18} />
                        </div>
                        <div>
                            <div className="font-semibold text-xs sm:text-sm text-[var(--text-main)]">Sign In / Register</div>
                            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">Sync across all your devices</div>
                        </div>
                    </div>
                    <ChevronRight size={16} className="text-[var(--text-muted)] group-hover:text-[var(--text-main)] group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>

                {/* Offline / Local-only Option */}
                <button
                    type="button"
                    onClick={onLocalOnly}
                    disabled={isLoading}
                    className="smooth-transition group w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-[var(--card-hover)]/70 hover:bg-[var(--card-hover)] border border-[var(--border-subtle)]/60 hover:border-[var(--accent-color)]/60 text-left shadow-sm active:scale-[0.98] disabled:opacity-50"
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

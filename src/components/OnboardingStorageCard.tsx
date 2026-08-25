import { Mail, FolderOpen, ChevronRight, Loader2 } from 'lucide-react';

interface OnboardingStorageCardProps {
    onOpenEmailAuth: (mode: 'signin' | 'signup') => void;
    onSelectFolder: () => void;
    onLocalOnly: () => Promise<void>;
    isLoading: boolean;
}

export function OnboardingStorageCard({
    onOpenEmailAuth,
    onSelectFolder,
    onLocalOnly,
    isLoading,
}: OnboardingStorageCardProps) {
    return (
        <div className="w-full animate-note-fade">
            <h1 className="text-2xl sm:text-3xl font-extrabold mb-1.5 tracking-tight text-[var(--text-main)]">Welcome to Lama</h1>
            <p className="mb-6 text-[var(--text-muted)] text-sm leading-relaxed">
                Your thoughts, beautifully formatted and synced everywhere.
            </p>

            <div className="grid gap-2.5 w-full">
                {/* Supabase email auth */}
                <button
                    type="button"
                    onClick={() => onOpenEmailAuth('signin')}
                    className="smooth-transition group w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-[var(--card-hover)] border border-[var(--border-subtle)] hover:border-[var(--accent-color)] text-left shadow-sm active:scale-95"
                >
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-[var(--canvas-bg)] flex items-center justify-center text-[var(--accent-color)] border border-[var(--border-subtle)] shadow-sm shrink-0">
                            <Mail size={18} />
                        </div>
                        <div>
                            <div className="font-semibold text-xs sm:text-sm text-[var(--text-main)]">Sign In / Register</div>
                            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">Sync across all your devices</div>
                        </div>
                    </div>
                    <ChevronRight size={16} className="text-[var(--text-muted)] group-hover:text-[var(--text-main)] group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>

                {/* Local Folder Mode (Tauri) */}
                {(window as any).__TAURI_INTERNALS__ && (
                    <button
                        type="button"
                        onClick={onSelectFolder}
                        className="smooth-transition group w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-[var(--card-hover)] border border-[var(--border-subtle)] hover:border-[var(--accent-color)] text-left shadow-sm active:scale-95"
                    >
                        <div className="flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-[var(--canvas-bg)] flex items-center justify-center text-[var(--text-muted)] border border-[var(--border-subtle)] shadow-sm shrink-0">
                                <FolderOpen size={18} />
                            </div>
                            <div>
                                <div className="font-semibold text-xs sm:text-sm text-[var(--text-main)]">Choose Local Folder</div>
                                <div className="text-[11px] text-[var(--text-muted)] mt-0.5">Use existing Markdown files</div>
                            </div>
                        </div>
                        <ChevronRight size={16} className="text-[var(--text-muted)] group-hover:text-[var(--text-main)] group-hover:translate-x-0.5 transition-all shrink-0" />
                    </button>
                )}
            </div>

            {/* Offline / Local-only Option */}
            <div className="mt-5 pt-4 border-t border-[var(--border-subtle)]/60 w-full flex flex-col items-center">
                <button
                    type="button"
                    onClick={onLocalOnly}
                    disabled={isLoading}
                    className="smooth-transition text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] py-1.5 px-3 rounded-xl hover:bg-[var(--card-hover)] active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                >
                    {isLoading && <Loader2 size={13} className="animate-spin text-[var(--accent-color)]" />}
                    <span>Use locally only</span>
                </button>
            </div>
        </div>
    );
}

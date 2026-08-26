import { Trash2, X, MoveUp } from 'lucide-react';
import { useTranslation } from '../i18n';

interface DeleteFolderModalProps {
    folderName: string;
    onClose: () => void;
    onConfirm: (mode: 'recursive' | 'move') => void;
}

/**
 * DeleteFolderModal Component
 * Confirms category deletion with two modes:
 * 1. Move items to "All Notes" (Keep notes, delete category)
 * 2. Delete everything (Recursive deletion of category and its notes)
 */
export function DeleteFolderModal({ folderName, onClose, onConfirm }: DeleteFolderModalProps) {
    const { t } = useTranslation();

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-modal-spring border border-[var(--border-subtle)] select-none text-xs"
                onClick={e => e.stopPropagation()}
                style={{ backgroundColor: 'var(--canvas-bg)' }}
            >
                {/* --- HEADER --- */}
                <div className="px-4 py-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[var(--text-main)]">{t('modals.deleteFolderTitle')}</h3>
                    <button onClick={onClose} className="smooth-transition p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] active:scale-95">
                        <X size={16} />
                    </button>
                </div>

                {/* --- BODY --- */}
                <div className="p-4 space-y-3">
                    <p className="text-xs text-[var(--text-muted)] text-center mb-3">
                        {t('modals.deleteFolderMessage', { name: folderName })}
                    </p>

                    <div className="space-y-2">
                        {/* MODE: KEEP NOTES (Move to root/Inbox) */}
                        <button
                            type="button"
                            onClick={() => onConfirm('move')}
                            className="smooth-transition w-full flex items-center gap-3 p-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--card-hover)] hover:border-[var(--accent-color)] active:scale-98 text-left"
                        >
                            <div className="w-8 h-8 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-[var(--accent-color)] shrink-0">
                                <MoveUp size={16} />
                            </div>
                            <div>
                                <div className="font-semibold text-xs text-[var(--text-main)]">{t('modals.deleteFolderKeepNotes')}</div>
                                <div className="text-[10px] text-[var(--text-muted)] leading-tight">{t('modals.deleteFolderKeepNotesDesc')}</div>
                            </div>
                        </button>

                        {/* MODE: DELETE ALL (Recursive) */}
                        <button
                            type="button"
                            onClick={() => onConfirm('recursive')}
                            className="smooth-transition w-full flex items-center gap-3 p-3 rounded-2xl border border-red-500/20 bg-red-50/50 dark:bg-red-950/20 hover:border-red-500 active:scale-98 text-left"
                        >
                            <div className="w-8 h-8 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                                <Trash2 size={16} />
                            </div>
                            <div>
                                <div className="font-semibold text-xs text-red-600 dark:text-red-400">{t('modals.deleteFolderAndNotes')}</div>
                                <div className="text-[10px] text-red-500/70 dark:text-red-400/60 leading-tight">{t('modals.deleteFolderAndNotesDesc')}</div>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}


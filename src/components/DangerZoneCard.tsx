import { Trash2 } from 'lucide-react';

interface DangerZoneCardProps {
    resetDbState?: 'idle' | 'loading' | 'done';
    resetDbStep?: 'idle' | 'confirm';
    setResetDbStep?: (step: 'idle' | 'confirm') => void;
    onResetDatabaseClick?: () => void;
}

export function DangerZoneCard({
    resetDbState = 'idle',
    resetDbStep = 'idle',
    setResetDbStep,
    onResetDatabaseClick,
}: DangerZoneCardProps) {
    if (!Boolean(import.meta.env.DEV) || !onResetDatabaseClick) return null;

    return (
        <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2.5">
            <label className="block font-semibold text-red-500 mb-1">Entwickler & Test-Optionen</label>
            <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20 space-y-2">
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="font-semibold text-[var(--text-main)] truncate">Lokale Datenbank leeren</div>
                        <div className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                            Löscht alle lokalen Notizen und Konfigurationen aus der Datenbank (nur für Testzwecke)
                        </div>
                    </div>
                    {resetDbStep === 'idle' && (
                        <button
                            type="button"
                            onClick={() => setResetDbStep?.('confirm')}
                            disabled={resetDbState === 'loading'}
                            className="smooth-transition flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 font-semibold text-xs active:scale-95 disabled:opacity-50 shrink-0"
                        >
                            <Trash2 size={13} />
                            <span>{resetDbState === 'done' ? 'Gelöscht!' : 'Datenbank zurücksetzen'}</span>
                        </button>
                    )}
                </div>
                {resetDbStep === 'confirm' && (
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-red-500/20">
                        <span className="text-[11px] text-red-600 dark:text-red-400 font-medium">Bist du sicher? Alle lokalen Notizen werden gelöscht.</span>
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => setResetDbStep?.('idle')}
                                className="smooth-transition px-2.5 py-1 text-xs rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
                            >
                                Abbrechen
                            </button>
                            <button
                                type="button"
                                onClick={onResetDatabaseClick}
                                disabled={resetDbState === 'loading'}
                                className="smooth-transition px-3 py-1 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-sm disabled:opacity-50"
                            >
                                {resetDbState === 'loading' ? 'Lösche...' : 'Jetzt leeren'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

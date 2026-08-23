import { RefreshCw, CheckCircle2, Download, FileText, FolderInput, Trash2 } from 'lucide-react';
import type { ImportProgress } from '../hooks/useNotesWorkspace';

interface StorageSectionProps {
    hasImportFolderOption?: boolean;
    importState?: 'idle' | 'loading' | 'done';
    importCount?: number;
    importFolderProgress?: ImportProgress | null;
    onImportFolderClick?: () => void;
    importFilesState?: 'idle' | 'loading' | 'done';
    importFilesCount?: number;
    importFilesProgress?: ImportProgress | null;
    onImportFilesClick?: () => void;
    exportState?: 'idle' | 'loading' | 'done';
    exportCount?: number;
    onExportBackup?: () => void;
    resetDbState?: 'idle' | 'loading' | 'done';
    resetDbStep?: 'idle' | 'confirm';
    setResetDbStep?: (step: 'idle' | 'confirm') => void;
    onResetDatabaseClick?: () => void;
}

export function StorageSection({
    hasImportFolderOption = true,
    importState = 'idle',
    importCount = 0,
    importFolderProgress,
    onImportFolderClick,
    importFilesState = 'idle',
    importFilesCount = 0,
    importFilesProgress,
    onImportFilesClick,
    exportState = 'idle',
    exportCount = 0,
    onExportBackup,
    resetDbState = 'idle',
    resetDbStep = 'idle',
    setResetDbStep,
    onResetDatabaseClick
}: StorageSectionProps) {
    return (
        <div className="space-y-6 text-xs select-none pb-6">
            {/* Export Section */}
            <div>
                <label className="block font-semibold text-[var(--text-main)] mb-2.5">Backup & Export</label>
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="font-semibold text-[var(--text-main)] truncate">Notizen exportieren</div>
                        <div className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                            Alle Notizen als echte Ordner und Markdown-Dateien (.md) sichern
                        </div>
                    </div>
                    {onExportBackup && (
                        <button
                            type="button"
                            onClick={onExportBackup}
                            disabled={exportState === 'loading'}
                            className="smooth-transition flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[var(--card-hover)] border border-[var(--border-subtle)] text-[var(--text-main)] hover:border-[var(--accent-color)] font-medium text-xs shadow-sm active:scale-95 disabled:opacity-50 shrink-0"
                        >
                            {exportState === 'loading' ? (
                                <RefreshCw size={13} className="animate-spin text-[var(--accent-color)]" />
                            ) : exportState === 'done' ? (
                                <CheckCircle2 size={13} className="text-emerald-500" />
                            ) : (
                                <Download size={13} className="text-[var(--accent-color)]" />
                            )}
                            <span>
                                {exportState === 'done'
                                    ? `${exportCount} Notizen exportiert`
                                    : exportState === 'loading'
                                    ? 'Exportiert...'
                                    : 'Exportieren'}
                            </span>
                        </button>
                    )}
                </div>
            </div>

            {/* Import Section */}
            <div className="pt-3 border-t border-[var(--border-subtle)] space-y-3">
                <label className="block font-semibold text-[var(--text-main)] mb-1">Import</label>
                
                {/* Folder Import */}
                {hasImportFolderOption && onImportFolderClick && (
                    <div>
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="font-semibold text-[var(--text-main)] truncate">Ordner importieren</div>
                                <div className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                                    Einen kompletten Ordner mit Markdown-Dateien samt Unterordnern importieren
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onImportFolderClick}
                                disabled={importState === 'loading'}
                                className="smooth-transition flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[var(--card-hover)] border border-[var(--border-subtle)] text-[var(--text-main)] hover:border-[var(--accent-color)] font-medium text-xs shadow-sm active:scale-95 disabled:opacity-50 shrink-0"
                            >
                                {importState === 'loading' ? (
                                    <RefreshCw size={13} className="animate-spin text-[var(--accent-color)]" />
                                ) : importState === 'done' ? (
                                    <CheckCircle2 size={13} className="text-emerald-500" />
                                ) : (
                                    <FolderInput size={13} className="text-[var(--accent-color)]" />
                                )}
                                <span>
                                    {importState === 'done'
                                        ? `${importCount} Notizen importiert`
                                        : importState === 'loading'
                                        ? 'Importiert...'
                                        : 'Ordner wählen'}
                                </span>
                            </button>
                        </div>

                        {/* Folder Import Progress Bar */}
                        {importFolderProgress && (importFolderProgress.stage === 'scanning' || importFolderProgress.stage === 'importing') && (
                            <div className="mt-2.5 p-3 rounded-xl bg-[var(--canvas-bg)] border border-[var(--border-subtle)] space-y-2 animate-note-fade">
                                <div className="flex justify-between items-center text-[11px] font-medium">
                                    <span className="text-[var(--text-main)] flex items-center gap-1.5">
                                        <RefreshCw size={11} className="animate-spin text-[var(--accent-color)]" />
                                        {importFolderProgress.stage === 'scanning'
                                            ? 'Ordner wird durchsucht...'
                                            : `${importFolderProgress.current} von ${importFolderProgress.total} Notizen importiert`}
                                    </span>
                                    <span className="text-[var(--accent-color)] font-mono font-semibold">
                                        {importFolderProgress.total > 0
                                            ? `${Math.round((importFolderProgress.current / importFolderProgress.total) * 100)}%`
                                            : '...'}
                                    </span>
                                </div>
                                <div className="w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-[var(--accent-color)] transition-all duration-200 rounded-full"
                                        style={{
                                            width: importFolderProgress.total > 0
                                                ? `${Math.min(100, Math.round((importFolderProgress.current / importFolderProgress.total) * 100))}%`
                                                : '10%'
                                        }}
                                    />
                                </div>
                                {importFolderProgress.currentFile && (
                                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] font-mono truncate pt-0.5">
                                        <FileText size={11} className="shrink-0 text-[var(--accent-color)]" />
                                        <span className="truncate">{importFolderProgress.currentFile}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* File Import */}
                {onImportFilesClick && (
                    <div className="pt-2 border-t border-[var(--border-subtle)]">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="font-semibold text-[var(--text-main)] truncate">Dateien importieren</div>
                                <div className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                                    Einzelne .md- oder .txt-Dateien zur Notizensammlung hinzufügen
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onImportFilesClick}
                                disabled={importFilesState === 'loading'}
                                className="smooth-transition flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[var(--card-hover)] border border-[var(--border-subtle)] text-[var(--text-main)] hover:border-[var(--accent-color)] font-medium text-xs shadow-sm active:scale-95 disabled:opacity-50 shrink-0"
                            >
                                {importFilesState === 'loading' ? (
                                    <RefreshCw size={13} className="animate-spin text-[var(--accent-color)]" />
                                ) : importFilesState === 'done' ? (
                                    <CheckCircle2 size={13} className="text-emerald-500" />
                                ) : (
                                    <FileText size={13} className="text-[var(--accent-color)]" />
                                )}
                                <span>
                                    {importFilesState === 'done'
                                        ? `${importFilesCount} Dateien importiert`
                                        : importFilesState === 'loading'
                                        ? 'Importiert...'
                                        : 'Dateien wählen'}
                                </span>
                            </button>
                        </div>

                        {/* File Import Progress Bar */}
                        {importFilesProgress && (importFilesProgress.stage === 'scanning' || importFilesProgress.stage === 'importing') && (
                            <div className="mt-2.5 p-3 rounded-xl bg-[var(--canvas-bg)] border border-[var(--border-subtle)] space-y-2 animate-note-fade">
                                <div className="flex justify-between items-center text-[11px] font-medium">
                                    <span className="text-[var(--text-main)] flex items-center gap-1.5">
                                        <RefreshCw size={11} className="animate-spin text-[var(--accent-color)]" />
                                        {importFilesProgress.stage === 'scanning'
                                            ? 'Dateien werden geladen...'
                                            : `${importFilesProgress.current} von ${importFilesProgress.total} Dateien importiert`}
                                    </span>
                                    <span className="text-[var(--accent-color)] font-mono font-semibold">
                                        {importFilesProgress.total > 0
                                            ? `${Math.round((importFilesProgress.current / importFilesProgress.total) * 100)}%`
                                            : '...'}
                                    </span>
                                </div>
                                <div className="w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-[var(--accent-color)] transition-all duration-200 rounded-full"
                                        style={{
                                            width: importFilesProgress.total > 0
                                                ? `${Math.min(100, Math.round((importFilesProgress.current / importFilesProgress.total) * 100))}%`
                                                : '10%'
                                        }}
                                    />
                                </div>
                                {importFilesProgress.currentFile && (
                                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] font-mono truncate pt-0.5">
                                        <FileText size={11} className="shrink-0 text-[var(--accent-color)]" />
                                        <span className="truncate">{importFilesProgress.currentFile}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Database Reset Section (Testing) */}
            {onResetDatabaseClick && (
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
            )}
        </div>
    );
}

import { RefreshCw, CheckCircle2, Download, FileText, FolderInput } from 'lucide-react';

interface StorageSectionProps {
    hasImportFolderOption?: boolean;
    importState?: 'idle' | 'loading' | 'done';
    importCount?: number;
    onImportFolderClick?: () => void;
    importFilesState?: 'idle' | 'loading' | 'done';
    importFilesCount?: number;
    onImportFilesClick?: () => void;
    exportState?: 'idle' | 'loading' | 'done';
    exportCount?: number;
    onExportBackup?: () => void;
}

export function StorageSection({
    hasImportFolderOption = true,
    importState = 'idle',
    importCount = 0,
    onImportFolderClick,
    importFilesState = 'idle',
    importFilesCount = 0,
    onImportFilesClick,
    exportState = 'idle',
    exportCount = 0,
    onExportBackup
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
                )}

                {/* File Import */}
                {onImportFilesClick && (
                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--border-subtle)]">
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
                )}
            </div>
        </div>
    );
}

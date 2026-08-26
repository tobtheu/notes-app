import { RefreshCw, CheckCircle2, Download, FileText, FolderInput } from 'lucide-react';
import type { ImportProgress } from '../hooks/useNotesWorkspace';
import { DangerZoneCard } from './DangerZoneCard';
import { useTranslation } from '../i18n';

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
    const { t } = useTranslation();

    return (
        <div className="space-y-6 text-xs select-none pb-6">
            {/* Export Section */}
            <div>
                <label className="block font-semibold text-[var(--text-main)] mb-2.5">{t('settings.storageSection.title')}</label>
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="font-semibold text-[var(--text-main)] truncate">{t('settings.storageSection.exportBackup')}</div>
                        <div className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                            {t('settings.storageSection.exportBackupDesc')}
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
                                    ? t('settings.storageSection.exportSuccess')
                                    : exportState === 'loading'
                                    ? t('common.loading')
                                    : t('common.save')}
                            </span>
                        </button>
                    )}
                </div>
            </div>

            {/* Import Section */}
            <div className="pt-3 border-t border-[var(--border-subtle)] space-y-3">
                <label className="block font-semibold text-[var(--text-main)] mb-1">{t('settings.storageSection.importFiles')}</label>
                
                {/* Folder Import */}
                {hasImportFolderOption && onImportFolderClick && (
                    <div>
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="font-semibold text-[var(--text-main)] truncate">{t('settings.storageSection.importFolder')}</div>
                                <div className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                                    {t('settings.storageSection.importFolderDesc')}
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
                                        ? t('settings.storageSection.importSuccess', { count: importCount })
                                        : importState === 'loading'
                                        ? t('common.loading')
                                        : t('settings.storageSection.importFolder')}
                                </span>
                            </button>
                        </div>
                        {importState === 'loading' && importFolderProgress && (
                            <div className="mt-2 space-y-1">
                                <div className="flex justify-between text-[11px] text-[var(--text-muted)]">
                                    <span className="truncate">{importFolderProgress.currentFile}</span>
                                    <span className="font-mono ml-2 shrink-0">{importFolderProgress.current} / {importFolderProgress.total}</span>
                                </div>
                                <div className="w-full h-1 bg-[var(--card-hover)] rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-[var(--accent-color)] transition-all duration-150 rounded-full"
                                        style={{ width: `${importFolderProgress.total > 0 ? (importFolderProgress.current / importFolderProgress.total) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Single / Multiple Files Import */}
                {onImportFilesClick && (
                    <div>
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="font-semibold text-[var(--text-main)] truncate">{t('settings.storageSection.importFiles')}</div>
                                <div className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                                    {t('settings.storageSection.importFilesDesc')}
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
                                        ? t('settings.storageSection.importSuccess', { count: importFilesCount })
                                        : importFilesState === 'loading'
                                        ? t('common.loading')
                                        : t('settings.storageSection.importFiles')}
                                </span>
                            </button>
                        </div>
                        {importFilesState === 'loading' && importFilesProgress && (
                            <div className="mt-2 space-y-1">
                                <div className="flex justify-between text-[11px] text-[var(--text-muted)]">
                                    <span className="truncate">{importFilesProgress.currentFile}</span>
                                    <span className="font-mono ml-2 shrink-0">{importFilesProgress.current} / {importFilesProgress.total}</span>
                                </div>
                                <div className="w-full h-1 bg-[var(--card-hover)] rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-[var(--accent-color)] transition-all duration-150 rounded-full"
                                        style={{ width: `${importFilesProgress.total > 0 ? (importFilesProgress.current / importFilesProgress.total) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Factory Reset Database Danger Zone */}
            <DangerZoneCard
                resetDbState={resetDbState}
                resetDbStep={resetDbStep}
                setResetDbStep={setResetDbStep}
                onResetDatabaseClick={onResetDatabaseClick}
            />
        </div>
    );
}


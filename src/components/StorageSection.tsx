import { FolderOpen, RefreshCw, CheckCircle2, Upload, Download } from 'lucide-react';

interface StorageSectionProps {
    currentPath: string | null;
    onChangePath: () => void;
    hasImportFolderOption: boolean;
    importState: 'idle' | 'loading' | 'done';
    importCount: number;
    onImportFolderClick: () => void;
    onExportBackup?: () => void;
}

export function StorageSection({
    currentPath,
    onChangePath,
    hasImportFolderOption,
    importState,
    importCount,
    onImportFolderClick,
    onExportBackup
}: StorageSectionProps) {
    return (
        <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Storage</h3>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 mb-1">Current Folder</p>
                <p className="font-mono text-sm text-gray-700 dark:text-gray-300 break-all mb-3">
                    {currentPath || 'Not selected'}
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        type="button"
                        onClick={onChangePath}
                        className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
                    >
                        <FolderOpen size={16} />
                        Change Location
                    </button>
                    {hasImportFolderOption && (
                        <button
                            type="button"
                            onClick={onImportFolderClick}
                            disabled={importState === 'loading'}
                            className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors disabled:opacity-50"
                        >
                            {importState === 'loading' ? (
                                <RefreshCw size={16} className="animate-spin" />
                            ) : importState === 'done' ? (
                                <CheckCircle2 size={16} className="text-emerald-500" />
                            ) : (
                                <Upload size={16} />
                            )}
                            {importState === 'done'
                                ? `${importCount} notes imported`
                                : 'Import Folder'}
                        </button>
                    )}
                    {onExportBackup && (
                        <button
                            type="button"
                            onClick={onExportBackup}
                            className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
                        >
                            <Download size={16} />
                            Backup / Export (.md)
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

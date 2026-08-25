import { useState } from 'react';
import type { ImportProgress } from './useNotesWorkspace';

interface UseSettingsImportExportProps {
    onImportFolder?: (onProgress?: (prog: ImportProgress) => void) => Promise<number>;
    onImportFiles?: (onProgress?: (prog: ImportProgress) => void) => Promise<number>;
    onExportBackup?: () => Promise<number>;
    onResetDatabase?: () => Promise<void>;
}

export function useSettingsImportExport({
    onImportFolder,
    onImportFiles,
    onExportBackup,
    onResetDatabase,
}: UseSettingsImportExportProps) {
    const [importState, setImportState] = useState<'idle' | 'loading' | 'done'>('idle');
    const [importCount, setImportCount] = useState(0);
    const [importFolderProgress, setImportFolderProgress] = useState<ImportProgress | null>(null);

    const [importFilesState, setImportFilesState] = useState<'idle' | 'loading' | 'done'>('idle');
    const [importFilesCount, setImportFilesCount] = useState(0);
    const [importFilesProgress, setImportFilesProgress] = useState<ImportProgress | null>(null);

    const [exportState, setExportState] = useState<'idle' | 'loading' | 'done'>('idle');
    const [exportCount, setExportCount] = useState(0);

    const [resetDbState, setResetDbState] = useState<'idle' | 'loading' | 'done'>('idle');
    const [resetDbStep, setResetDbStep] = useState<'idle' | 'confirm'>('idle');

    const handleImportFolder = async () => {
        if (!onImportFolder) return;
        setImportState('loading');
        setImportFolderProgress({ stage: 'selecting', current: 0, total: 0 });
        try {
            const count = await onImportFolder((prog) => {
                setImportFolderProgress(prog);
            });
            setImportCount(count);
            setImportState('done');
            setTimeout(() => {
                setImportState('idle');
                setImportFolderProgress(null);
            }, 3500);
        } catch {
            setImportState('idle');
            setImportFolderProgress(null);
        }
    };

    const handleImportFiles = async () => {
        if (!onImportFiles) return;
        setImportFilesState('loading');
        setImportFilesProgress({ stage: 'selecting', current: 0, total: 0 });
        try {
            const count = await onImportFiles((prog) => {
                setImportFilesProgress(prog);
            });
            setImportFilesCount(count);
            setImportFilesState('done');
            setTimeout(() => {
                setImportFilesState('idle');
                setImportFilesProgress(null);
            }, 3500);
        } catch {
            setImportFilesState('idle');
            setImportFilesProgress(null);
        }
    };

    const handleExportBackup = async () => {
        if (!onExportBackup) return;
        setExportState('loading');
        try {
            const count = await onExportBackup();
            setExportCount(count);
            setExportState('done');
            setTimeout(() => setExportState('idle'), 3500);
        } catch {
            setExportState('idle');
        }
    };

    const handleResetDatabase = async () => {
        if (!onResetDatabase) return;
        setResetDbState('loading');
        try {
            await onResetDatabase();
            setResetDbState('done');
            setResetDbStep('idle');
            setTimeout(() => setResetDbState('idle'), 3500);
        } catch {
            setResetDbState('idle');
            setResetDbStep('idle');
        }
    };

    return {
        importState,
        importCount,
        importFolderProgress,
        handleImportFolder,
        importFilesState,
        importFilesCount,
        importFilesProgress,
        handleImportFiles,
        exportState,
        exportCount,
        handleExportBackup,
        resetDbState,
        resetDbStep,
        setResetDbStep,
        handleResetDatabase,
    };
}

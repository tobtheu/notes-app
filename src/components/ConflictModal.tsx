import { useState } from 'react';
import { AlertTriangle, Trash2, FileCheck, Files, X } from 'lucide-react';
import type { ConflictPair } from '../types';

interface ConflictModalProps {
    conflictPairs: ConflictPair[];
    baseFolder: string;
    onClose: () => void;
    onReload: () => void;
}

type Action = 'keep-both' | 'discard-conflict' | 'use-remote';

export function ConflictModal({
    conflictPairs,
    baseFolder,
    onClose,
    onReload,
}: ConflictModalProps) {
    const [resolving, setResolving] = useState<Set<string>>(new Set());
    const [resolved, setResolved] = useState<Set<string>>(new Set());

    const resolveConflict = async (pair: ConflictPair, action: Action) => {
        const key = pair.original;
        setResolving(prev => new Set(prev).add(key));

        try {
            if (action === 'discard-conflict') {
                // Delete the conflict copy file using raw tauriAPI
                const conflictFolder = pair.conflictCopy.includes('/')
                    ? baseFolder + '/' + pair.conflictCopy.substring(0, pair.conflictCopy.lastIndexOf('/'))
                    : baseFolder;
                const conflictFilename = pair.conflictCopy.split('/').pop() || pair.conflictCopy;
                await window.tauriAPI.deleteNote({
                    rootPath: baseFolder,
                    folderPath: conflictFolder,
                    filename: conflictFilename,
                });
            } else if (action === 'use-remote') {
                // Find the conflict copy content in the note list
                const conflictName = pair.conflictCopy.split('/').pop() || '';
                const notes = await window.tauriAPI.listNotes(baseFolder);
                const conflictContent = notes.find(n => n.filename === conflictName)?.content || '';

                const originalFolder = pair.original.includes('/')
                    ? baseFolder + '/' + pair.original.substring(0, pair.original.lastIndexOf('/'))
                    : baseFolder;
                const originalFilename = pair.original.split('/').pop() || pair.original;

                // Overwrite the original with the remote content
                await window.tauriAPI.saveNote({
                    rootPath: baseFolder,
                    folderPath: originalFolder,
                    filename: originalFilename,
                    content: conflictContent,
                });

                // Delete the conflict copy
                const conflictFolder = pair.conflictCopy.includes('/')
                    ? baseFolder + '/' + pair.conflictCopy.substring(0, pair.conflictCopy.lastIndexOf('/'))
                    : baseFolder;
                const conflictFilename = pair.conflictCopy.split('/').pop() || pair.conflictCopy;
                await window.tauriAPI.deleteNote({
                    rootPath: baseFolder,
                    folderPath: conflictFolder,
                    filename: conflictFilename,
                });
            }
            // 'keep-both': no action needed, both files already exist

            setResolved(prev => new Set(prev).add(key));
        } catch (e) {
            console.error('Failed to resolve conflict:', e);
        } finally {
            setResolving(prev => {
                const next = new Set(prev);
                next.delete(key);
                return next;
            });
        }
    };

    const handleClose = () => {
        if (resolved.size > 0) onReload();
        onClose();
    };

    const allResolved = conflictPairs.every(p => resolved.has(p.original));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-start gap-4 p-6 pb-4 bg-orange-50 dark:bg-orange-950/30 border-b border-orange-100 dark:border-orange-900/40">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                            Sync-Konflikt erkannt
                        </h2>
                        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                            {conflictPairs.length === 1
                                ? '1 Notiz wurde auf mehreren Geräten gleichzeitig bearbeitet.'
                                : `${conflictPairs.length} Notizen wurden auf mehreren Geräten gleichzeitig bearbeitet.`}
                            {' '}Die lokale Version wurde beibehalten.
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Conflict list */}
                <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
                    {conflictPairs.map(pair => {
                        const originalName = pair.original.split('/').pop() || pair.original;
                        const conflictName = pair.conflictCopy.split('/').pop() || pair.conflictCopy;
                        const isResolving = resolving.has(pair.original);
                        const isResolved = resolved.has(pair.original);

                        return (
                            <div
                                key={pair.original}
                                className={`rounded-xl border p-4 transition-all ${isResolved
                                    ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 opacity-60'
                                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
                                    }`}
                            >
                                <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-0.5">
                                    📄 {originalName.replace('.md', '')}
                                </div>
                                <div className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                                    Konflikt-Kopie: {conflictName.replace('.md', '')}
                                </div>

                                {isResolved ? (
                                    <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                                        <FileCheck size={12} /> Gelöst
                                    </div>
                                ) : (
                                    <div className="flex gap-2 flex-wrap">
                                        <button
                                            onClick={() => resolveConflict(pair, 'keep-both')}
                                            disabled={isResolving}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                                            title="Beide Versionen als separate Notizen behalten"
                                        >
                                            <Files size={12} />
                                            Beide behalten
                                        </button>
                                        <button
                                            onClick={() => resolveConflict(pair, 'discard-conflict')}
                                            disabled={isResolving}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50"
                                            title="Konflikt-Kopie verwerfen, lokale Version behalten"
                                        >
                                            <Trash2 size={12} />
                                            Konflikt verwerfen
                                        </button>
                                        <button
                                            onClick={() => resolveConflict(pair, 'use-remote')}
                                            disabled={isResolving}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-50"
                                            title="Remote-Version übernehmen (lokale Version wird überschrieben)"
                                        >
                                            <FileCheck size={12} />
                                            Remote übernehmen
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="px-4 pb-4 pt-2 flex justify-end">
                    <button
                        onClick={handleClose}
                        className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${allResolved
                            ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
                            }`}
                    >
                        {allResolved ? 'Fertig' : 'Später entscheiden'}
                    </button>
                </div>
            </div>
        </div>
    );
}

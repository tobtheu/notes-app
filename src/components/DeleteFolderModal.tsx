import { Trash2, X, MoveUp } from 'lucide-react';

interface DeleteFolderModalProps {
    folderName: string;
    onClose: () => void;
    onConfirm: (mode: 'recursive' | 'move') => void;
}

export function DeleteFolderModal({ folderName, onClose, onConfirm }: DeleteFolderModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Delete Category</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
                        How would you like to delete the category <span className="font-semibold text-gray-700 dark:text-gray-100">"{folderName}"</span>?
                    </p>

                    <div className="space-y-3">
                        <button
                            onClick={() => onConfirm('move')}
                            className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-transparent bg-gray-50 dark:bg-gray-700/50 hover:border-primary-500 transition-all text-left"
                        >
                            <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-400 shrink-0">
                                <MoveUp size={20} />
                            </div>
                            <div>
                                <div className="font-bold text-gray-800 dark:text-gray-100">Move items to All Notes</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400 text-pretty">Delete the category but keep all notes by moving them to the main view.</div>
                            </div>
                        </button>

                        <button
                            onClick={() => onConfirm('recursive')}
                            className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-transparent bg-red-50 dark:bg-red-900/10 hover:border-red-500 transition-all text-left"
                        >
                            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                                <Trash2 size={20} />
                            </div>
                            <div>
                                <div className="font-bold text-red-600 dark:text-red-400">Delete everything</div>
                                <div className="text-sm text-red-500/70 dark:text-red-400/60 text-pretty">Permanently delete the category and all notes inside. This cannot be undone.</div>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/20 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-100 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

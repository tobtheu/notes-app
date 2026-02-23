import { X } from 'lucide-react';

interface UpdateModalProps {
    version: string;
    onUpdate: () => void;
    onSkip: () => void;
    onCancel: () => void;
}

export function UpdateModal({ version, onUpdate, onSkip, onCancel }: UpdateModalProps) {
    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div className="bg-primary-100 dark:bg-primary-900/40 p-2 rounded-xl">
                            <svg className="w-6 h-6 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </div>
                        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Update Available!</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6">
                        A new version <span className="font-mono font-bold text-primary-600 dark:text-primary-400">v{version}</span> is ready to download.
                        Enjoy the latest features and improvements for your notes.
                    </p>

                    <div className="space-y-3">
                        <button
                            onClick={onUpdate}
                            className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-all shadow-md shadow-primary-500/20 active:scale-[0.98]"
                        >
                            Update & Restart
                        </button>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={onSkip}
                                className="py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                Skip This Version
                            </button>
                            <button
                                onClick={onCancel}
                                className="py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                Maybe Later
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

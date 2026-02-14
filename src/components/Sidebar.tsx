
import { Folder, Hash, Plus, Settings } from 'lucide-react';
import clsx from 'clsx';

interface SidebarProps {
    className?: string;
    onCreateNote: () => void;
}

export function Sidebar({ className, onCreateNote }: SidebarProps) {
    return (
        <div className={clsx("flex flex-col bg-gray-100 dark:bg-gray-800 h-full", className)}>
            <div className="p-4">
                <h1 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-6">NotizApp</h1>

                <button
                    onClick={onCreateNote}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors shadow-sm"
                >
                    <Plus size={18} />
                    <span>New Note</span>
                </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-2 space-y-1">
                <div className="px-2 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Folders
                </div>
                {/* TODO: Dynamic Folders */}
                <a href="#" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 rounded-md bg-white dark:bg-gray-700 shadow-sm">
                    <Folder size={18} className="text-blue-500" />
                    All Notes
                </a>

                <div className="mt-8 px-2 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Tags
                </div>
                {/* TODO: Dynamic Tags */}
                <a href="#" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
                    <Hash size={16} />
                    work
                </a>
                <a href="#" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
                    <Hash size={16} />
                    personal
                </a>
            </nav>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <button className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                    <Settings size={18} />
                    Settings
                </button>
            </div>
        </div>
    );
}

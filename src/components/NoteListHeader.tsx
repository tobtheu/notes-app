import React from 'react';
import { Search, LayoutList, List } from 'lucide-react';
import clsx from 'clsx';

interface NoteListHeaderProps {
    searchVisible: boolean;
    isIOS: boolean;
    searchTerm: string;
    onSearchChange: (value: string) => void;
    selectedCategory: string | null;
    folders: string[];
    notesCount: number;
    isCompact: boolean;
    toggleView: () => void;
}

export function NoteListHeader({
    searchVisible,
    isIOS,
    searchTerm,
    onSearchChange,
    selectedCategory,
    folders,
    notesCount,
    isCompact,
    toggleView
}: NoteListHeaderProps) {
    return (
        <div>
            {/* SEARCH INPUT */}
            <div className={clsx(
                "overflow-hidden transition-all duration-200",
                (searchVisible || !isIOS) ? "max-h-16 px-3 pt-3 pb-1" : "max-h-0"
            )}>
                <div className="flex items-center gap-3">
                    <div className="relative group flex-1">
                        <Search className="absolute left-3 top-2.5 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Search notes..."
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-primary-500/20 rounded-xl outline-none transition-all dark:text-gray-100 text-base"
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* CURRENT CONTEXT INFO */}
            <div className={clsx("flex items-center justify-between px-4 pb-1", (searchVisible || !isIOS) ? "pt-2" : "pt-3")}>
                <div className="flex flex-col min-w-0">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 truncate">
                        {folders.includes(selectedCategory || '') ? selectedCategory : 'All Notes'}
                    </h2>
                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {notesCount} {notesCount === 1 ? 'Note' : 'Notes'}
                    </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <button
                        type="button"
                        onClick={toggleView}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 transition-colors"
                        title={isCompact ? "Detail View" : "Compact View"}
                    >
                        {isCompact ? <LayoutList size={18} /> : <List size={18} />}
                    </button>
                </div>
            </div>
        </div>
    );
}

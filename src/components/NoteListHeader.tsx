import { Search } from 'lucide-react';
import clsx from 'clsx';

interface NoteListHeaderProps {
    searchVisible: boolean;
    isIOS: boolean;
    searchTerm: string;
    onSearchChange: (value: string) => void;
}

export function NoteListHeader({
    searchVisible,
    isIOS,
    searchTerm,
    onSearchChange,
}: NoteListHeaderProps) {
    return (
        <div className="select-none shrink-0 px-3 pt-3 pb-2">
            {/* SEARCH INPUT */}
            <div className={clsx(
                "overflow-hidden transition-all duration-200",
                (searchVisible || !isIOS) ? "max-h-16" : "max-h-0"
            )}>
                <div className="relative flex items-center">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search notes..."
                        className="smooth-transition w-full bg-[var(--card-hover)] text-xs h-7 leading-7 py-0 pl-8 pr-3 rounded-xl border border-transparent focus:border-[var(--border-subtle)] outline-none text-[var(--text-main)] placeholder-[var(--text-muted)] focus:ring-1 focus:ring-[var(--accent-color)]/30 flex items-center"
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                </div>
            </div>
        </div>
    );
}

import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { MoreVertical, FileDown, Eye, EyeOff, Zap } from 'lucide-react';

interface EditorMenuProps {
    isIOS: boolean;
    toolbarVisible: boolean;
    setToolbarVisible: (visible: boolean) => void;
    onToggleFocus: () => void;
    onExport: () => void;
}

export function EditorMenu({
    isIOS,
    toolbarVisible,
    setToolbarVisible,
    onToggleFocus,
    onExport
}: EditorMenuProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close action menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        if (isMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isMenuOpen]);

    if (isIOS) {
        return (
            <div className="fixed right-4 z-10000 h-6 top-(--safe-top,0px) flex items-center no-drag" ref={menuRef}>
                <button
                    type="button"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-md transition-colors active:scale-90"
                    title="Actions"
                >
                    <MoreVertical size={18} />
                </button>
                {isMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-56 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 p-1.5 animate-in fade-in zoom-in duration-200 z-[100] backdrop-blur-xl" style={{ backgroundColor: 'var(--app-bg)' }}>
                        <button
                            type="button"
                            onClick={() => { onExport(); setIsMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors group"
                        >
                            <div className="w-8 h-8 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 transition-colors group-hover:bg-primary-100 dark:group-hover:bg-primary-900/40 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                                <FileDown size={16} />
                            </div>
                            <span className="font-medium">Export PDF</span>
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 shrink-0 pt-0.5" ref={menuRef}>
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg transition-colors"
                    title="Actions"
                >
                    <MoreVertical size={18} />
                </button>

                {isMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 p-1.5 animate-in fade-in zoom-in duration-200 z-[100] backdrop-blur-xl" style={{ backgroundColor: 'var(--app-bg)' }}>
                        <button
                            type="button"
                            onClick={() => { onToggleFocus(); setIsMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors group"
                        >
                            <div className="w-8 h-8 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 transition-colors group-hover:bg-primary-100 dark:group-hover:bg-primary-900/40 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                                <Zap size={16} />
                            </div>
                            <span className="font-medium text-primary-600 dark:text-primary-400">Focus Mode</span>
                        </button>

                        <div className="h-px bg-gray-100 dark:bg-gray-700 my-1 mx-1.5" />

                        <button
                            type="button"
                            onClick={() => { onExport(); setIsMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors group"
                        >
                            <div className="w-8 h-8 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 transition-colors group-hover:bg-primary-100 dark:group-hover:bg-primary-900/40 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                                <FileDown size={16} />
                            </div>
                            <span className="font-medium">Export PDF</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => { setToolbarVisible(!toolbarVisible); setIsMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors group"
                        >
                            <div className={clsx(
                                "w-8 h-8 rounded-md flex items-center justify-center transition-colors",
                                toolbarVisible
                                    ? "bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400"
                                    : "bg-gray-100 dark:bg-gray-700 text-gray-500 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/40 group-hover:text-primary-600 group-hover:text-primary-400"
                            )}>
                                {toolbarVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                            </div>
                            <span className="font-medium">{toolbarVisible ? 'Hide' : 'Show'} Toolbar</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

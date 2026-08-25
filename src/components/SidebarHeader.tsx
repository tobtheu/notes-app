import { useEffect, useRef } from 'react';
import { Plus, Settings2, Check, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import clsx from 'clsx';

interface SidebarHeaderProps {
    isCollapsed: boolean;
    onToggleCollapse?: () => void;
    isIOS?: boolean;
    isCreatingFolder: boolean;
    setIsCreatingFolder: (creating: boolean) => void;
    newFolderName: string;
    setNewFolderName: (name: string) => void;
    onCreateFolder?: (name: string) => void;
    isReorderMode: boolean;
    setIsReorderMode: (mode: boolean | ((prev: boolean) => boolean)) => void;
    hasFolders: boolean;
}

export function SidebarHeader({
    isCollapsed,
    onToggleCollapse,
    isIOS = false,
    isCreatingFolder,
    setIsCreatingFolder,
    newFolderName,
    setNewFolderName,
    onCreateFolder,
    isReorderMode,
    setIsReorderMode,
    hasFolders,
}: SidebarHeaderProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    // On iOS, scroll the folder creation input into view when keyboard opens
    useEffect(() => {
        if (!isCreatingFolder || !isIOS) return;
        const el = inputRef.current;
        if (!el) return;

        const scrollIntoView = () => {
            try {
                el.scrollIntoView({ block: 'center', behavior: 'smooth' });
            } catch { }
        };

        const timers = [
            setTimeout(scrollIntoView, 350),
            setTimeout(scrollIntoView, 700),
        ];

        const vv = (window as any).visualViewport;
        const onResize = () => setTimeout(scrollIntoView, 50);
        vv?.addEventListener?.('resize', onResize);

        return () => {
            timers.forEach(clearTimeout);
            vv?.removeEventListener?.('resize', onResize);
        };
    }, [isCreatingFolder, isIOS]);

    const handleCreateFolder = (e: React.FormEvent) => {
        e.preventDefault();
        if (newFolderName.trim() && onCreateFolder) {
            onCreateFolder(newFolderName.trim());
            setNewFolderName("");
            setIsCreatingFolder(false);
        }
    };

    if (isCollapsed) {
        return (
            <div className="flex flex-col items-center py-2 shrink-0 border-b border-[var(--border-subtle)]">
                {onToggleCollapse && (
                    <button
                        type="button"
                        onClick={onToggleCollapse}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--card-hover)] transition-colors active:scale-95"
                        title="Sidebar einblenden"
                        aria-label="Sidebar einblenden"
                    >
                        <PanelLeftOpen size={16} />
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="p-3 shrink-0 border-b border-[var(--border-subtle)]">
            <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-[var(--text-main)] px-1 uppercase tracking-wider">
                    Ordner
                </span>
                <div className="flex items-center gap-1">
                    {hasFolders && (
                        <button
                            type="button"
                            onClick={() => setIsReorderMode(prev => !prev)}
                            className={clsx(
                                "w-7 h-7 flex items-center justify-center rounded-lg transition-colors active:scale-95",
                                isReorderMode
                                    ? "bg-[var(--accent-color)] text-white shadow-sm"
                                    : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--card-hover)]"
                            )}
                            title={isReorderMode ? "Fertig" : "Ordner sortieren"}
                            aria-label={isReorderMode ? "Fertig" : "Ordner sortieren"}
                        >
                            {isReorderMode ? <Check size={14} /> : <Settings2 size={14} />}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => {
                            setIsCreatingFolder(!isCreatingFolder);
                            if (!isCreatingFolder) {
                                setTimeout(() => inputRef.current?.focus(), 50);
                            }
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--card-hover)] transition-colors active:scale-95"
                        title="Neuer Ordner"
                        aria-label="Neuer Ordner"
                    >
                        <Plus size={15} />
                    </button>
                    {onToggleCollapse && (
                        <button
                            type="button"
                            onClick={onToggleCollapse}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--card-hover)] transition-colors active:scale-95"
                            title="Sidebar ausblenden"
                            aria-label="Sidebar ausblenden"
                        >
                            <PanelLeftClose size={15} />
                        </button>
                    )}
                </div>
            </div>

            {isCreatingFolder && (
                <form onSubmit={handleCreateFolder} className="mt-2.5">
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Ordnername..."
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                setIsCreatingFolder(false);
                                setNewFolderName("");
                            }
                        }}
                        className="w-full px-2.5 py-1.5 text-xs bg-[var(--card-hover)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-color)]"
                    />
                </form>
            )}
        </div>
    );
}

import React from 'react';
import { Plus, FileText, Command, FolderTree, Palette, GripVertical, MoreVertical } from 'lucide-react';
import clsx from 'clsx';
import logo from '../assets/logo.png';

interface EmptyStateTutorialProps {
    onCreateNote: () => void;
    className?: string;
}

export const EmptyStateTutorial: React.FC<EmptyStateTutorialProps> = ({
    onCreateNote,
    className
}) => {
    const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    const modKey = isMac ? '⌘' : 'Strg';

    return (
        <div className={clsx(
            "flex-1 flex flex-col items-center justify-center p-6 sm:p-10 select-none overflow-y-auto bg-[var(--canvas-bg)] animate-fade-in",
            className
        )}>
            <div className="max-w-md w-full flex flex-col items-center text-center space-y-6">
                {/* Hero Icon */}
                <img
                    src={logo}
                    alt="LamaNotes"
                    className="w-14 h-14 rounded-2xl shadow-md object-contain select-none pointer-events-none"
                />

                {/* Header Text */}
                <div className="space-y-1.5">
                    <h2 className="text-lg sm:text-xl font-bold text-[var(--text-main)] tracking-tight">
                        Willkommen bei LamaNotes
                    </h2>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-sm">
                        Wähle eine Notiz aus der Liste oder erstelle direkt ein neues Dokument, um loszulegen.
                    </p>
                </div>

                {/* Primary Action Button */}
                <button
                    type="button"
                    onClick={onCreateNote}
                    className="smooth-transition flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-[var(--accent-color)] text-white text-xs font-semibold shadow-sm hover:opacity-90 active:scale-95 transition-all"
                >
                    <Plus size={15} />
                    <span>Neue Notiz erstellen</span>
                    <span className="ml-1 px-1.5 py-0.5 rounded-md bg-white/20 text-[10px] font-mono tracking-tight">
                        {isMac ? '⌘ N' : 'Strg+N'}
                    </span>
                </button>

                {/* Feature / Keyboard Shortcuts Quick Guide */}
                <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-4 text-left">
                    {/* Item 1: Neue Notiz */}
                    <div className="p-3 rounded-2xl bg-[var(--card-hover)] border border-[var(--border-subtle)] space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-[var(--text-main)] flex items-center gap-1.5">
                                <FileText size={13} className="text-[var(--accent-color)]" />
                                Neue Notiz
                            </span>
                            <kbd className="px-1.5 py-0.5 rounded-md bg-[var(--canvas-bg)] border border-[var(--border-subtle)] font-mono text-[10px] text-[var(--text-main)] shadow-2xs">
                                {isMac ? '⌘ N' : 'Strg + N'}
                            </kbd>
                        </div>
                        <p className="text-[10px] text-[var(--text-muted)] leading-normal">
                            Erstellt sofort eine leere Notiz im aktuellen Ordner.
                        </p>
                    </div>

                    {/* Item 2: Slash Commands */}
                    <div className="p-3 rounded-2xl bg-[var(--card-hover)] border border-[var(--border-subtle)] space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-[var(--text-main)] flex items-center gap-1.5">
                                <Command size={13} className="text-[var(--accent-color)]" />
                                Slash-Befehle
                            </span>
                            <kbd className="px-1.5 py-0.5 rounded-md bg-[var(--canvas-bg)] border border-[var(--border-subtle)] font-mono text-[10px] text-[var(--text-main)] shadow-2xs">
                                /
                            </kbd>
                        </div>
                        <p className="text-[10px] text-[var(--text-muted)] leading-normal">
                            Tippe <span className="font-mono text-[10px] text-[var(--text-main)]">/</span> im Editor für Tabellen, To-Dos, Zitate und mehr.
                        </p>
                    </div>

                    {/* Item 3: Ordner & Organisation */}
                    <div className="p-3 rounded-2xl bg-[var(--card-hover)] border border-[var(--border-subtle)] space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-[var(--text-main)] flex items-center gap-1.5">
                                <FolderTree size={13} className="text-[var(--accent-color)]" />
                                Organisation
                            </span>
                            <kbd className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[var(--canvas-bg)] border border-[var(--border-subtle)] font-mono text-[10px] text-[var(--text-main)] shadow-2xs">
                                <GripVertical size={11} className="shrink-0 text-[var(--text-main)]" />
                                <span className="text-[var(--text-muted)]">/</span>
                                <MoreVertical size={11} className="shrink-0 text-[var(--text-main)]" />
                            </kbd>
                        </div>
                        <p className="text-[10px] text-[var(--text-muted)] leading-normal">
                            Ordner per Drag & Drop sortieren und im Kontextmenü anpassen.
                        </p>
                    </div>

                    {/* Item 4: Themes & Einstellungen */}
                    <div className="p-3 rounded-2xl bg-[var(--card-hover)] border border-[var(--border-subtle)] space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-[var(--text-main)] flex items-center gap-1.5">
                                <Palette size={13} className="text-[var(--accent-color)]" />
                                Einstellungen
                            </span>
                            <kbd className="px-1.5 py-0.5 rounded-md bg-[var(--canvas-bg)] border border-[var(--border-subtle)] font-mono text-[10px] text-[var(--text-main)] shadow-2xs">
                                {modKey} ,
                            </kbd>
                        </div>
                        <p className="text-[10px] text-[var(--text-muted)] leading-normal">
                            Dark Mode, Sage Green, Clay Themes & Schriftarten wählen.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

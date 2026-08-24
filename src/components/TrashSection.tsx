import { useState, useMemo, useCallback } from 'react';
import { Trash2, RotateCcw, Folder, Search, AlertTriangle, Clock } from 'lucide-react';
import clsx from 'clsx';
import type { Note } from '../types';
import { extractNoteTitle, extractNotePreview } from '../utils/markdown';
import { getPathId } from '../utils/path';

interface TrashSectionProps {
    trashNotes: Note[];
    onRestoreNote: (id: string) => Promise<void> | void;
    onPermanentlyDeleteNote: (id: string) => Promise<void> | void;
    onEmptyTrash: () => Promise<void> | void;
}

function getDaysRemaining(updatedAt: string): number {
    const deletedTime = new Date(updatedAt).getTime();
    if (isNaN(deletedTime)) return 30;
    const elapsedDays = Math.floor((Date.now() - deletedTime) / (1000 * 60 * 60 * 24));
    return Math.max(0, 30 - elapsedDays);
}

export function TrashSection({
    trashNotes,
    onRestoreNote,
    onPermanentlyDeleteNote,
    onEmptyTrash,
}: TrashSectionProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [exitingNoteIds, setExitingNoteIds] = useState<Set<string>>(new Set());
    const [confirmEmpty, setConfirmEmpty] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Smooth animation before calling restore
    const handleRestoreWithAnimation = useCallback((id: string) => {
        if (actionLoading) return;
        setActionLoading(id);
        setExitingNoteIds(prev => new Set(prev).add(id));
        setTimeout(async () => {
            try {
                await onRestoreNote(id);
            } finally {
                setExitingNoteIds(prev => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
                setActionLoading(null);
            }
        }, 220);
    }, [onRestoreNote, actionLoading]);

    // Smooth animation before calling permanent delete
    const handleDeleteWithAnimation = useCallback((id: string) => {
        if (actionLoading) return;
        setActionLoading(id);
        setExitingNoteIds(prev => new Set(prev).add(id));
        setTimeout(async () => {
            try {
                await onPermanentlyDeleteNote(id);
            } finally {
                setExitingNoteIds(prev => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
                setConfirmDeleteId(null);
                setActionLoading(null);
            }
        }, 220);
    }, [onPermanentlyDeleteNote, actionLoading]);

    const handleEmptyTrash = useCallback(async () => {
        try {
            await onEmptyTrash();
        } finally {
            setConfirmEmpty(false);
        }
    }, [onEmptyTrash]);

    const filteredNotes = useMemo(() => {
        const query = searchTerm.toLowerCase().trim();
        if (!query) return trashNotes;
        return trashNotes.filter(note => {
            const title = extractNoteTitle(note.content, note.filename).toLowerCase();
            const content = note.content.toLowerCase();
            const folder = (note.folder || '').toLowerCase();
            return title.includes(query) || content.includes(query) || folder.includes(query);
        });
    }, [trashNotes, searchTerm]);

    return (
        <div className="space-y-4 text-xs select-none pb-4 flex flex-col h-full overflow-hidden">
            {/* Header & Empty Trash bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-3 border-b border-[var(--border-subtle)] shrink-0">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-[var(--text-main)]">
                            Papierkorb
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--card-hover)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
                            {trashNotes.length} {trashNotes.length === 1 ? 'Notiz' : 'Notizen'}
                        </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                        Gelöschte Notizen verweilen hier 30 Tage vor der endgültigen Löschung.
                    </p>
                </div>

                {trashNotes.length > 0 && (
                    <div className="shrink-0 flex items-center gap-2">
                        {confirmEmpty ? (
                            <div className="flex items-center gap-1.5 animate-fade-in">
                                <button
                                    type="button"
                                    onClick={handleEmptyTrash}
                                    className="px-2.5 py-1 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-xs shadow-sm transition-all active:scale-95 flex items-center gap-1"
                                >
                                    <AlertTriangle size={12} />
                                    <span>Jetzt leeren</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setConfirmEmpty(false)}
                                    className="px-2.5 py-1 rounded-xl bg-[var(--card-hover)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] font-medium text-xs transition-all active:scale-95"
                                >
                                    Abbrechen
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setConfirmEmpty(true)}
                                className="smooth-transition flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--card-hover)] border border-[var(--border-subtle)] text-red-500 hover:bg-red-500/10 hover:border-red-500/30 font-medium text-xs shadow-sm active:scale-95"
                            >
                                <Trash2 size={13} />
                                <span>Papierkorb leeren</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Search Input if there are deleted notes */}
            {trashNotes.length > 3 && (
                <div className="relative shrink-0">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Gelöschte Notizen durchsuchen..."
                        className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[var(--shell-bg)] border border-[var(--border-subtle)] text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-color)] transition-colors"
                    />
                </div>
            )}

            {/* Notes List or Empty State */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-0 custom-scrollbar">
                {trashNotes.length === 0 ? (
                    <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-6 text-[var(--text-muted)]">
                        <div className="w-14 h-14 rounded-2xl bg-[var(--card-hover)] border border-[var(--border-subtle)] flex items-center justify-center mb-3 shadow-inner text-[var(--text-muted)]">
                            <Trash2 size={24} className="opacity-40" />
                        </div>
                        <h4 className="font-semibold text-sm text-[var(--text-main)] mb-1">
                            Der Papierkorb ist leer
                        </h4>
                        <p className="text-xs max-w-xs text-[var(--text-muted)] leading-relaxed">
                            Gelöschte Notizen bleiben 30 Tage erhalten und können jederzeit wiederhergestellt werden.
                        </p>
                    </div>
                ) : filteredNotes.length === 0 ? (
                    <div className="py-12 text-center text-[var(--text-muted)]">
                        Keine Notizen entsprechen der Suche &quot;{searchTerm}&quot;.
                    </div>
                ) : (
                    filteredNotes.map(note => {
                        const noteId = getPathId(note.filename, note.folder);
                        const title = extractNoteTitle(note.content, note.filename);
                        const preview = extractNotePreview(note.content);
                        const daysLeft = getDaysRemaining(note.updatedAt);
                        const isExiting = exitingNoteIds.has(noteId);
                        const isConfirmingDelete = confirmDeleteId === noteId;

                        return (
                            <div
                                key={noteId}
                                className={clsx(
                                    "note-item-wrapper rounded-2xl p-3 border border-[var(--border-subtle)] bg-[var(--card-bg)] hover:bg-[var(--card-hover)] transition-all flex flex-col gap-2 relative group",
                                    isExiting && "note-item-exit"
                                )}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="font-semibold text-xs text-[var(--text-main)] truncate">
                                                {title}
                                            </span>
                                            {note.folder && (
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-[var(--shell-bg)] text-[var(--text-muted)] border border-[var(--border-subtle)] shrink-0">
                                                    <Folder size={10} />
                                                    <span className="truncate max-w-[100px]">{note.folder}</span>
                                                </span>
                                            )}
                                        </div>

                                        {preview && (
                                            <p className="text-[11px] text-[var(--text-muted)] line-clamp-1 leading-snug">
                                                {preview}
                                            </p>
                                        )}
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {isConfirmingDelete ? (
                                            <div className="flex items-center gap-1 animate-fade-in">
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteWithAnimation(noteId)}
                                                    className="px-2 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium text-[11px] transition-all active:scale-95"
                                                    title="Endgültig löschen"
                                                >
                                                    Löschen
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirmDeleteId(null)}
                                                    className="px-2 py-1 rounded-lg bg-[var(--card-hover)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] text-[11px] transition-all active:scale-95"
                                                >
                                                    Abbrechen
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRestoreWithAnimation(noteId)}
                                                    className="smooth-transition flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[var(--shell-bg)] hover:bg-[var(--accent-color)] hover:text-white border border-[var(--border-subtle)] text-[var(--text-main)] font-medium text-[11px] shadow-sm active:scale-95"
                                                    title="Notiz wiederherstellen"
                                                >
                                                    <RotateCcw size={12} />
                                                    <span>Wiederherstellen</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setConfirmDeleteId(noteId)}
                                                    className="smooth-transition p-1.5 rounded-xl hover:bg-red-500/10 hover:text-red-500 text-[var(--text-muted)] border border-transparent hover:border-red-500/20 active:scale-95"
                                                    title="Endgültig löschen"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Expiry countdown footer badge */}
                                <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] pt-1 border-t border-[var(--border-subtle)]/50">
                                    <span className="flex items-center gap-1">
                                        <Clock size={11} className={daysLeft <= 3 ? "text-amber-500" : "opacity-60"} />
                                        <span>
                                            {daysLeft <= 0
                                                ? "Wird in Kürze gelöscht"
                                                : daysLeft === 1
                                                ? "Noch 1 Tag verbleibend"
                                                : `Noch ${daysLeft} Tage verbleibend`}
                                        </span>
                                    </span>

                                    <span className="opacity-70">
                                        {new Date(note.updatedAt).toLocaleDateString(undefined, {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric'
                                        })}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

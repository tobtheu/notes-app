import { useState, useMemo, useCallback } from 'react';
import { Trash2, Search, AlertTriangle } from 'lucide-react';
import type { Note } from '../types';
import { extractNoteTitle } from '../utils/markdown';
import { getPathId } from '../utils/path';
import { TrashListItem } from './TrashListItem';

interface TrashSectionProps {
    trashNotes: Note[];
    onRestoreNote: (id: string) => Promise<void> | void;
    onPermanentlyDeleteNote: (id: string) => Promise<void> | void;
    onEmptyTrash: () => Promise<void> | void;
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
                        <span className="px-2 py-0.5 rounded-full bg-[var(--card-hover)] border border-[var(--border-subtle)] text-[10px] font-mono text-[var(--text-muted)]">
                            {trashNotes.length} {trashNotes.length === 1 ? 'Notiz' : 'Notizen'}
                        </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                        Gelöschte Notizen werden nach 30 Tagen automatisch endgültig gelöscht.
                    </p>
                </div>

                {trashNotes.length > 0 && (
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        {confirmEmpty ? (
                            <div className="flex items-center gap-1.5 p-1 bg-red-500/10 border border-red-500/30 rounded-xl animate-fade-in">
                                <span className="text-[11px] text-red-500 font-medium px-2 flex items-center gap-1">
                                    <AlertTriangle size={12} />
                                    Wirklich alle löschen?
                                </span>
                                <button
                                    type="button"
                                    onClick={handleEmptyTrash}
                                    className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium text-[11px] transition-all active:scale-95 shadow-sm"
                                >
                                    Jetzt leeren
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setConfirmEmpty(false)}
                                    className="px-2 py-1 rounded-lg bg-[var(--card-hover)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] text-[11px] transition-all active:scale-95"
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
                        return (
                            <TrashListItem
                                key={noteId}
                                note={note}
                                isExiting={exitingNoteIds.has(noteId)}
                                isConfirmingDelete={confirmDeleteId === noteId}
                                onRestore={handleRestoreWithAnimation}
                                onDelete={handleDeleteWithAnimation}
                                onStartConfirmDelete={setConfirmDeleteId}
                                onCancelConfirmDelete={() => setConfirmDeleteId(null)}
                            />
                        );
                    })
                )}
            </div>
        </div>
    );
}

import React from 'react';
import { Trash2, RotateCcw, Folder, Clock } from 'lucide-react';
import clsx from 'clsx';
import type { Note } from '../types';
import { extractNoteTitle, extractNotePreview } from '../utils/markdown';
import { getPathId } from '../utils/path';

interface TrashListItemProps {
    note: Note;
    isExiting: boolean;
    isConfirmingDelete: boolean;
    onRestore: (id: string) => void;
    onDelete: (id: string) => void;
    onStartConfirmDelete: (id: string) => void;
    onCancelConfirmDelete: () => void;
}

function getDaysRemaining(updatedAt: string): number {
    const deletedTime = new Date(updatedAt).getTime();
    if (isNaN(deletedTime)) return 30;
    const elapsedDays = Math.floor((Date.now() - deletedTime) / (1000 * 60 * 60 * 24));
    return Math.max(0, 30 - elapsedDays);
}

export const TrashListItem: React.FC<TrashListItemProps> = ({
    note,
    isExiting,
    isConfirmingDelete,
    onRestore,
    onDelete,
    onStartConfirmDelete,
    onCancelConfirmDelete,
}) => {
    const noteId = getPathId(note.filename, note.folder);
    const title = extractNoteTitle(note.content, note.filename);
    const preview = extractNotePreview(note.content);
    const daysLeft = getDaysRemaining(note.updatedAt);

    return (
        <div
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
                                onClick={() => onDelete(noteId)}
                                className="px-2 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium text-[11px] transition-all active:scale-95"
                                title="Endgültig löschen"
                            >
                                Löschen
                            </button>
                            <button
                                type="button"
                                onClick={onCancelConfirmDelete}
                                className="px-2 py-1 rounded-lg bg-[var(--card-hover)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] text-[11px] transition-all active:scale-95"
                            >
                                Abbrechen
                            </button>
                        </div>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={() => onRestore(noteId)}
                                className="smooth-transition flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[var(--shell-bg)] hover:bg-[var(--accent-color)] hover:text-white border border-[var(--border-subtle)] text-[var(--text-main)] font-medium text-[11px] shadow-sm active:scale-95"
                                title="Notiz wiederherstellen"
                            >
                                <RotateCcw size={12} />
                                <span>Wiederherstellen</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => onStartConfirmDelete(noteId)}
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
};

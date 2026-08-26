import { Pin, FolderTree, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { Note } from '../types';
import { useTranslation } from '../i18n';

interface NoteSwipeActionsProps {
    note: Note;
    noteId: string;
    isPinned: boolean;
    swipeOffset: number;
    dropdownOpenId: string | null;
    setDropdownOpenId: (id: string | null) => void;
    onTogglePin: (note: Note) => void;
    onDeleteNote: (id: string) => void;
    closeSwipe: () => void;
}

export function NoteSwipeActions({
    note,
    noteId,
    isPinned,
    swipeOffset,
    dropdownOpenId,
    setDropdownOpenId,
    onTogglePin,
    onDeleteNote,
    closeSwipe,
}: NoteSwipeActionsProps) {
    const { t } = useTranslation();

    return (
        <div
            style={{
                opacity: swipeOffset !== 0 ? 1 : 0,
                pointerEvents: swipeOffset !== 0 ? 'auto' : 'none'
            }}
            className="absolute inset-y-[2px] right-[2px] left-[2px] ml-auto flex items-center justify-end max-w-[192px] z-0 h-[calc(100%-4px)] rounded-r-xl overflow-hidden transition-opacity duration-150"
        >
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onTogglePin(note); closeSwipe(); }}
                className={clsx(
                    "flex items-center justify-center w-14 h-full text-white transition-colors shrink-0",
                    isPinned ? "bg-[var(--accent-color)]" : "bg-gray-400 dark:bg-gray-600"
                )}
                title={isPinned ? t('notes.unpinNote') : t('notes.pinNote')}
            >
                <Pin size={16} fill={isPinned ? "currentColor" : "none"} />
            </button>
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setDropdownOpenId(dropdownOpenId === noteId ? null : noteId); closeSwipe(); }}
                className="flex items-center justify-center w-14 h-full bg-blue-500 hover:bg-blue-600 text-white transition-colors shrink-0 folder-dropdown-trigger"
                title={t('notes.moveToFolder')}
            >
                <FolderTree size={16} />
            </button>
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDeleteNote(noteId); closeSwipe(); }}
                className="flex items-center justify-center w-14 h-full bg-red-500 hover:bg-red-600 text-white transition-colors shrink-0 rounded-r-xl"
                title={t('notes.deleteNote')}
            >
                <Trash2 size={16} />
            </button>
        </div>
    );
}

interface NoteMenuPopoverProps {
    isOpen: boolean;
    onClose: () => void;
    note: Note;
    noteId: string;
    isPinned: boolean;
    dropdownOpenId: string | null;
    setDropdownOpenId: (id: string | null) => void;
    onTogglePin: (note: Note) => void;
    onDeleteNote: (id: string) => void;
}

export function NoteMenuPopover({
    isOpen,
    onClose,
    note,
    noteId,
    isPinned,
    dropdownOpenId,
    setDropdownOpenId,
    onTogglePin,
    onDeleteNote,
}: NoteMenuPopoverProps) {
    const { t } = useTranslation();

    if (!isOpen) return null;

    return (
        <div
            className="absolute right-2 top-8 z-50 bg-[var(--canvas-bg)] border border-[var(--border-subtle)] shadow-xl rounded-2xl py-1.5 w-40 text-xs font-medium animate-popover-expand backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
        >
            <button
                type="button"
                onClick={() => {
                    onTogglePin(note);
                    onClose();
                }}
                className="smooth-transition w-full text-left px-3 py-1.5 hover:bg-[var(--card-hover)] flex items-center gap-2 text-[var(--text-main)] active:scale-95"
            >
                <Pin size={13} className={clsx("text-[var(--text-muted)]", isPinned && "fill-current text-[var(--accent-color)]")} />
                <span>{isPinned ? t('notes.unpinNote') : t('notes.pinNote')}</span>
            </button>
            <button
                type="button"
                onClick={() => {
                    onClose();
                    setDropdownOpenId(dropdownOpenId === noteId ? null : noteId);
                }}
                className="smooth-transition w-full text-left px-3 py-1.5 hover:bg-[var(--card-hover)] flex items-center gap-2 text-[var(--text-main)] active:scale-95 folder-dropdown-trigger"
            >
                <FolderTree size={13} className="text-[var(--text-muted)]" />
                <span>{t('notes.moveToFolder')}...</span>
            </button>
            <div className="h-px bg-[var(--border-subtle)] my-1 mx-2" />
            <button
                type="button"
                onClick={() => {
                    onClose();
                    onDeleteNote(noteId);
                }}
                className="smooth-transition w-full text-left px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 flex items-center gap-2 active:scale-95"
            >
                <Trash2 size={13} />
                <span>{t('common.delete')}</span>
            </button>
        </div>
    );
}


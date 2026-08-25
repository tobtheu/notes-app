import { useEffect, useRef } from 'react';
import { Pencil, Trash2 } from 'lucide-react';

interface FolderActionMenuProps {
    isOpen: boolean;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

export function FolderActionMenu({
    isOpen,
    onClose,
    onEdit,
    onDelete,
}: FolderActionMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            ref={menuRef}
            className="absolute right-0 top-full mt-1 w-32 bg-[var(--canvas-bg)] border border-[var(--border-subtle)] rounded-xl shadow-lg z-50 py-1 text-xs animate-in fade-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
        >
            <button
                type="button"
                onClick={() => {
                    onClose();
                    onEdit();
                }}
                className="w-full px-3 py-1.5 flex items-center gap-2 text-[var(--text-main)] hover:bg-[var(--card-hover)] transition-colors text-left font-medium"
            >
                <Pencil size={12} className="text-[var(--text-muted)]" />
                <span>Bearbeiten</span>
            </button>
            <button
                type="button"
                onClick={() => {
                    onClose();
                    onDelete();
                }}
                className="w-full px-3 py-1.5 flex items-center gap-2 text-red-500 hover:bg-red-500/10 transition-colors text-left font-medium"
            >
                <Trash2 size={12} />
                <span>Löschen</span>
            </button>
        </div>
    );
}

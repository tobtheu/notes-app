import { useEffect, useRef } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from '../i18n';

interface FolderActionMenuProps {
    isOpen: boolean;
    onClose: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
}

export function FolderActionMenu({
    isOpen,
    onClose,
    onEdit,
    onDelete,
}: FolderActionMenuProps) {
    const { t } = useTranslation();
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('click', handleClickOutside);
        }

        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            ref={menuRef}
            className="absolute right-0 top-7 z-50 bg-[var(--canvas-bg)] border border-[var(--border-subtle)] shadow-xl rounded-2xl py-1.5 w-36 text-xs font-medium animate-popover-expand backdrop-blur-xl select-none"
            onClick={(e) => e.stopPropagation()}
        >
            {onEdit && (
                <button
                    type="button"
                    onClick={() => {
                        onClose();
                        onEdit();
                    }}
                    className="smooth-transition w-full text-left px-3 py-1.5 hover:bg-[var(--card-hover)] flex items-center gap-2 text-[var(--text-main)] active:scale-95"
                >
                    <Pencil size={13} className="text-[var(--text-muted)]" />
                    <span>{t('modals.editFolder')}</span>
                </button>
            )}
            {onDelete && (
                <>
                    <div className="h-px bg-[var(--border-subtle)] my-1 mx-2" />
                    <button
                        type="button"
                        onClick={() => {
                            onClose();
                            onDelete();
                        }}
                        className="smooth-transition w-full text-left px-3 py-1.5 hover:bg-red-500/10 flex items-center gap-2 text-red-500 active:scale-95"
                    >
                        <Trash2 size={13} />
                        <span>{t('common.delete')}</span>
                    </button>
                </>
            )}
        </div>
    );
}


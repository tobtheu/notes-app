import React from 'react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

interface ToolbarButtonProps {
    icon: LucideIcon;
    label: string;
    action: () => void;
    isActive?: boolean;
    iconSize?: number;
    btnPadding?: string;
}

export const ToolbarButton: React.FC<ToolbarButtonProps> = ({
    icon: Icon,
    label,
    action,
    isActive,
    iconSize = 14,
    btnPadding = "p-1.5"
}) => (
    <button
        type="button"
        onMouseDown={(e) => {
            e.preventDefault();
        }}
        onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            action();
        }}
        className={clsx(
            "smooth-transition rounded-xl flex items-center justify-center shrink-0 w-7 h-7 active:scale-95",
            btnPadding,
            isActive
                ? "bg-[var(--card-active)] text-[var(--accent-color)] shadow-sm font-semibold"
                : "text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10"
        )}
        title={label}
    >
        <Icon size={iconSize} />
    </button>
);

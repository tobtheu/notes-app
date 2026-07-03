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
    iconSize = 16,
    btnPadding = "p-1.5"
}) => (
    <button
        onMouseDown={(e) => {
            e.preventDefault();
        }}
        onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            action();
        }}
        className={clsx(
            "rounded-md transition-colors flex items-center justify-center shrink-0",
            btnPadding,
            isActive
                ? "bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400"
                : "text-gray-500 dark:text-gray-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400"
        )}
        title={label}
    >
        <Icon size={iconSize} strokeWidth={2.5} />
    </button>
);

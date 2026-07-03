import React, { useRef, useState } from 'react';
import { Folder, Pencil, Trash2, GripVertical } from 'lucide-react';
import clsx from 'clsx';
import type { AppMetadata } from '../types';
import { normalizeStr } from '../utils/path';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ICON_MAP, COLOR_MAP } from '../utils/sidebar';

export interface FolderItemProps {
    folder: string;
    metadata: AppMetadata;
    selectedCategory: string | null;
    isCollapsed: boolean;
    isReorderMode?: boolean;
    isIOS?: boolean;
    monochromeIcons?: boolean;
    onSelectCategory?: (name: string | null) => void;
    onEditCategory?: (name: string) => void;
    onDeleteCategory?: (name: string) => void;
    isDragging?: boolean;
    isOverlay?: boolean;
    setNodeRef?: (node: HTMLElement | null) => void;
    attributes?: any;
    listeners?: any;
    style?: React.CSSProperties;
}

export interface SortableFolderItemProps {
    id: string;
    folder: string;
    metadata: AppMetadata;
    selectedCategory: string | null;
    isCollapsed: boolean;
    isReorderMode: boolean;
    isIOS?: boolean;
    monochromeIcons?: boolean;
    onSelectCategory: (name: string | null) => void;
    onEditCategory: (name: string) => void;
    onDeleteCategory: (name: string) => void;
}

const CategoryActionButtons = ({
    folder,
    onEditCategory,
    onDeleteCategory,
    containerClass,
    buttonClass,
    deleteButtonClass
}: {
    folder: string;
    onEditCategory: (name: string) => void;
    onDeleteCategory: (name: string) => void;
    containerClass: string;
    buttonClass: string;
    deleteButtonClass: string;
}) => (
    <div className={containerClass}>
        <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEditCategory(folder); }}
            className={buttonClass}
            title="Edit"
        >
            <Pencil size={16} />
        </button>
        <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDeleteCategory(folder); }}
            className={deleteButtonClass}
            title="Delete"
        >
            <Trash2 size={16} />
        </button>
    </div>
);

export const FolderItem = ({
    folder, metadata, selectedCategory, isCollapsed, isReorderMode = false, isIOS = false, monochromeIcons = false,
    onSelectCategory, onEditCategory, onDeleteCategory,
    isDragging, isOverlay, setNodeRef, attributes, listeners, style
}: FolderItemProps) => {
    const longPressTimer = useRef<any>(null);
    const [isLongPressing, setIsLongPressing] = useState(false);
    const [isPressing, setIsPressing] = useState(false);

    const cancelPress = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
        setIsPressing(false);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (isReorderMode) return;
        e.preventDefault();
        setIsLongPressing(false);
        setIsPressing(true);
        longPressTimer.current = setTimeout(() => {
            setIsPressing(false);
            setIsLongPressing(true);
            (window as any).webkit?.messageHandlers?.hapticImpact?.postMessage(null);
            if (onEditCategory) onEditCategory(folder);
        }, 500);
    };

    const handleTouchEnd = () => {
        const wasLongPress = isLongPressing;
        cancelPress();
        if (!wasLongPress && onSelectCategory) {
            onSelectCategory(folder);
        }
        setIsLongPressing(false);
    };

    const handleTouchMove = () => {
        cancelPress();
        setIsLongPressing(false);
    };

    const folderKey = Object.keys(metadata.folders).find(k => normalizeStr(k) === normalizeStr(folder)) || folder;
    const folderMeta = metadata.folders[folderKey] || {};
    const IconComponent = ICON_MAP[folderMeta.icon || 'Folder'] || Folder;
    const colorStyles = COLOR_MAP[folderMeta.color || 'gray'];
    const isSelected = !!selectedCategory && normalizeStr(selectedCategory) === normalizeStr(folder);

    return (
        <div
            ref={setNodeRef}
            style={{ ...style, WebkitTouchCallout: 'none', userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}
            className={clsx(
                "group relative flex items-center transition-all rounded-lg cursor-pointer mb-0.5 outline-none",
                isCollapsed ? "justify-center py-1.5" : clsx("px-1 gap-2 text-sm font-medium", isIOS ? "py-2.5" : "py-1.5"),
                isSelected
                    ? isCollapsed
                        ? clsx(colorStyles.bg, colorStyles.darkBg, "shadow-sm")
                        : "bg-white dark:bg-gray-700 shadow-sm text-gray-700 dark:text-gray-100"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700",
                isDragging && "opacity-40",
                isOverlay && "shadow-lg scale-105 opacity-90 cursor-grabbing bg-white dark:bg-gray-800"
            )}
            title={isCollapsed ? folder : undefined}
            onClick={() => {
                if (!('ontouchstart' in window) && onSelectCategory) onSelectCategory(folder);
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
        >
            {isPressing && (
                <span className={clsx("absolute inset-0 rounded-lg animate-longpress pointer-events-none", colorStyles.bg, colorStyles.darkBg)} />
            )}

            <div className={clsx("flex items-center gap-2 shrink-0 min-w-0", isCollapsed ? "justify-center" : "flex-1 pr-1")}>
                {!isCollapsed && (
                    <div
                        {...attributes}
                        {...listeners}
                        className={clsx(
                            "shrink-0 outline-none transition-all",
                            isReorderMode
                                ? "text-gray-400 dark:text-gray-500 cursor-grab active:cursor-grabbing opacity-100"
                                : "text-gray-300 dark:text-gray-600 cursor-grab opacity-0 lg:group-hover:opacity-100"
                        )}
                    >
                        <GripVertical size={14} />
                    </div>
                )}
                <div className={clsx(
                    "p-1 rounded-md transition-colors shrink-0",
                    isSelected && !isCollapsed ? (monochromeIcons ? "bg-gray-100 dark:bg-gray-800" : colorStyles.bg + " " + colorStyles.darkBg) : "bg-transparent"
                )}>
                    <IconComponent
                        size={isCollapsed ? 20 : 18}
                        className={clsx(monochromeIcons ? "text-inherit" : clsx(colorStyles.text, colorStyles.darkText))}
                    />
                </div>
                {!isCollapsed && <span className="truncate flex-1 py-0.5">{folder}</span>}
            </div>

            {!isCollapsed && !isReorderMode && onEditCategory && onDeleteCategory && (
                <CategoryActionButtons
                    folder={folder}
                    onEditCategory={onEditCategory}
                    onDeleteCategory={onDeleteCategory}
                    containerClass="absolute right-1.5 px-1 py-1 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-md shadow-sm border border-gray-100/50 dark:border-gray-700/50 z-20 hidden lg:flex"
                    buttonClass="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-primary-500 rounded transition-all outline-none"
                    deleteButtonClass="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/40 text-gray-500 hover:text-red-500 rounded transition-all outline-none"
                />
            )}

            {!isCollapsed && isReorderMode && onEditCategory && onDeleteCategory && (
                <CategoryActionButtons
                    folder={folder}
                    onEditCategory={onEditCategory}
                    onDeleteCategory={onDeleteCategory}
                    containerClass="flex items-center gap-0.5 shrink-0 ml-1"
                    buttonClass="p-2 text-gray-400 hover:text-primary-500 active:text-primary-500 rounded-md transition-all"
                    deleteButtonClass="p-2 text-gray-400 hover:text-red-500 active:text-red-500 rounded-md transition-all"
                />
            )}
        </div>
    );
};

export const SortableFolderItem = (props: SortableFolderItemProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: props.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <FolderItem
            {...props}
            setNodeRef={setNodeRef}
            style={style}
            attributes={attributes}
            listeners={listeners}
            isDragging={isDragging}
            isReorderMode={props.isReorderMode}
            isIOS={props.isIOS}
            monochromeIcons={props.monochromeIcons}
        />
    );
};

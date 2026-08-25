import React, { useRef, useState } from 'react';
import { Folder, GripVertical, MoreVertical } from 'lucide-react';
import clsx from 'clsx';
import type { AppMetadata } from '../types';
import { normalizeStr } from '../utils/path';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ICON_MAP, COLOR_MAP } from '../utils/sidebar';
import { FolderActionMenu } from './FolderActionMenu';

export interface FolderItemProps {
    folder: string;
    metadata: AppMetadata;
    selectedCategory: string | null;
    isCollapsed: boolean;
    isReorderMode?: boolean;
    isIOS?: boolean;
    monochromeIcons?: boolean;
    showNoteCounts?: boolean;
    noteCount?: number;
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
    isReorderMode?: boolean;
    isIOS?: boolean;
    monochromeIcons?: boolean;
    showNoteCounts?: boolean;
    noteCount?: number;
    onSelectCategory: (name: string | null) => void;
    onEditCategory: (name: string) => void;
    onDeleteCategory: (name: string) => void;
}

export const FolderItem = ({
    folder, metadata, selectedCategory, isCollapsed, isReorderMode = false, isIOS = false, monochromeIcons = false,
    showNoteCounts = false,
    noteCount = 0,
    onSelectCategory, onEditCategory, onDeleteCategory,
    isDragging, isOverlay, setNodeRef, attributes, listeners, style
}: FolderItemProps) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
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

    const handleTouchStart = () => {
        if (isReorderMode) return;
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
                "group/folder folder-item-animated relative flex items-center rounded-xl cursor-pointer outline-none border",
                isCollapsed ? "justify-center py-2 px-1" : clsx("px-2.5 gap-2 text-xs font-medium", isIOS ? "py-2" : "py-1.5"),
                isSelected
                    ? "bg-[var(--card-active)] border-[var(--border-subtle)] text-[var(--text-main)] font-semibold shadow-sm"
                    : "text-[var(--text-muted)] hover:bg-[var(--card-hover)] hover:text-[var(--text-main)] border-transparent",
                isDragging && "opacity-40",
                isOverlay && "shadow-xl scale-105 opacity-95 cursor-grabbing bg-[var(--card-hover)] z-50 rounded-xl",
                isMenuOpen && "z-30"
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
                <span className={clsx("absolute inset-0 rounded-xl animate-longpress pointer-events-none opacity-20 bg-current")} />
            )}

            <div className={clsx("flex items-center gap-2 shrink-0 min-w-0 w-full", isCollapsed ? "justify-center" : "flex-1")}>
                {/* Drag handle or Icon */}
                <div className="flex items-center gap-2 min-w-0">
                    <div className="relative flex items-center justify-center w-4 h-4 shrink-0">
                        {!isCollapsed && (
                            <div
                                {...attributes}
                                {...listeners}
                                className={clsx(
                                    "outline-none transition-opacity duration-200 absolute w-5 h-5 -m-0.5 flex items-center justify-center z-20 touch-none",
                                    isReorderMode
                                        ? "text-[var(--text-muted)] cursor-grab active:cursor-grabbing opacity-100"
                                        : "opacity-0 group-hover/folder:opacity-100 text-[var(--text-muted)] cursor-grab active:cursor-grabbing pointer-events-none group-hover/folder:pointer-events-auto"
                                )}
                                title="Drag to reorder"
                            >
                                <GripVertical size={13} />
                            </div>
                        )}
                        <div className={clsx(
                            "transition-opacity duration-200 flex items-center justify-center",
                            !isCollapsed && !isReorderMode && "group-hover/folder:opacity-0"
                        )}>
                            <IconComponent
                                size={isCollapsed ? (isIOS ? 20 : 16) : 14}
                                className={clsx(monochromeIcons ? "text-inherit" : clsx(colorStyles.text, colorStyles.darkText))}
                            />
                        </div>
                    </div>

                    {!isCollapsed && <span className="truncate flex-1">{folder}</span>}
                </div>

                {/* Right Note Count (fades out on hover) */}
                {!isCollapsed && showNoteCounts && (
                    <span className="ml-auto text-[10px] font-mono text-[var(--text-muted)] group-hover/folder:opacity-0 transition-opacity duration-200 pr-0.5">
                        {noteCount}
                    </span>
                )}
            </div>

            {/* 3-Dots Button (fades in at same position on hover) */}
            {!isCollapsed && !isReorderMode && (onEditCategory || onDeleteCategory) && (
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/folder:opacity-100 transition-opacity duration-200">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsMenuOpen(!isMenuOpen);
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-[var(--canvas-bg)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                        title="Ordneroptionen"
                        aria-label="Ordneroptionen"
                    >
                        <MoreVertical size={13} />
                    </button>

                    <FolderActionMenu
                        isOpen={isMenuOpen}
                        onClose={() => setIsMenuOpen(false)}
                        onEdit={() => onEditCategory?.(folder)}
                        onDelete={() => onDeleteCategory?.(folder)}
                    />
                </div>
            )}
        </div>
    );
};

export const SortableFolderItem = ({
    id, folder, metadata, selectedCategory, isCollapsed, isReorderMode = false, isIOS = false, monochromeIcons = false,
    showNoteCounts = false, noteCount = 0,
    onSelectCategory, onEditCategory, onDeleteCategory
}: SortableFolderItemProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
        transition,
    };

    return (
        <FolderItem
            folder={folder}
            metadata={metadata}
            selectedCategory={selectedCategory}
            isCollapsed={isCollapsed}
            isReorderMode={isReorderMode}
            isIOS={isIOS}
            monochromeIcons={monochromeIcons}
            showNoteCounts={showNoteCounts}
            noteCount={noteCount}
            onSelectCategory={onSelectCategory}
            onEditCategory={onEditCategory}
            onDeleteCategory={onDeleteCategory}
            isDragging={isDragging}
            setNodeRef={setNodeRef}
            attributes={attributes}
            listeners={listeners}
            style={style}
        />
    );
};

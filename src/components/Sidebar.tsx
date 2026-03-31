import { useRef, useState } from 'react';
import {
    Folder, Book, Star, Code, Heart, Target, Briefcase, Music, Home, Layout,
    Coffee, Zap, Flag, Bell, Cloud, Camera, Smile, ShoppingCart,
    Plus, Settings, Settings2, Trash2, Pencil, GripVertical, Check
} from 'lucide-react';
import clsx from 'clsx';
import { SyncStatusBadge } from './SyncStatusBadge';
import type { AppMetadata, ConflictPair } from '../types';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * ICON_MAP
 * Configuration Point: Add or remove Lucide icons here to make them available for folder selection.
 */
const ICON_MAP: Record<string, any> = {
    Folder, Book, Star, Code, Heart, Target, Briefcase, Music, Home, Layout,
    Coffee, Zap, Flag, Bell, Cloud, Camera, Smile, ShoppingCart, Settings, Trash2
};

/**
 * COLOR_MAP
 * Configuration Point: Define theme colors for folders. Use Tailwind CSS classes.
 */
const COLOR_MAP: Record<string, any> = {
    red: { bg: 'bg-red-100', text: 'text-red-600', darkBg: 'dark:bg-red-900/30', darkText: 'dark:text-red-400' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-600', darkBg: 'dark:bg-orange-900/30', darkText: 'dark:text-orange-400' },
    amber: { bg: 'bg-amber-100', text: 'text-amber-600', darkBg: 'dark:bg-amber-900/30', darkText: 'dark:text-amber-400' },
    green: { bg: 'bg-emerald-100', text: 'text-emerald-600', darkBg: 'dark:bg-emerald-900/30', darkText: 'dark:text-emerald-400' },
    cyan: { bg: 'bg-cyan-100', text: 'text-cyan-600', darkBg: 'dark:bg-cyan-900/30', darkText: 'dark:text-cyan-400' },
    blue: { bg: 'bg-blue-100', text: 'text-blue-600', darkBg: 'dark:bg-blue-900/30', darkText: 'dark:text-blue-400' },
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', darkBg: 'dark:bg-indigo-900/30', darkText: 'dark:text-indigo-400' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600', darkBg: 'dark:bg-purple-900/30', darkText: 'dark:text-purple-400' },
    pink: { bg: 'bg-pink-100', text: 'text-pink-600', darkBg: 'dark:bg-pink-900/30', darkText: 'dark:text-pink-400' },
    gray: { bg: 'bg-gray-100', text: 'text-gray-600', darkBg: 'dark:bg-gray-800', darkText: 'dark:text-gray-400' },
};

interface SidebarProps {
    className?: string;
    folders?: string[];
    metadata: AppMetadata;
    selectedCategory: string | null;
    isCollapsed: boolean;
    onCreateNote: () => void;
    onCreateFolder?: (name: string) => void;
    onDeleteCategory: (name: string) => void;
    onEditCategory: (name: string) => void;
    onSelectCategory: (name: string | null) => void;
    onReorderFolders?: (newOrder: string[]) => void;
    onOpenSettings?: () => void;
    syncStatus?: 'idle' | 'syncing' | 'synced' | 'offline' | 'error' | 'conflict';
    syncError?: string | null;
    lastSyncedAt?: Date | null;
    conflictFiles?: ConflictPair[];
    onSync?: () => void;
}

interface FolderItemProps {
    folder: string;
    metadata: AppMetadata;
    selectedCategory: string | null;
    isCollapsed: boolean;
    isReorderMode?: boolean;
    onSelectCategory?: (name: string | null) => void;
    onEditCategory?: (name: string) => void;
    onDeleteCategory?: (name: string) => void;
    onActivateReorderMode?: () => void;
    isDragging?: boolean;
    isOverlay?: boolean;
    setNodeRef?: (node: HTMLElement | null) => void;
    attributes?: any;
    listeners?: any;
    style?: React.CSSProperties;
}

interface SortableFolderItemProps {
    id: string;
    folder: string;
    metadata: AppMetadata;
    selectedCategory: string | null;
    isCollapsed: boolean;
    isReorderMode: boolean;
    onSelectCategory: (name: string | null) => void;
    onEditCategory: (name: string) => void;
    onDeleteCategory: (name: string) => void;
    onActivateReorderMode: () => void;
}

const normalizeStr = (s: string) => s.normalize('NFC').toLowerCase();

/**
 * FolderItem Component
 * Individual folder row inside the sidebar. Handles selection, hover actions (edit/delete), and DnD visual states.
 */
const FolderItem = ({
    folder, metadata, selectedCategory, isCollapsed, isReorderMode = false,
    onSelectCategory, onEditCategory, onDeleteCategory, onActivateReorderMode,
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
        // In reorder mode touches go straight to dnd-kit via the drag handle
        if (isReorderMode) return;
        // Prevent iOS text-selection callout and default long-press context menu
        e.preventDefault();
        setIsLongPressing(false);
        setIsPressing(true);
        longPressTimer.current = setTimeout(() => {
            setIsPressing(false);
            setIsLongPressing(true);
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
        // Finger moved — user is scrolling, cancel the long-press timer
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
                isCollapsed ? "justify-center py-2.5" : "px-1 py-2.5 gap-2 text-sm font-medium",
                isSelected
                    ? "bg-white dark:bg-gray-700 shadow-sm text-gray-700 dark:text-gray-100"
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
            {/* Long-press ripple animation overlay */}
            {isPressing && (
                <span className="absolute inset-0 rounded-lg bg-primary-500/25 animate-longpress pointer-events-none" />
            )}

            <div className={clsx("flex items-center gap-2 shrink-0 min-w-0", isCollapsed ? "justify-center" : "flex-1 pr-1")}>
                {!isCollapsed && (
                    <div
                        {...attributes}
                        {...(isReorderMode ? listeners : {})}
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
                    isSelected ? colorStyles.bg + " " + colorStyles.darkBg : "bg-transparent"
                )}>
                    <IconComponent
                        size={isCollapsed ? 20 : 18}
                        className={clsx(colorStyles.text, colorStyles.darkText)}
                    />
                </div>
                {!isCollapsed && <span className="truncate flex-1 py-0.5">{folder}</span>}
            </div>

            {/* Desktop hover actions */}
            {!isCollapsed && !isReorderMode && onEditCategory && onDeleteCategory && (
                <div className="absolute right-1.5 px-1 py-1 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-md shadow-sm border border-gray-100/50 dark:border-gray-700/50 z-20 hidden lg:flex">
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onEditCategory(folder); }}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-primary-500 rounded transition-all outline-none"
                        title="Edit Category"
                    >
                        <Pencil size={12} />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDeleteCategory(folder); }}
                        className="p-1 hover:bg-red-50 dark:hover:bg-red-900/40 text-gray-500 hover:text-red-500 rounded transition-all outline-none"
                        title="Delete Category"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            )}

            {/* Reorder mode: edit/delete buttons visible on mobile */}
            {!isCollapsed && isReorderMode && onEditCategory && onDeleteCategory && (
                <div className="flex items-center gap-0.5 shrink-0 ml-1">
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onEditCategory(folder); }}
                        className="p-1.5 text-gray-400 hover:text-primary-500 active:text-primary-500 rounded-md transition-all"
                        title="Edit"
                    >
                        <Pencil size={13} />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDeleteCategory(folder); }}
                        className="p-1.5 text-gray-400 hover:text-red-500 active:text-red-500 rounded-md transition-all"
                        title="Delete"
                    >
                        <Trash2 size={13} />
                    </button>
                </div>
            )}
        </div>
    );
};

/**
 * SortableFolderItem
 * Wrapper for FolderItem to inject DnD-kit sortable functionality.
 */
const SortableFolderItem = (props: SortableFolderItemProps) => {
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
            onActivateReorderMode={props.onActivateReorderMode}
        />
    );
};

/**
 * Sidebar Component
 * Primary navigation column. Contains the search/creation header and the scrollable folder list.
 */
export function Sidebar({
    className,
    folders = [],
    metadata,
    selectedCategory,
    isCollapsed,
    onCreateNote,
    onCreateFolder,
    onDeleteCategory,
    onEditCategory,
    onSelectCategory,
    onReorderFolders = undefined,
    onOpenSettings,
    syncStatus = 'idle',
    syncError = null,
    lastSyncedAt = null,
    conflictFiles = [],
    onSync,
}: SidebarProps) {
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isReorderMode, setIsReorderMode] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        // TouchSensor: only active when isReorderMode (listeners are only applied to
        // the drag handle in reorder mode, so this is effectively a no-op otherwise)
        useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const handleCreateFolder = (e: React.FormEvent) => {
        e.preventDefault();
        if (newFolderName.trim() && onCreateFolder) {
            onCreateFolder(newFolderName.trim());
            setNewFolderName("");
            setIsCreatingFolder(false);
        }
    };

    /**
     * DnD Event Handlers
     */
    const handleDragStart = (event: any) => {
        setActiveId(event.active.id);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveId(null);
        const { active, over } = event;

        if (over && active.id !== over.id && onReorderFolders) {
            const oldIndex = folders.indexOf(active.id as string);
            const newIndex = folders.indexOf(over.id as string);

            if (oldIndex !== -1 && newIndex !== -1) {
                onReorderFolders(arrayMove(folders, oldIndex, newIndex));
            }
        }
    };

    return (
        <div
            className={clsx(
                "flex flex-col h-full bg-gray-50 dark:bg-gray-950 border-r border-gray-100 dark:border-gray-800 transition-all duration-300 shrink-0 overflow-x-hidden",
                // Configuration Point: Sidebar Widths
                isCollapsed ? "w-16" : "w-64",
                className
            )}
        >
            {/* --- SIDEBAR TOP SECTION REMOVED (Moved to TitleBar) --- */}


            {/* --- ACTIONS HEADER --- */}
            <div className="px-2 pt-4 pb-2">
                <div className={clsx("mb-6 px-1 lg:px-2", isCollapsed ? "flex flex-col items-center" : "block")}>
                    <button
                        onClick={onCreateNote}
                        className={clsx(
                            "flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white transition-all shadow-md shadow-primary-500/20 font-medium active:scale-[0.98]",
                            isCollapsed ? "w-10 h-10 rounded-full" : "w-full py-2.5 rounded-xl"
                        )}
                        title="New Note"
                    >
                        <Plus size={18} />
                        {!isCollapsed && <span>New Note</span>}
                    </button>
                </div>

                {!isCollapsed && (
                    <div className="px-3 mb-2 flex items-center justify-between group">
                        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                            Categories
                        </span>
                        <div className="flex items-center gap-1">
                            {isReorderMode ? (
                                <button
                                    type="button"
                                    onClick={() => setIsReorderMode(false)}
                                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary-500 text-white active:bg-primary-600 transition-colors"
                                >
                                    <Check size={11} />
                                    Fertig
                                </button>
                            ) : (
                                <>
                                    {/* Desktop: new folder on hover */}
                                    <button
                                        type="button"
                                        onClick={() => setIsCreatingFolder(true)}
                                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded text-gray-400 transition-opacity hidden lg:block lg:opacity-0 lg:group-hover:opacity-100"
                                        title="New Folder"
                                    >
                                        <Plus size={14} />
                                    </button>
                                    {/* Mobile: reorder mode toggle */}
                                    <button
                                        type="button"
                                        onClick={() => setIsReorderMode(true)}
                                        className="p-1 rounded text-gray-400 active:text-primary-500 transition-colors lg:hidden"
                                        title="Reorder"
                                    >
                                        <Settings2 size={14} />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* --- SCROLLABLE NAVIGATION CONTENT --- */}
            <div className="flex-1 overflow-y-auto px-2 pb-4 custom-scrollbar overflow-x-hidden">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragCancel={() => setActiveId(null)}
                >
                    <div className="space-y-0.5 mb-4 px-1">
                        {/* Static "All Notes" folder */}
                        <button
                            onClick={() => onSelectCategory(null)}
                            className={clsx(
                                "w-full flex items-center transition-colors rounded-lg",
                                isCollapsed ? "justify-center py-3" : "px-3 py-2.5 gap-3 text-sm font-medium",
                                !selectedCategory ? "bg-white dark:bg-gray-700 shadow-sm text-gray-700 dark:text-gray-100" : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                            )}
                            title="All Notes"
                        >
                            <Folder size={isCollapsed ? 20 : 18} className={!selectedCategory ? "text-primary-500" : "text-gray-400"} />
                            {!isCollapsed && <span>All Notes</span>}
                        </button>

                        {/* Sortable user folders */}
                        <SortableContext
                            items={folders}
                            strategy={verticalListSortingStrategy}
                        >
                            {folders.map(folder => (
                                <SortableFolderItem
                                    key={folder}
                                    id={folder}
                                    folder={folder}
                                    metadata={metadata}
                                    selectedCategory={selectedCategory}
                                    isCollapsed={isCollapsed}
                                    isReorderMode={isReorderMode}
                                    onSelectCategory={onSelectCategory}
                                    onEditCategory={onEditCategory}
                                    onDeleteCategory={onDeleteCategory}
                                    onActivateReorderMode={() => setIsReorderMode(true)}
                                />
                            ))}
                        </SortableContext>

                        {/* Rendering the active item while dragging */}
                        <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) }}>
                            {activeId ? (
                                <FolderItem
                                    folder={activeId}
                                    metadata={metadata}
                                    selectedCategory={selectedCategory}
                                    isCollapsed={isCollapsed}
                                    isOverlay
                                />
                            ) : null}
                        </DragOverlay>

                        {/* Inline creation input */}
                        {!isCollapsed && (
                            isCreatingFolder ? (
                                <form onSubmit={handleCreateFolder} className="px-1 py-1">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-base dark:text-gray-100 outline-none focus:ring-2 focus:ring-primary-500/20 transition-all"
                                        placeholder="New category..."
                                        autoFocus
                                        value={newFolderName}
                                        onChange={(e) => setNewFolderName(e.target.value)}
                                        onBlur={() => {
                                            if (!newFolderName.trim()) setIsCreatingFolder(false);
                                        }}
                                    />
                                </form>
                            ) : (
                                <button
                                    onClick={() => setIsCreatingFolder(true)}
                                    className="w-full flex items-center px-3 py-2.5 gap-3 text-sm font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800/50 rounded-lg transition-all border border-dashed border-gray-200 dark:border-gray-700/50 mt-1 mb-2 group lg:hidden"
                                >
                                    <Plus size={18} className="text-gray-300 group-hover:text-primary-500 transition-colors" />
                                    <span>Add Category...</span>
                                </button>
                            )
                        )}
                    </div>
                </DndContext>
            </div>

            {/* --- FOOTER / SETTINGS & SYNC --- */}
            <div className="pt-2 pb-[calc(8px+var(--safe-bottom,0vh))] px-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0 gap-1 box-content">
                <button
                    onClick={onOpenSettings}
                    className={clsx(
                        "flex items-center text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors",
                        isCollapsed ? "justify-center p-3" : "flex-1 px-3 py-2 gap-3 text-sm font-medium"
                    )}
                    title="Settings"
                >
                    <Settings size={isCollapsed ? 20 : 18} />
                    {!isCollapsed && <span>Settings</span>}
                </button>

                {!isCollapsed && onSync && (
                    <div className="shrink-0">
                        <SyncStatusBadge
                            syncStatus={syncStatus}
                            syncError={syncError}
                            lastSyncedAt={lastSyncedAt}
                            conflictFiles={conflictFiles}
                            onSync={onSync}
                            onOpenSettings={onOpenSettings}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

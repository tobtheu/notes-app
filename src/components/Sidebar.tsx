import { useRef, useState, useEffect } from 'react';
import {
    Folder, Book, Star, Code, Heart, Target, Briefcase, Music, Home, Layout,
    Coffee, Zap, Flag, Bell, Cloud, Camera, Smile, ShoppingCart,
    Plus, Settings, Trash2, PanelLeftClose, PanelLeftOpen, Pencil, GripVertical
} from 'lucide-react';
import clsx from 'clsx';
import type { AppMetadata } from '../types';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
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

const ICON_MAP: Record<string, any> = {
    Folder, Book, Star, Code, Heart, Target, Briefcase, Music, Home, Layout,
    Coffee, Zap, Flag, Bell, Cloud, Camera, Smile, ShoppingCart, Settings, Trash2
};

const COLOR_MAP: Record<string, any> = {
    red: { bg: 'bg-red-100', text: 'text-red-600', darkBg: 'dark:bg-red-900/30', darkText: 'dark:text-red-400' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-600', darkBg: 'dark:bg-orange-900/30', darkText: 'dark:text-orange-400' },
    amber: { bg: 'bg-amber-100', text: 'text-amber-600', darkBg: 'dark:bg-amber-900/30', darkText: 'dark:text-amber-400' },
    green: { bg: 'bg-emerald-100', text: 'text-emerald-600', darkBg: 'dark:bg-emerald-900/30', darkText: 'dark:text-emerald-400' },
    cyan: { bg: 'bg-cyan-100', text: 'text-cyan-600', darkBg: 'dark:bg-cyan-900/30', darkText: 'dark:text-cyan-400' },
    blue: { bg: 'bg-primary-100', text: 'text-primary-600', darkBg: 'dark:bg-primary-900/30', darkText: 'dark:text-primary-400' },
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
    onToggleCollapse: () => void;
    onOpenSettings?: () => void;
}

interface FolderItemProps {
    folder: string;
    metadata: AppMetadata;
    selectedCategory: string | null;
    isCollapsed: boolean;
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

const normalizeStr = (s: string) => s.normalize('NFC').toLowerCase();

const FolderItem = ({
    folder, metadata, selectedCategory, isCollapsed, onSelectCategory,
    onEditCategory, onDeleteCategory, isDragging, isOverlay,
    setNodeRef, attributes, listeners, style
}: FolderItemProps) => {
    // Case-insensitive + Unicode-normalized lookup for folder metadata
    const folderKey = Object.keys(metadata.folders).find(k => normalizeStr(k) === normalizeStr(folder)) || folder;
    const folderMeta = metadata.folders[folderKey] || {};
    const IconComponent = ICON_MAP[folderMeta.icon || 'Folder'] || Folder;
    const colorStyles = COLOR_MAP[folderMeta.color || 'gray'];
    const isSelected = selectedCategory === folder;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={clsx(
                "group relative flex items-center transition-all rounded-lg cursor-pointer mb-0.5 outline-none",
                isCollapsed ? "justify-center py-3" : "px-1 py-2.5 gap-2 text-sm font-medium",
                isSelected
                    ? "bg-white dark:bg-gray-700 shadow-sm text-gray-700 dark:text-gray-100"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700",
                isDragging && "opacity-40",
                isOverlay && "shadow-lg scale-105 opacity-90 cursor-grabbing bg-white dark:bg-gray-800"
            )}
            title={isCollapsed ? folder : undefined}
            onClick={() => onSelectCategory && !isCollapsed && onSelectCategory(folder)}
        >
            <div
                className={clsx("flex items-center gap-2 shrink-0 flex-1 min-w-0 pr-1", isCollapsed ? "justify-center pr-0" : "")}
            >
                {!isCollapsed && (
                    <div
                        {...attributes}
                        {...listeners}
                        className="text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity shrink-0 outline-none"
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
            {!isCollapsed && onEditCategory && onDeleteCategory && (
                <div className="absolute right-1.5 px-1 py-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-md shadow-sm border border-gray-100/50 dark:border-gray-700/50 z-20">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onEditCategory(folder);
                        }}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-primary-500 rounded transition-all outline-none"
                        title="Edit Category"
                    >
                        <Pencil size={12} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDeleteCategory(folder);
                        }}
                        className="p-1 hover:bg-red-50 dark:hover:bg-red-900/40 text-gray-500 hover:text-red-500 rounded transition-all outline-none"
                        title="Delete Category"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            )}
        </div>
    );
};

interface SortableFolderItemProps {
    id: string;
    folder: string;
    metadata: AppMetadata;
    selectedCategory: string | null;
    isCollapsed: boolean;
    onSelectCategory: (name: string | null) => void;
    onEditCategory: (name: string) => void;
    onDeleteCategory: (name: string) => void;
}

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
        />
    );
};

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
    onReorderFolders,
    onToggleCollapse,
    onOpenSettings
}: SidebarProps) {
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [activeId, setActiveId] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleCreateFolder = (e: React.FormEvent) => {
        e.preventDefault();
        if (newFolderName.trim() && onCreateFolder) {
            onCreateFolder(newFolderName.trim());
            setNewFolderName("");
            setIsCreatingFolder(false);
        }
    };

    useEffect(() => {
        if (isCreatingFolder && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isCreatingFolder]);

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
                "flex flex-col h-full bg-gray-50 dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 transition-all duration-300",
                isCollapsed ? "w-16" : "w-64",
                className
            )}
            onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
            }}
        >
            {/* Header */}
            <div className={clsx("p-4 flex items-center shrink-0", isCollapsed ? "justify-center" : "justify-between")}>
                {!isCollapsed && (
                    <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
                        <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center shadow-sm shrink-0">
                            <span className="text-white font-bold text-xs">NA</span>
                        </div>
                        <span className="font-bold text-gray-800 dark:text-gray-100">NotizApp</span>
                    </div>
                )}
                <button
                    onClick={onToggleCollapse}
                    className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                </button>
            </div>

            {/* Main Navigation (Fixed Header) */}
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

                {/* Categories / Folders Label */}
                {!isCollapsed && (
                    <div className="px-3 mb-2 flex items-center justify-between group">
                        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                            Categories
                        </span>
                        <button
                            onClick={() => setIsCreatingFolder(true)}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="New Folder"
                        >
                            <Plus size={14} />
                        </button>
                    </div>
                )}
            </div>

            {/* Folder List (Scrollable) */}
            <div className="flex-1 overflow-y-auto px-2 pb-4 custom-scrollbar overflow-x-hidden">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragCancel={() => setActiveId(null)}
                >
                    <div className="space-y-0.5 mb-4 px-1">
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
                                    onSelectCategory={onSelectCategory}
                                    onEditCategory={onEditCategory}
                                    onDeleteCategory={onDeleteCategory}
                                />
                            ))}
                        </SortableContext>

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

                        {!isCollapsed && isCreatingFolder && (
                            <form onSubmit={handleCreateFolder} className="px-3 py-2">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    className="w-full bg-white dark:bg-gray-800 border border-primary-500 outline-none rounded px-2 py-1 text-sm dark:text-gray-100"
                                    placeholder="New category..."
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    onBlur={() => {
                                        if (!newFolderName.trim()) setIsCreatingFolder(false);
                                    }}
                                />
                            </form>
                        )}
                    </div>
                </DndContext>
            </div>

            {/* Footer / Settings */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex flex-col items-center">
                <button
                    onClick={onOpenSettings}
                    className={clsx(
                        "flex items-center text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors",
                        isCollapsed ? "justify-center p-3" : "w-full px-3 py-2 gap-3 text-sm font-medium"
                    )}
                    title="Settings"
                >
                    <Settings size={isCollapsed ? 20 : 18} />
                    {!isCollapsed && <span>Settings</span>}
                </button>
            </div>
        </div>
    );
}

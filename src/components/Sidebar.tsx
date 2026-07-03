import { useEffect, useRef, useState } from 'react';
import {
    Folder, Plus, Settings, Settings2, Check, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import clsx from 'clsx';
import type { AppMetadata } from '../types';
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
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { FolderItem, SortableFolderItem } from './FolderItem';

interface SidebarProps {
    sidebarRef?: React.RefObject<HTMLDivElement | null>;
    className?: string;
    folders?: string[];
    metadata: AppMetadata;
    selectedCategory: string | null;
    isCollapsed: boolean;
    onToggleCollapse?: () => void;
    isIOS?: boolean;
    onCreateNote: () => void;
    onCreateFolder?: (name: string) => void;
    onDeleteCategory: (name: string) => void;
    onEditCategory: (name: string) => void;
    onSelectCategory: (name: string | null) => void;
    onReorderFolders?: (newOrder: string[]) => void;
    onOpenSettings?: () => void;
    monochromeIcons?: boolean;
}

/**
 * Sidebar Component
 * Primary navigation column. Contains the search/creation header and the scrollable folder list.
 */
export function Sidebar({
    sidebarRef,
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
    onToggleCollapse,
    isIOS = false,
    monochromeIcons = false,
}: SidebarProps) {
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isReorderMode, setIsReorderMode] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // On iOS, scroll the folder creation input into view when keyboard opens
    useEffect(() => {
        if (!isCreatingFolder || !isIOS) return;
        const el = inputRef.current;
        if (!el) return;

        const scrollIntoView = () => {
            try {
                el.scrollIntoView({ block: 'center', behavior: 'smooth' });
            } catch { }
        };

        const timers = [
            setTimeout(scrollIntoView, 350),
            setTimeout(scrollIntoView, 700),
        ];

        const vv = (window as any).visualViewport;
        const onResize = () => setTimeout(scrollIntoView, 50);
        vv?.addEventListener?.('resize', onResize);

        return () => {
            timers.forEach(clearTimeout);
            vv?.removeEventListener?.('resize', onResize);
        };
    }, [isCreatingFolder, isIOS]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
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
            ref={sidebarRef}
            className={clsx(
                "flex flex-col h-full border-r border-gray-100 dark:border-gray-800 shrink-0 overflow-x-hidden transition-all duration-300",
                isCollapsed ? "w-16" : "w-64",
                className
            )}
            style={{ backgroundColor: 'var(--sidebar-bg)' }}
        >
            {/* --- ACTIONS HEADER --- */}
            <div className="px-2 pb-2" style={isIOS ? { paddingTop: 'var(--safe-top, 16px)' } : { paddingTop: '1rem' }}>
                {/* iOS: collapse/expand toggle above new-note button */}
                {isIOS && onToggleCollapse && (
                    <div className={clsx("mb-4 px-1 lg:px-2", isCollapsed ? "flex justify-center" : "flex justify-end")}>
                        <button
                            type="button"
                            onClick={onToggleCollapse}
                            className="p-2 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 transition-all active:scale-95"
                            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                        >
                            {isCollapsed ? <PanelLeftOpen size={isIOS ? 24 : 20} /> : <PanelLeftClose size={isIOS ? 24 : 20} />}
                        </button>
                    </div>
                )}
                <div className={clsx("mb-4 px-1 lg:px-2", isCollapsed ? "flex flex-col items-center" : "block")}>
                    <button
                        onClick={onCreateNote}
                        className={clsx(
                            "flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white transition-all shadow-md shadow-primary-500/20 font-medium active:scale-[0.98]",
                            isCollapsed ? "w-10 h-10 rounded-full" : "w-full py-2.5 rounded-xl"
                        )}
                        title="New Note"
                    >
                        <Plus size={isIOS ? 22 : 18} />
                        {!isCollapsed && <span>New Note</span>}
                    </button>
                </div>

                {!isCollapsed && (
                    <div className="px-1 lg:px-2 mb-2 flex items-center justify-between group">
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Folders
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
                                    {/* Desktop: new folder button — always visible */}
                                    <button
                                        type="button"
                                        onClick={() => setIsCreatingFolder(true)}
                                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors hidden lg:block"
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
                    <div className="space-y-0 mb-2 px-1">
                        {/* Static "All Notes" folder */}
                        <button
                            onClick={() => onSelectCategory(null)}
                            className={clsx(
                                "w-full flex items-center transition-colors rounded-lg",
                                isCollapsed ? "justify-center py-1.5" : clsx("px-3 gap-3 text-sm font-medium", isIOS ? "py-2.5" : "py-2.5"),
                                !selectedCategory ? "bg-white dark:bg-gray-700 shadow-sm text-gray-700 dark:text-gray-100" : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                            )}
                            title="All Notes"
                        >
                            <Folder size={isCollapsed ? (isIOS ? 24 : 20) : (isIOS ? 22 : 18)} className={!selectedCategory ? "text-primary-500" : "text-gray-500 dark:text-gray-400"} />
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
                                    isIOS={isIOS}
                                    monochromeIcons={monochromeIcons}
                                    onSelectCategory={onSelectCategory}
                                    onEditCategory={onEditCategory}
                                    onDeleteCategory={onDeleteCategory}
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
                                    monochromeIcons={monochromeIcons}
                                    isOverlay
                                />
                            ) : null}
                        </DragOverlay>

                        {/* Inline creation input */}
                        {!isCollapsed && (
                            isCreatingFolder ? (
                                <form onSubmit={handleCreateFolder} className="px-1 py-1 flex flex-col gap-2">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-base dark:text-gray-100 outline-none focus:ring-2 focus:ring-primary-500/20 transition-all"
                                        placeholder="New folder..."
                                        autoFocus
                                        value={newFolderName}
                                        onChange={(e) => setNewFolderName(e.target.value)}
                                        onBlur={() => {
                                            if (!newFolderName.trim()) setIsCreatingFolder(false);
                                        }}
                                    />
                                    <div className="lg:hidden flex items-center justify-between gap-2">
                                        <span className="text-xs text-gray-400">or press Enter</span>
                                        <button
                                            type="submit"
                                            className="px-4 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg transition-colors"
                                        >
                                            Fertig
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <button
                                    onClick={() => setIsCreatingFolder(true)}
                                    className="w-full flex items-center px-3 py-2.5 gap-3 text-sm font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800/50 rounded-lg transition-all border border-dashed border-gray-200 dark:border-gray-700/50 mt-1 mb-2 group lg:hidden"
                                >
                                    <Plus size={isIOS ? 22 : 18} className="text-gray-300 group-hover:text-primary-500 transition-colors" />
                                    <span>Add Folder...</span>
                                </button>
                            )
                        )}
                    </div>
                </DndContext>
            </div>

            {/* --- FOOTER / SETTINGS --- */}
            <div className="pt-2 pb-[calc(8px+var(--safe-bottom,0vh))] px-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0 gap-1 box-content">
                <button
                    onClick={onOpenSettings}
                    className={clsx(
                        "flex items-center text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors",
                        isCollapsed ? "justify-center p-3" : "flex-1 px-3 py-2.5 gap-3 text-sm font-medium"
                    )}
                    title="Settings"
                >
                    <Settings size={isCollapsed ? (isIOS ? 24 : 20) : (isIOS ? 22 : 18)} />
                    {!isCollapsed && <span>Settings</span>}
                </button>
            </div>
        </div>
    );
}

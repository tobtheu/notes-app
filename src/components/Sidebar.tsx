import { useEffect, useRef, useState, useMemo } from 'react';
import {
    Folder, Plus, Settings2, Check, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import clsx from 'clsx';
import type { AppMetadata, Note, SyncStatus } from '../types';
import { normalizeStr } from '../utils/path';
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
import { SidebarFooter } from './SidebarFooter';

interface SidebarProps {
    sidebarRef?: React.RefObject<HTMLDivElement | null>;
    className?: string;
    folders?: string[];
    metadata: AppMetadata;
    selectedCategory: string | null;
    isCollapsed: boolean;
    onToggleCollapse?: () => void;
    isIOS?: boolean;
    allNotes?: Note[];
    onCreateNote?: () => void;
    onCreateFolder?: (name: string) => void;
    onDeleteCategory: (name: string) => void;
    onEditCategory: (name: string) => void;
    onSelectCategory: (name: string | null) => void;
    onReorderFolders?: (newOrder: string[]) => void;
    onOpenSettings?: () => void;
    monochromeIcons?: boolean;
    showIconsWhenCollapsed?: boolean;
    showNoteCounts?: boolean;
    userId?: string | null;
    userEmail?: string | null;
    syncStatus?: SyncStatus;
    hasPending?: boolean;
}

/**
 * Sidebar Component
 * Collapsible left navigation bar for folders and application settings.
 */
export function Sidebar({
    sidebarRef,
    className,
    folders = [],
    metadata,
    selectedCategory,
    isCollapsed,
    onToggleCollapse,
    isIOS = false,
    allNotes = [],
    onCreateFolder,
    onDeleteCategory,
    onEditCategory,
    onSelectCategory,
    onReorderFolders,
    onOpenSettings,
    monochromeIcons = false,
    showIconsWhenCollapsed = false,
    showNoteCounts = false,
    userId,
    userEmail,
    syncStatus,
    hasPending = false,
}: SidebarProps) {
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isReorderMode, setIsReorderMode] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Calculate note counts
    const totalNotesCount = allNotes ? allNotes.length : 0;
    const folderNoteCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        if (!allNotes) return counts;
        for (const folder of folders) {
            counts[folder] = allNotes.filter(n => normalizeStr(n.folder) === normalizeStr(folder)).length;
        }
        return counts;
    }, [allNotes, folders]);

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
        useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
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
        <aside
            ref={sidebarRef}
            className={clsx(
                "sidebar-fluid flex flex-col h-full shrink-0 overflow-hidden select-none transition-all duration-300",
                isCollapsed
                    ? (showIconsWhenCollapsed ? "w-14 min-w-[3.5rem]" : "w-0 min-w-0 opacity-0 pointer-events-none -mr-1.5 border-none p-0")
                    : "w-48 min-w-[12rem]",
                className
            )}
            style={{ backgroundColor: 'var(--shell-bg)' }}
        >
            {/* iOS: collapse/expand toggle */}
            {isIOS && onToggleCollapse && (
                <div className={clsx("px-2 pt-2", isCollapsed ? "flex justify-center" : "flex justify-end")}>
                    <button
                        type="button"
                        onClick={onToggleCollapse}
                        className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5 transition-all active:scale-95"
                        title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                    >
                        {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                    </button>
                </div>
            )}

            {/* Top Folders Navigation Area */}
            <div className="flex-1 overflow-y-auto px-1 py-1 custom-scrollbar overflow-x-hidden space-y-3">
                {/* Primary "All Notes" item */}
                <div className="space-y-0.5 text-xs">
                    <button
                        type="button"
                        onClick={() => onSelectCategory(null)}
                        className={clsx(
                            "folder-item-animated w-full flex items-center rounded-xl font-medium outline-none",
                            isCollapsed ? "justify-center p-2" : "gap-2 px-2.5 py-1.5",
                            !selectedCategory
                                ? "bg-[var(--card-active)] shadow-sm text-[var(--text-main)] font-semibold border border-[var(--border-subtle)]"
                                : "text-[var(--text-muted)] hover:bg-[var(--card-hover)] hover:text-[var(--text-main)] border border-transparent"
                        )}
                        title="All Notes"
                    >
                        <Folder size={isCollapsed ? 18 : 15} className="text-[var(--accent-color)] shrink-0" />
                        {!isCollapsed && (
                            <>
                                <span className="truncate">All Notes</span>
                                {showNoteCounts && (
                                    <span className="ml-auto text-[10px] font-mono text-[var(--text-muted)]">{totalNotesCount}</span>
                                )}
                            </>
                        )}
                    </button>
                </div>

                {/* Folders Section Container */}
                <div className="pt-2">
                    {/* Header (hidden when collapsed) */}
                    {!isCollapsed && (
                        <div className="flex items-center justify-between px-2 mb-1 text-[10px] font-semibold tracking-wider uppercase text-[var(--text-muted)]">
                            <span>FOLDERS</span>
                            <div className="flex items-center gap-0.5">
                                {isReorderMode ? (
                                    <button
                                        type="button"
                                        onClick={() => setIsReorderMode(false)}
                                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--accent-color)] text-white active:opacity-90"
                                    >
                                        <Check size={10} />
                                        <span>Done</span>
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setIsCreatingFolder(true)}
                                            className="smooth-transition text-[var(--text-muted)] hover:text-[var(--text-main)] p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 active:scale-95"
                                            title="New Folder"
                                        >
                                            <Plus size={13} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsReorderMode(true)}
                                            className="smooth-transition text-[var(--text-muted)] hover:text-[var(--text-main)] p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 lg:hidden"
                                            title="Reorder"
                                        >
                                            <Settings2 size={13} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Sortable user folders list — Always rendered in both expanded & icon-collapsed mode */}
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDragCancel={() => setActiveId(null)}
                    >
                        <nav className="space-y-0.5 text-xs font-medium">
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
                                        showNoteCounts={showNoteCounts}
                                        noteCount={folderNoteCounts[folder] || 0}
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
                                        monochromeIcons={monochromeIcons}
                                        showNoteCounts={showNoteCounts}
                                        noteCount={folderNoteCounts[activeId] || 0}
                                        isOverlay
                                    />
                                ) : null}
                            </DragOverlay>

                            {/* Inline creation input */}
                            {!isCollapsed && isCreatingFolder && (
                                <form onSubmit={handleCreateFolder} className="px-1 py-1 flex flex-col gap-1">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        className="w-full px-2.5 py-1.5 bg-[var(--canvas-bg)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-main)] outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                                        placeholder="Folder name..."
                                        autoFocus
                                        value={newFolderName}
                                        onChange={(e) => setNewFolderName(e.target.value)}
                                        onBlur={() => {
                                            if (!newFolderName.trim()) setIsCreatingFolder(false);
                                        }}
                                    />
                                </form>
                            )}
                        </nav>
                    </DndContext>
                </div>
            </div>

            {/* --- SIDEBAR BOTTOM SETTINGS / SYNC ROW --- */}
            <SidebarFooter
                userId={userId}
                userEmail={userEmail}
                syncStatus={syncStatus}
                hasPending={hasPending}
                isCollapsed={isCollapsed}
                onOpenSettings={onOpenSettings}
            />
        </aside>
    );
}

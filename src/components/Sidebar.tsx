import { useState, useMemo } from 'react';
import { Folder } from 'lucide-react';
import clsx from 'clsx';
import type { AppMetadata, Note, SyncStatus } from '../types';
import { normalizeStr } from '../utils/path';
import { DndContext, closestCenter, DragOverlay } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { FolderItem, SortableFolderItem } from './FolderItem';
import { SidebarFooter } from './SidebarFooter';
import { SidebarHeader } from './SidebarHeader';
import { useFolderDnd } from '../hooks/useFolderDnd';

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

    // Drag-and-drop mechanics
    const {
        activeId,
        isReorderMode,
        setIsReorderMode,
        sensors,
        handleDragStart,
        handleDragEnd,
        dropAnimation,
    } = useFolderDnd({ folders, onReorderFolders });

    return (
        <aside
            ref={sidebarRef}
            aria-label="Navigation"
            style={{
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none',
                userSelect: 'none',
            }}
            className={clsx(
                "h-full flex flex-col bg-[var(--sidebar-bg)] border-r border-[var(--border-subtle)] text-[var(--text-main)] overflow-hidden shrink-0 select-none",
                isCollapsed ? (showIconsWhenCollapsed ? "w-14" : "w-0 border-r-0") : "w-60",
                className
            )}
        >
            {/* Header Toolbar */}
            <SidebarHeader
                isCollapsed={isCollapsed}
                onToggleCollapse={onToggleCollapse}
                isIOS={isIOS}
                isCreatingFolder={isCreatingFolder}
                setIsCreatingFolder={setIsCreatingFolder}
                newFolderName={newFolderName}
                setNewFolderName={setNewFolderName}
                onCreateFolder={onCreateFolder}
                isReorderMode={isReorderMode}
                setIsReorderMode={setIsReorderMode}
                hasFolders={folders.length > 0}
            />

            {/* Folder list container */}
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5 custom-scrollbar min-h-0">
                {/* All Notes item */}
                <div
                    onClick={() => onSelectCategory(null)}
                    title={isCollapsed ? "All Notes" : undefined}
                    className={clsx(
                        "flex items-center rounded-xl cursor-pointer transition-colors outline-none border",
                        isCollapsed ? "justify-center py-2 px-1" : clsx("px-2.5 gap-2 text-xs font-medium", isIOS ? "py-2" : "py-1.5"),
                        selectedCategory === null
                            ? "bg-[var(--card-active)] border-[var(--border-subtle)] text-[var(--text-main)] font-semibold shadow-sm"
                            : "text-[var(--text-muted)] hover:bg-[var(--card-hover)] hover:text-[var(--text-main)] border-transparent"
                    )}
                >
                    <div className="flex items-center justify-center w-4 h-4 shrink-0">
                        <Folder size={isCollapsed ? (isIOS ? 20 : 16) : 14} className="text-[var(--accent-color)]" />
                    </div>
                    {!isCollapsed && (
                        <>
                            <span className="truncate flex-1">All Notes</span>
                            {showNoteCounts && (
                                <span className="ml-auto text-[10px] font-mono text-[var(--text-muted)] pr-0.5">
                                    {totalNotesCount}
                                </span>
                            )}
                        </>
                    )}
                </div>

                {/* Separator */}
                {folders.length > 0 && <div className="my-1.5 border-b border-[var(--border-subtle)]/50" />}

                {/* Sortable Folders */}
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext items={folders} strategy={verticalListSortingStrategy}>
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

                    <DragOverlay dropAnimation={dropAnimation}>
                        {activeId ? (
                            <FolderItem
                                folder={activeId}
                                metadata={metadata}
                                selectedCategory={selectedCategory}
                                isCollapsed={isCollapsed}
                                isOverlay
                                monochromeIcons={monochromeIcons}
                                showNoteCounts={showNoteCounts}
                                noteCount={folderNoteCounts[activeId] || 0}
                            />
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </div>

            {/* Footer with sync dot & settings */}
            <SidebarFooter
                isCollapsed={isCollapsed}
                userId={userId}
                userEmail={userEmail}
                syncStatus={syncStatus}
                hasPending={hasPending}
                onOpenSettings={onOpenSettings}
            />
        </aside>
    );
}

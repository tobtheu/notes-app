import { useState, useEffect } from 'react';
import type { SyncStatus } from '../types';
import { useViewport } from './useViewport';
import { useSidebarGestures } from './useSidebarGestures';
import { useGlobalShortcuts } from './useGlobalShortcuts';

interface UseAppWindowControlsProps {
    syncStatus: SyncStatus;
    activeView: 'sidebar' | 'notelist' | 'editor';
    onCreateNote: () => void;
}

export function useAppWindowControls({
    syncStatus,
    activeView,
    onCreateNote,
}: UseAppWindowControlsProps) {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => window.innerWidth < 768);
    const [isFocusMode, setIsFocusMode] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    useEffect(() => {
        if (syncStatus === 'unauthenticated') {
            setIsSettingsOpen(false);
        }
    }, [syncStatus]);

    // Viewport hook
    const {
        isMobile,
        isLandscape,
        isMaximized,
    } = useViewport(isSidebarCollapsed, setIsSidebarCollapsed);

    // Sidebar gestures
    const {
        containerRef,
        sidebarRef,
    } = useSidebarGestures({
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        activeView,
        isFocusMode,
    });

    // Global Keyboard Shortcuts
    useGlobalShortcuts({
        onCreateNote,
        onOpenSettings: () => setIsSettingsOpen(true),
        onToggleSidebar: () => setIsSidebarCollapsed(prev => !prev),
    });

    return {
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        isFocusMode,
        setIsFocusMode,
        isSettingsOpen,
        setIsSettingsOpen,
        isMobile,
        isLandscape,
        isMaximized,
        containerRef,
        sidebarRef,
    };
}

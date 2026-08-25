import { useEffect } from 'react';

interface UseGlobalShortcutsProps {
    onCreateNote: () => void;
    onOpenSettings: () => void;
    onToggleSidebar: () => void;
}

export function useGlobalShortcuts({
    onCreateNote,
    onOpenSettings,
    onToggleSidebar,
}: UseGlobalShortcutsProps) {
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

            const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
            const isNewNoteMac = isMac && e.metaKey && e.key.toLowerCase() === 'n';
            const isNewNoteWin = !isMac && e.ctrlKey && e.key.toLowerCase() === 'n';

            if (isNewNoteMac || isNewNoteWin) {
                e.preventDefault();
                onCreateNote();
                return;
            }

            // Settings shortcut (Cmd/Ctrl + ,)
            if ((e.metaKey || e.ctrlKey) && e.key === ',') {
                e.preventDefault();
                onOpenSettings();
                return;
            }

            // Sidebar Toggle shortcut (Cmd/Ctrl + B)
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b' && !isInput) {
                e.preventDefault();
                onToggleSidebar();
                return;
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [onCreateNote, onOpenSettings, onToggleSidebar]);
}

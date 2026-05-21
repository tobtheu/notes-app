import { useRef, useEffect } from 'react';

interface SidebarGesturesParams {
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  activeView: 'sidebar' | 'notelist' | 'editor';
  isFocusMode: boolean;
}

export function useSidebarGestures({
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  activeView,
  isFocusMode,
}: SidebarGesturesParams) {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const sidebarStartX = useRef(0);
  const sidebarCurrentX = useRef(0);
  const isSidebarDragging = useRef(false);

  const handleSidebarTouchStart = (e: React.TouchEvent) => {
    if (activeView === 'editor' || isFocusMode) return;
    const touch = e.touches[0];
    
    // If collapsed: drag starts anywhere within first 100px (covers the 64px collapsed sidebar + 36px edge of NoteList)
    if (isSidebarCollapsed) {
      if (touch.clientX < 100) {
        sidebarStartX.current = touch.clientX;
        sidebarCurrentX.current = touch.clientX;
        isSidebarDragging.current = true;
        if (sidebarRef.current) {
          sidebarRef.current.style.transition = 'none';
        }
      }
    } else {
      // If open (256px wide): start drag within the first 300px to fold it back
      if (touch.clientX < 300) {
        sidebarStartX.current = touch.clientX;
        sidebarCurrentX.current = touch.clientX;
        isSidebarDragging.current = true;
        if (sidebarRef.current) {
          sidebarRef.current.style.transition = 'none';
        }
      }
    }
  };

  const handleSidebarTouchMove = (e: React.TouchEvent) => {
    if (!isSidebarDragging.current || !sidebarRef.current) return;
    const touch = e.touches[0];
    sidebarCurrentX.current = touch.clientX;
    
    const deltaX = sidebarCurrentX.current - sidebarStartX.current;
    
    if (isSidebarCollapsed) {
      // Pulling open (dragging right)
      const newWidth = Math.min(256, Math.max(64, 64 + deltaX));
      sidebarRef.current.style.width = `${newWidth}px`;
    } else {
      // Pulling closed (dragging left)
      const newWidth = Math.min(256, Math.max(64, 256 + deltaX));
      sidebarRef.current.style.width = `${newWidth}px`;
    }
  };

  const handleSidebarTouchEnd = () => {
    if (!isSidebarDragging.current || !sidebarRef.current) return;
    isSidebarDragging.current = false;
    
    const deltaX = sidebarCurrentX.current - sidebarStartX.current;
    
    sidebarRef.current.style.transition = 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)';

    if (isSidebarCollapsed) {
      // Snapping logic for opening
      if (deltaX > 80) {
        setIsSidebarCollapsed(false);
        sidebarRef.current.style.width = '256px';
      } else {
        sidebarRef.current.style.width = '64px';
      }
    } else {
      // Snapping logic for closing
      if (deltaX < -80) {
        setIsSidebarCollapsed(true);
        sidebarRef.current.style.width = '64px';
      } else {
        sidebarRef.current.style.width = '256px';
      }
    }
  };

  // Reset touch overrides when isSidebarCollapsed state is updated
  useEffect(() => {
    if (sidebarRef.current) {
      sidebarRef.current.style.width = '';
      sidebarRef.current.style.transition = '';
    }
  }, [isSidebarCollapsed]);

  return {
    sidebarRef,
    handleSidebarTouchStart,
    handleSidebarTouchMove,
    handleSidebarTouchEnd,
  };
}

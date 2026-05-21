import { useRef, useEffect, useState, useCallback } from 'react';

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
  const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null);
  
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    setContainerElement(node);
  }, []);

  const sidebarRef = useRef<HTMLDivElement>(null);
  
  const sidebarStartX = useRef(0);
  const sidebarStartY = useRef(0);
  const sidebarCurrentX = useRef(0);
  const isSidebarDragging = useRef(false);
  const hasDecidedGesture = useRef(false);

  // Keep latest parameters in refs so listeners always access the correct values
  const isSidebarCollapsedRef = useRef(isSidebarCollapsed);
  const activeViewRef = useRef(activeView);
  const isFocusModeRef = useRef(isFocusMode);

  useEffect(() => {
    isSidebarCollapsedRef.current = isSidebarCollapsed;
    activeViewRef.current = activeView;
    isFocusModeRef.current = isFocusMode;
  }, [isSidebarCollapsed, activeView, isFocusMode]);

  useEffect(() => {
    if (!containerElement) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (activeViewRef.current === 'editor' || isFocusModeRef.current) return;
      
      const touch = e.touches[0];
      if (!touch) return;

      const clientX = touch.clientX;
      const clientY = touch.clientY;
      const isCollapsed = isSidebarCollapsedRef.current;
      
      // Collapsed: drag starts within first 100px (covers the 64px sidebar + 36px edge of NoteList)
      // Open: drag starts within first 300px to fold it back
      const isEligibleStart = isCollapsed ? clientX < 100 : clientX < 300;
      
      if (isEligibleStart) {
        sidebarStartX.current = clientX;
        sidebarStartY.current = clientY;
        sidebarCurrentX.current = clientX;
        isSidebarDragging.current = false;
        hasDecidedGesture.current = false;
        
        if (sidebarRef.current) {
          sidebarRef.current.style.transition = 'none';
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;

      const clientX = touch.clientX;
      const clientY = touch.clientY;
      const isCollapsed = isSidebarCollapsedRef.current;

      // Calculate movements to filter out vertical scroll from horizontal swipe
      if (!hasDecidedGesture.current) {
        const deltaX = Math.abs(clientX - sidebarStartX.current);
        const deltaY = Math.abs(clientY - sidebarStartY.current);

        if (deltaX > 8 || deltaY > 8) {
          hasDecidedGesture.current = true;
          if (deltaX > deltaY) {
            isSidebarDragging.current = true;
          } else {
            isSidebarDragging.current = false;
            if (sidebarRef.current) {
              sidebarRef.current.style.transition = '';
            }
          }
        }
      }

      if (!isSidebarDragging.current || !sidebarRef.current) return;

      // Actively dragging sidebar: prevent history back/forward & vertical scrolls
      if (e.cancelable) {
        e.preventDefault();
      }

      sidebarCurrentX.current = clientX;
      const deltaX = sidebarCurrentX.current - sidebarStartX.current;

      if (isCollapsed) {
        // Dragging right to open
        const newWidth = Math.min(256, Math.max(64, 64 + deltaX));
        sidebarRef.current.style.width = `${newWidth}px`;
      } else {
        // Dragging left to close
        const newWidth = Math.min(256, Math.max(64, 256 + deltaX));
        sidebarRef.current.style.width = `${newWidth}px`;
      }
    };

    const handleTouchEnd = () => {
      if (!isSidebarDragging.current || !sidebarRef.current) {
        isSidebarDragging.current = false;
        hasDecidedGesture.current = false;
        return;
      }
      
      isSidebarDragging.current = false;
      hasDecidedGesture.current = false;

      const deltaX = sidebarCurrentX.current - sidebarStartX.current;
      sidebarRef.current.style.transition = 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
      
      const isCollapsed = isSidebarCollapsedRef.current;

      if (isCollapsed) {
        if (deltaX > 80) {
          setIsSidebarCollapsed(false);
          sidebarRef.current.style.width = '256px';
        } else {
          sidebarRef.current.style.width = '64px';
        }
      } else {
        if (deltaX < -80) {
          setIsSidebarCollapsed(true);
          sidebarRef.current.style.width = '64px';
        } else {
          sidebarRef.current.style.width = '256px';
        }
      }
    };

    containerElement.addEventListener('touchstart', handleTouchStart, { passive: true });
    containerElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    containerElement.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      containerElement.removeEventListener('touchstart', handleTouchStart);
      containerElement.removeEventListener('touchmove', handleTouchMove);
      containerElement.removeEventListener('touchend', handleTouchEnd);
    };
  }, [containerElement]);

  // Reset touch width overrides when collapsed state is updated externally
  useEffect(() => {
    if (sidebarRef.current) {
      sidebarRef.current.style.width = '';
      sidebarRef.current.style.transition = '';
    }
  }, [isSidebarCollapsed]);

  return {
    containerRef,
    sidebarRef,
  };
}

import { useState, useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function useViewport(
  _isSidebarCollapsed?: boolean,
  setIsSidebarCollapsed?: (collapsed: boolean) => void
) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [isLandscape, setIsLandscape] = useState(() => window.innerWidth > window.innerHeight);
  const [isMaximized, setIsMaximized] = useState(false);
  const lastWidth = useRef(window.innerWidth);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const prev = lastWidth.current;

      // Auto-collapse/expand when crossing the desktop/tablet threshold (1024px)
      if (width < 1024 && prev >= 1024) {
        setIsSidebarCollapsed?.(true);
      } else if (width >= 1024 && prev < 1024) {
        setIsSidebarCollapsed?.(false);
      }

      setIsMobile(width < 768);
      setIsLandscape(window.innerWidth > window.innerHeight);
      lastWidth.current = width;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [setIsSidebarCollapsed]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      try {
        const appWindow = getCurrentWindow();
        appWindow.isMaximized().then(setIsMaximized).catch(() => {});
        appWindow.onResized(async () => {
          try {
            const max = await appWindow.isMaximized();
            setIsMaximized(max);
          } catch {}
        }).then(fn => {
          unlisten = fn;
        }).catch(() => {});
      } catch {}
    }

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  return {
    isMobile,
    isLandscape,
    isMaximized,
  };
}

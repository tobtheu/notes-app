import { useState, useEffect, useRef } from 'react';

export function useViewport(
  isSidebarCollapsed: boolean,
  setIsSidebarCollapsed: (collapsed: boolean) => void
) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [isLandscape, setIsLandscape] = useState(() => window.innerWidth > window.innerHeight);
  const lastWidth = useRef(window.innerWidth);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const prev = lastWidth.current;

      // Auto-collapse/expand when crossing the desktop/tablet threshold (1024px)
      if (width < 1024 && prev >= 1024) {
        setIsSidebarCollapsed(true);
      } else if (width >= 1024 && prev < 1024) {
        setIsSidebarCollapsed(false);
      }

      setIsMobile(width < 768);
      lastWidth.current = width;
    };

    const handleOrientationChange = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('resize', handleOrientationChange);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, [isSidebarCollapsed, setIsSidebarCollapsed]);

  return {
    isMobile,
    isLandscape,
  };
}

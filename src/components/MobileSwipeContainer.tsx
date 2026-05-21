import React, { useRef, useEffect, useState } from 'react';
import clsx from 'clsx';

interface MobileSwipeContainerProps {
    active: boolean;
    onBack: () => void;
    children: React.ReactNode;
    className?: string;
    isIOS?: boolean;
}

export function MobileSwipeContainer({ active, onBack, children, className, isIOS }: MobileSwipeContainerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const startX = useRef(0);
    const currentX = useRef(0);
    const isDragging = useRef(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Entry and exit transitions
    useEffect(() => {
        if (!isMobile || !containerRef.current) return;
        const el = containerRef.current;
        const bg = document.getElementById('app-background');

        if (active) {
            el.style.transition = 'none';
            el.style.transform = 'translate3d(100%, 0, 0)';
            el.style.visibility = 'visible';
            el.style.pointerEvents = 'auto';

            if (bg) {
                bg.style.transition = 'none';
                bg.style.transform = 'translate3d(-100px, 0, 0)';
            }

            // Force reflow to commit transition state
            el.offsetHeight;

            el.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
            el.style.transform = 'translate3d(0px, 0, 0)';

            if (bg) {
                bg.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
                bg.style.transform = 'translate3d(-100px, 0, 0)';
            }
        } else {
            el.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
            el.style.transform = 'translate3d(100%, 0, 0)';
            el.style.pointerEvents = 'none';

            if (bg) {
                bg.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
                bg.style.transform = 'translate3d(0px, 0, 0)';
            }

            const timer = setTimeout(() => {
                if (!active && containerRef.current) {
                    containerRef.current.style.visibility = 'hidden';
                }
                if (!active && bg) {
                    bg.style.transform = '';
                    bg.style.transition = '';
                }
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [active, isMobile]);

    if (!isMobile) {
        return <div className={className}>{children}</div>;
    }

    const handleTouchStart = (e: React.TouchEvent) => {
        if (!active) return;
        const touch = e.touches[0];
        // Initiate swipe ONLY from the left screen boundary (first 35px)
        if (touch.clientX < 35) {
            startX.current = touch.clientX;
            currentX.current = touch.clientX;
            isDragging.current = true;
            if (containerRef.current) {
                containerRef.current.style.transition = 'none';
            }
            const bg = document.getElementById('app-background');
            if (bg) {
                bg.style.transition = 'none';
            }
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging.current || !containerRef.current) return;
        const touch = e.touches[0];
        currentX.current = touch.clientX;
        const deltaX = Math.max(0, currentX.current - startX.current);
        
        // Follow the finger exactly with hardware-accelerated translate3d
        containerRef.current.style.transform = `translate3d(${deltaX}px, 0, 0)`;

        // Slide the background into view with a parallax translation (-100px to 0px)
        const bg = document.getElementById('app-background');
        if (bg) {
            const width = window.innerWidth;
            const bgDeltaX = -100 + (deltaX / width) * 100;
            bg.style.transform = `translate3d(${bgDeltaX}px, 0, 0)`;
        }
    };

    const handleTouchEnd = () => {
        if (!isDragging.current || !containerRef.current) return;
        isDragging.current = false;
        const deltaX = currentX.current - startX.current;
        const threshold = window.innerWidth * 0.3; // 30% of screen width
        const bg = document.getElementById('app-background');

        if (deltaX > threshold) {
            if (bg) {
                bg.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
                bg.style.transform = 'translate3d(0px, 0, 0)';
            }
            onBack();
        } else {
            if (bg) {
                bg.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
                bg.style.transform = 'translate3d(-100px, 0, 0)';
            }
            // Snap cleanly back to full screen
            containerRef.current.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
            containerRef.current.style.transform = 'translate3d(0px, 0, 0)';
        }
    };

    return (
        <div
            ref={containerRef}
            className={clsx(
                "fixed inset-0 z-40 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden",
                className
            )}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
                transform: 'translate3d(100%, 0, 0)',
                visibility: 'hidden',
                pointerEvents: 'none',
                WebkitOverflowScrolling: 'touch',
                paddingTop: isIOS ? 'calc(24px + var(--safe-top, 0vh))' : '40px'
            }}
        >
            {children}
        </div>
    );
}

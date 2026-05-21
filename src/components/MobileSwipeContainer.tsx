import React, { useRef, useEffect, useState } from 'react';
import clsx from 'clsx';

interface MobileSwipeContainerProps {
    active: boolean;
    onBack: () => void;
    children: React.ReactNode;
    className?: string;
}

export function MobileSwipeContainer({ active, onBack, children, className }: MobileSwipeContainerProps) {
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
        if (active) {
            el.style.transition = 'none';
            el.style.transform = 'translate3d(100%, 0, 0)';
            el.style.visibility = 'visible';
            el.style.pointerEvents = 'auto';
            // Force reflow to commit transition state
            el.offsetHeight;
            el.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
            el.style.transform = 'translate3d(0px, 0, 0)';
        } else {
            el.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
            el.style.transform = 'translate3d(100%, 0, 0)';
            el.style.pointerEvents = 'none';
            const timer = setTimeout(() => {
                if (!active && containerRef.current) {
                    containerRef.current.style.visibility = 'hidden';
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
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging.current || !containerRef.current) return;
        const touch = e.touches[0];
        currentX.current = touch.clientX;
        const deltaX = Math.max(0, currentX.current - startX.current);
        
        // Follow the finger exactly with hardware-accelerated translate3d
        containerRef.current.style.transform = `translate3d(${deltaX}px, 0, 0)`;
    };

    const handleTouchEnd = () => {
        if (!isDragging.current || !containerRef.current) return;
        isDragging.current = false;
        const deltaX = currentX.current - startX.current;
        const threshold = window.innerWidth * 0.3; // 30% of screen width

        if (deltaX > threshold) {
            // Invoke onBack immediately. This changes activeView to 'notelist' in App.tsx.
            // App.tsx re-renders, setting active to false on this container.
            // The useEffect on `active` handles the rest: it applies the 0.3s transition
            // to translate3d(100%, 0, 0), disables pointer-events, and schedules visibility: hidden.
            onBack();
        } else {
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
                WebkitOverflowScrolling: 'touch'
            }}
        >
            {children}
        </div>
    );
}

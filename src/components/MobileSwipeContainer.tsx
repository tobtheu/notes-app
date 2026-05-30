import React, { useRef, useEffect } from 'react';
import clsx from 'clsx';
import { TitleBar } from './TitleBar';

interface MobileSwipeContainerProps {
    active: boolean;
    onBack: () => void;
    children: React.ReactNode;
    className?: string;
    isIOS?: boolean;
    isMobile: boolean; // Add this prop!
}

export function MobileSwipeContainer({ active, onBack, children, className, isIOS, isMobile }: MobileSwipeContainerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const startX = useRef(0);
    const currentX = useRef(0);
    const isDragging = useRef(false);

    const pendingDeltaX = useRef<number | null>(null);
    const rafId = useRef<number | null>(null);
    const windowWidth = useRef(window.innerWidth);

    const activeRef = useRef(active);
    const onBackRef = useRef(onBack);

    useEffect(() => {
        activeRef.current = active;
        onBackRef.current = onBack;
    }, [active, onBack]);

    const updateTransforms = () => {
        if (pendingDeltaX.current === null) {
            rafId.current = null;
            return;
        }

        const deltaX = pendingDeltaX.current;
        pendingDeltaX.current = null;

        if (containerRef.current) {
            containerRef.current.style.transform = `translate3d(${deltaX}px, 0, 0)`;
        }

        const bg = document.getElementById('app-background');
        if (bg) {
            const width = windowWidth.current;
            const bgDeltaX = -100 + (deltaX / width) * 100;
            bg.style.transform = `translate3d(${bgDeltaX}px, 0, 0)`;
        }

        rafId.current = requestAnimationFrame(updateTransforms);
    };

    // Entry and exit transitions
    useEffect(() => {
        if (!isMobile || !containerRef.current) return;
        const el = containerRef.current;
        const bg = document.getElementById('app-background');

        if (active) {
            el.style.willChange = 'transform';
            if (bg) bg.style.willChange = 'transform';

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

            const timer = setTimeout(() => {
                el.style.willChange = '';
                if (bg) bg.style.willChange = '';
            }, 350);
            return () => clearTimeout(timer);
        } else {
            el.style.willChange = 'transform';
            if (bg) bg.style.willChange = 'transform';

            el.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
            el.style.transform = 'translate3d(100%, 0, 0)';
            el.style.pointerEvents = 'none';

            if (bg) {
                bg.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
                bg.style.transform = 'translate3d(0px, 0, 0)';
            }

            const timer = setTimeout(() => {
                if (!activeRef.current && containerRef.current) {
                    containerRef.current.style.visibility = 'hidden';
                }
                if (containerRef.current) {
                    containerRef.current.style.willChange = '';
                }
                if (bg) {
                    if (!activeRef.current) {
                        bg.style.transform = '';
                        bg.style.transition = '';
                    }
                    bg.style.willChange = '';
                }
            }, 350);
            return () => clearTimeout(timer);
        }
    }, [active, isMobile]);

    // Setup raw DOM touch listeners on the container element
    useEffect(() => {
        if (!isMobile) return;
        const el = containerRef.current;
        if (!el) return;

        const handleTouchStartRaw = (e: TouchEvent) => {
            if (!activeRef.current) return;
            const touch = e.touches[0];
            // Initiate swipe ONLY from the left screen boundary (first 35px)
            if (touch.clientX < 35) {
                windowWidth.current = window.innerWidth;
                startX.current = touch.clientX;
                currentX.current = touch.clientX;
                isDragging.current = true;
                pendingDeltaX.current = null;
                
                if (rafId.current !== null) {
                    cancelAnimationFrame(rafId.current);
                    rafId.current = null;
                }

                el.style.transition = 'none';
                el.style.willChange = 'transform';
                const bg = document.getElementById('app-background');
                if (bg) {
                    bg.style.transition = 'none';
                    bg.style.willChange = 'transform';
                }
            }
        };

        const handleTouchMoveRaw = (e: TouchEvent) => {
            if (!isDragging.current) return;
            // Lock vertical scrolling in the editor while dragging swipe-back
            if (e.cancelable) {
                e.preventDefault();
            }
            const touch = e.touches[0];
            currentX.current = touch.clientX;
            const deltaX = Math.max(0, currentX.current - startX.current);
            
            pendingDeltaX.current = deltaX;
            if (rafId.current === null) {
                rafId.current = requestAnimationFrame(updateTransforms);
            }
        };

        const handleTouchEndRaw = () => {
            if (!isDragging.current) return;
            isDragging.current = false;
            
            if (rafId.current !== null) {
                cancelAnimationFrame(rafId.current);
                rafId.current = null;
            }
            pendingDeltaX.current = null;

            const deltaX = currentX.current - startX.current;
            const threshold = windowWidth.current * 0.3; // 30% of screen width
            const bg = document.getElementById('app-background');

            if (deltaX > threshold) {
                if (bg) {
                    bg.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
                    bg.style.transform = 'translate3d(0px, 0, 0)';
                }
                onBackRef.current();
            } else {
                if (bg) {
                    bg.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
                    bg.style.transform = 'translate3d(-100px, 0, 0)';
                }
                el.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
                el.style.transform = 'translate3d(0px, 0, 0)';
            }

            // Clean up willChange shortly after snapping or state transition
            setTimeout(() => {
                if (containerRef.current) {
                    containerRef.current.style.willChange = '';
                }
                if (bg) {
                    bg.style.willChange = '';
                }
            }, 350);
        };

        el.addEventListener('touchstart', handleTouchStartRaw, { passive: true });
        el.addEventListener('touchmove', handleTouchMoveRaw, { capture: true, passive: false });
        el.addEventListener('touchend', handleTouchEndRaw, { passive: true });

        return () => {
            el.removeEventListener('touchstart', handleTouchStartRaw);
            el.removeEventListener('touchmove', handleTouchMoveRaw, { capture: true });
            el.removeEventListener('touchend', handleTouchEndRaw);
            if (rafId.current !== null) {
                cancelAnimationFrame(rafId.current);
            }
        };
    }, [isMobile]);

    if (!isMobile) {
        return <div className={className}>{children}</div>;
    }

    return (
        <div
            ref={containerRef}
            className={clsx(
                "fixed inset-0 z-40 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden",
                className
            )}
            style={{
                transform: 'translate3d(100%, 0, 0)',
                visibility: 'hidden',
                pointerEvents: 'none',
                WebkitOverflowScrolling: 'touch',
                paddingTop: isIOS ? 'calc(40px + var(--safe-top, 0vh))' : '40px'
            }}
        >
            <div className="absolute top-0 left-0 right-0 z-50 no-drag">
                <TitleBar
                    isSidebarCollapsed={true}
                    onToggleCollapse={() => {}}
                    activeView="editor"
                    onBack={onBack}
                />
            </div>
            {children}
        </div>
    );
}

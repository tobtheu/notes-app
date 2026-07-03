import { useState, useEffect, useRef } from 'react';

interface UseNoteSwipeProps {
    isSelected: boolean;
}

export function useNoteSwipe({ isSelected }: UseNoteSwipeProps) {
    const [swipeOffset, setSwipeOffset] = useState(0);
    const [isSnapping, setIsSnapping] = useState(false);
    const isDraggingRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);
    const touchStartX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);
    const isSwipedRef = useRef(false);

    const cardRef = useRef<HTMLDivElement>(null);
    const swipeOffsetRef = useRef(0);
    const rafIdRef = useRef<number | null>(null);

    const closeSwipe = () => {
        isSwipedRef.current = false;
        swipeOffsetRef.current = 0;
        if (cardRef.current) {
            cardRef.current.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
            cardRef.current.style.transform = 'translate3d(0px, 0px, 0px)';
        }
        setTimeout(() => {
            setSwipeOffset(0);
            if (cardRef.current) {
                cardRef.current.style.transition = '';
                cardRef.current.style.willChange = '';
            }
        }, 200);
    };

    // Sync React state updates back to mutable refs & clear manual styles if reset to 0
    useEffect(() => {
        swipeOffsetRef.current = swipeOffset;
        if (swipeOffset === 0 && cardRef.current) {
            cardRef.current.style.transform = '';
        }
    }, [swipeOffset]);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        isDraggingRef.current = false;
        setIsDragging(false);
        setIsSnapping(false);

        if (cardRef.current) {
            cardRef.current.style.transition = 'none';
            cardRef.current.style.willChange = 'transform';
        }

        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (touchStartX.current === null || touchStartY.current === null) return;

        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const diffX = currentX - touchStartX.current;
        const diffY = currentY - touchStartY.current;

        // If scrolling vertically, ignore swipe
        if (!isDraggingRef.current && Math.abs(diffY) > Math.abs(diffX)) return;

        if (Math.abs(diffX) > 5) {
            isDraggingRef.current = true;
            if (!isDragging) setIsDragging(true);
        }

        if (!isDraggingRef.current) return;

        let newOffset = 0;
        if (diffX < 0 && !isSwipedRef.current) {
            newOffset = Math.max(diffX, -192);
        } else if (diffX > 0 && isSwipedRef.current) {
            newOffset = Math.min(-192 + diffX, 0);
        } else {
            return;
        }

        swipeOffsetRef.current = newOffset;

        if (rafIdRef.current === null) {
            rafIdRef.current = requestAnimationFrame(() => {
                rafIdRef.current = null;
                if (cardRef.current) {
                    cardRef.current.style.transform = `translate3d(${swipeOffsetRef.current}px, 0px, 0px)`;
                }
            });
        }
    };

    const handleTouchEnd = () => {
        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }

        if (touchStartX.current !== null) {
            const finalOffset = swipeOffsetRef.current < -70 ? -192 : 0;
            isSwipedRef.current = finalOffset === -192;
            swipeOffsetRef.current = finalOffset;

            if (cardRef.current) {
                cardRef.current.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
                cardRef.current.style.transform = `translate3d(${finalOffset}px, 0px, 0px)`;
            }

            // Sync React state after animation finishes
            setTimeout(() => {
                setSwipeOffset(finalOffset);
                if (cardRef.current) {
                    cardRef.current.style.transition = '';
                    cardRef.current.style.willChange = '';
                }
            }, 200);
        }

        setTimeout(() => setIsDragging(false), 50);
        touchStartX.current = null;
        touchStartY.current = null;
    };

    // Auto-close swipe when another note is selected
    useEffect(() => {
        if (isSelected && isSwipedRef.current) {
            setSwipeOffset(0);
            isSwipedRef.current = false;
        }
    }, [isSelected]);

    return {
        swipeOffset,
        setSwipeOffset,
        isSnapping,
        isDragging,
        cardRef,
        isSwipedRef,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
        closeSwipe
    };
}

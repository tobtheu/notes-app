import React, { useRef, useState, useCallback, useEffect } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import clsx from 'clsx';
import { convertFileSrc } from '@tauri-apps/api/core';
import { MoveDiagonal2 } from 'lucide-react';

export const ResizableImageNode: React.FC<NodeViewProps> = (props) => {
    const { node, updateAttributes, selected, extension } = props;
    const { src, alt, width } = node.attrs;

    const [localAssetsDir, setLocalAssetsDir] = useState<string | null>(null);
    useEffect(() => {
        if (window.tauriAPI?.getLocalAssetsDir) {
            window.tauriAPI.getLocalAssetsDir().then(setLocalAssetsDir).catch(console.error);
        }
    }, []);

    let finalSrc = src;
    if (finalSrc && finalSrc.startsWith('.assets/')) {
        const workspacePath = extension.options.workspacePathRef?.current;
        if (workspacePath) {
            try {
                finalSrc = convertFileSrc(`${workspacePath}/${finalSrc}`);
            } catch (e) {
                console.warn("Could not convert image src to asset URL:", e);
            }
        }
    } else if (finalSrc && finalSrc.startsWith('local-asset://')) {
        try {
            const filename = finalSrc.replace('local-asset://', '');
            if (localAssetsDir) {
                finalSrc = convertFileSrc(`${localAssetsDir}/${filename}`);
            }
        } catch (e) {
            console.warn("Could not convert local image src to asset URL:", e);
        }
    }

    const imgRef = useRef<HTMLImageElement>(null);
    const [isResizing, setIsResizing] = useState(false);
    const [initialWidth, setInitialWidth] = useState(0);
    const [startX, setStartX] = useState(0);
    const [startY, setStartY] = useState(0);

    const onMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (imgRef.current) {
            setIsResizing(true);
            setInitialWidth(imgRef.current.offsetWidth);

            if ('touches' in e) {
                setStartX(e.touches[0].clientX);
                setStartY(e.touches[0].clientY);
            } else {
                setStartX(e.clientX);
                setStartY(e.clientY);
            }
        }
    }, []);

    const onMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
        if (!isResizing) return;

        let clientX = 0;
        let clientY = 0;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const deltaX = clientX - startX;
        const deltaY = clientY - startY;

        // Use the larger of the two deltas to give it a proportional diagonal "feel"
        const delta = Math.max(deltaX, deltaY);
        // Calculate new width (min 50px, max 100% implicitly handled by CSS max-width)
        const newWidth = Math.max(50, initialWidth + delta);

        if (imgRef.current) {
            // Update visually immediately for smooth feedback
            imgRef.current.style.width = `${newWidth}px`;
        }
    }, [isResizing, initialWidth, startX, startY]);

    const onMouseUp = useCallback(() => {
        if (!isResizing) return;
        setIsResizing(false);

        if (imgRef.current) {
            // Commit the change to the editor state
            updateAttributes({
                width: `${imgRef.current.offsetWidth}px`,
            });
        }
    }, [isResizing, updateAttributes]);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('touchmove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
            window.addEventListener('touchend', onMouseUp);
        } else {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('touchmove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('touchend', onMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('touchmove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('touchend', onMouseUp);
        };
    }, [isResizing, onMouseMove, onMouseUp]);

    return (
        <NodeViewWrapper className={clsx("resizable-image-wrapper relative flex justify-center w-full my-6 group", selected && "ring-2 ring-primary-500 rounded-sm")}>
            <figure className="relative m-0 inline-block max-w-full">
                <img
                    ref={imgRef}
                    src={finalSrc}
                    alt={alt}
                    style={{ width: width || 'auto' }}
                    className={clsx(
                        "block max-w-full rounded-md shadow-sm transition-shadow pointer-events-auto",
                        selected && "shadow-md"
                    )}
                    data-drag-handle
                />

                {alt && (
                    <figcaption className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
                        {alt}
                    </figcaption>
                )}

                {/* Resize Handle (only visible when image is selected) */}
                {selected && (
                    <div
                        className="absolute bottom-1 right-1 z-10 cursor-nwse-resize flex items-end justify-end text-primary-500 hover:text-primary-600 hover:scale-110 active:scale-95 transition-all drop-shadow-md rounded-full bg-white/80 dark:bg-gray-800/80 p-1 backdrop-blur-sm"
                        onMouseDown={onMouseDown}
                        onTouchStart={onMouseDown}
                        title="Drag to resize"
                    >
                        <MoveDiagonal2 size={24} strokeWidth={2.5} />
                    </div>
                )}
            </figure>
        </NodeViewWrapper>
    );
};

import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { type } from '@tauri-apps/plugin-os';
import { Minus, Square, X } from 'lucide-react';
import clsx from 'clsx';

const appWindow = getCurrentWindow();

export const TitleBar = () => {
    const [platform, setPlatform] = useState<string | null>(null);

    useEffect(() => {
        setPlatform(type());
    }, []);

    // On macOS we use "Overlay" style which provides native traffic lights on the left.
    // We only need to provide a draggable area.
    const isMac = platform === 'macos';

    const handleMouseDown = (e: React.MouseEvent) => {
        // Only trigger drag if clicking the bar itself or the title, not the buttons
        // In Tauri v2, we can call startDragging() to manually trigger the window move
        if (e.buttons === 1 && !(e.target as HTMLElement).closest('.no-drag')) {
            appWindow.startDragging();
        }
    };

    return (
        <div
            id="titlebar"
            onMouseDown={handleMouseDown}
            className="h-8 min-h-[32px] flex items-center justify-between bg-gray-50 dark:bg-gray-900 select-none relative z-[9999]"
        >
            {/* Platform specific padding space for Mac traffic lights visibility if needed */}
            <div className={clsx("flex items-center pointer-events-none", isMac ? "w-20" : "w-3")} />

            {/* Centered Title */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    NotizApp
                </span>
            </div>

            {!isMac && platform && (
                <div className="flex h-full items-stretch relative z-10 no-drag" onMouseDown={e => e.stopPropagation()}>
                    <button
                        onClick={() => appWindow.minimize()}
                        className="flex items-center justify-center w-10 hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors no-drag"
                    >
                        <Minus size={14} />
                    </button>
                    <button
                        onClick={() => appWindow.toggleMaximize()}
                        className="flex items-center justify-center w-10 hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors no-drag"
                    >
                        <Square size={12} />
                    </button>
                    <button
                        onClick={() => appWindow.close()}
                        className="flex items-center justify-center w-12 hover:bg-red-500 hover:text-white text-gray-500 dark:text-gray-400 transition-colors no-drag"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}
        </div>
    );
};

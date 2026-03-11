import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { type } from '@tauri-apps/plugin-os';
import { PanelLeftClose, PanelLeftOpen, ChevronLeft } from 'lucide-react';
import { Minus, Square, X } from 'lucide-react';
import clsx from 'clsx';

const appWindow = getCurrentWindow();

interface TitleBarProps {
    isSidebarCollapsed: boolean;
    onToggleCollapse: () => void;
    activeView?: 'sidebar' | 'notelist' | 'editor';
    onBack?: () => void;
}

export const TitleBar = ({ isSidebarCollapsed, onToggleCollapse, activeView, onBack }: TitleBarProps) => {
    const [platform, setPlatform] = useState<string | null>(null);

    useEffect(() => {
        setPlatform(type());
    }, []);

    // On macOS we use "Overlay" style which provides native traffic lights on the left.
    const isMac = platform === 'macos';

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.buttons === 1 && !(e.target as HTMLElement).closest('.no-drag')) {
            appWindow.startDragging();
        }
    };

    return (
        <div
            id="titlebar"
            onMouseDown={handleMouseDown}
            className="h-10 min-h-[40px] flex items-center justify-between bg-gray-50 dark:bg-gray-900 select-none relative z-[9999]"
        >
            {/* Sidebar / Back Button Area */}
            <div
                className={clsx(
                    "flex items-center h-full transition-all duration-300 relative px-3 shrink-0",
                    // Desktop width matching sidebar
                    isSidebarCollapsed ? "md:w-16" : "md:w-64",
                    "w-auto"
                )}
            >
                {/* Space for Mac Traffic Lights - ~80px */}
                {isMac && <div className="w-20 shrink-0" />}

                {/* Back Button (Mobile only, when in editor) */}
                {activeView === 'editor' && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onBack?.();
                        }}
                        className="md:hidden no-drag p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-md text-gray-500 hover:text-primary-500 transition-all flex items-center gap-1 active:scale-95"
                    >
                        <ChevronLeft size={20} />
                        <span className="text-sm font-semibold">Back</span>
                    </button>
                )}

                {/* The Toggle Button (Desktop/Tablet) */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleCollapse();
                    }}
                    className={clsx(
                        "no-drag p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-all active:scale-95",
                        // Hide on very small screens if we are in editor view (Back button takes over)
                        activeView === 'editor' ? "hidden md:flex" : "flex",
                        isMac && isSidebarCollapsed ? "absolute left-[84px]" : "ml-auto"
                    )}
                    title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                </button>
            </div>

            {/* Centered Title */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">
                    NotizApp
                </span>
            </div>

            {/* Window Controls (Windows/Linux) */}
            {!isMac && platform && (
                <div className="flex h-full items-stretch relative z-10 no-drag" onMouseDown={e => e.stopPropagation()}>
                    <button
                        onClick={() => appWindow.minimize()}
                        className="flex items-center justify-center w-11 hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors no-drag"
                    >
                        <Minus size={14} />
                    </button>
                    <button
                        onClick={async () => {
                            const isMax = await appWindow.isMaximized();
                            if (isMax) {
                                await appWindow.unmaximize();
                            } else {
                                await appWindow.maximize();
                            }
                        }}
                        className="flex items-center justify-center w-11 hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors no-drag"
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
            {/* Balance Spacer for Mac to keep title centered if no buttons on right */}
            {isMac && <div className="w-20" />}
        </div>
    );
};

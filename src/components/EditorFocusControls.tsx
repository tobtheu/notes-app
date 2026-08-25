import { Eye, EyeOff, X } from 'lucide-react';
import clsx from 'clsx';

interface EditorFocusControlsProps {
    toolbarVisible: boolean;
    setToolbarVisible: (visible: boolean) => void;
    onExitFocus: () => void;
    isExitingFocus: boolean;
}

export function EditorFocusControls({
    toolbarVisible,
    setToolbarVisible,
    onExitFocus,
    isExitingFocus,
}: EditorFocusControlsProps) {
    return (
        <div
            className={clsx(
                "fixed top-6 right-8 flex items-center gap-3 z-[10001] no-drag transition-opacity duration-300",
                isExitingFocus ? "opacity-0" : "opacity-100"
            )}
        >
            <button
                type="button"
                onClick={() => setToolbarVisible(!toolbarVisible)}
                className={clsx(
                    "p-2 rounded-full transition-all active:scale-90",
                    toolbarVisible
                        ? "text-primary-600 bg-primary-50 dark:bg-primary-900/40"
                        : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
                title={toolbarVisible ? "Hide Toolbar" : "Show Toolbar"}
            >
                {toolbarVisible ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
            <button
                type="button"
                onClick={onExitFocus}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all active:scale-90"
                title="Exit Focus Mode (Esc)"
            >
                <X size={24} />
            </button>
        </div>
    );
}

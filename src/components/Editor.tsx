import type { Note } from '../types';
import { MarkdownEditor } from './MarkdownEditor';
import clsx from 'clsx';
import { Eye, EyeOff, Loader2, X } from 'lucide-react';
import { EditorMenu } from './EditorMenu';
import { useNoteEditor } from '../hooks/useNoteEditor';

interface EditorProps {
    note: Note;
    allNotes?: Note[];
    onSave: (id: string, filename: string, content: string, folder?: string) => Promise<string | void>;
    onUpdateLocally?: (filename: string, content: string, folder?: string, updateTimestamp?: boolean) => void;
    onNavigate?: (id: string, anchor?: string) => void;
    markdownEnabled: boolean;
    toolbarVisible: boolean;
    setToolbarVisible: (visible: boolean) => void;
    spellcheckEnabled: boolean;
    workspacePath: string;
    isFocusMode: boolean;
    onToggleFocus: () => void;
    onSync?: () => void;
    isIOS?: boolean;
    iosLandscapeFullscreen?: boolean;
    className?: string;
}

import React from 'react';

/**
 * Editor Component
 * The main writing environment. Displays the note editor and action toolbar controls.
 */
export const Editor = React.memo(function Editor(props: EditorProps) {
    const {
        note,
        allNotes,
        workspacePath,
        isIOS = false,
        iosLandscapeFullscreen = false,
        className,
        isFocusMode,
        toolbarVisible,
        setToolbarVisible,
        onToggleFocus,
        spellcheckEnabled,
        markdownEnabled,
        onNavigate
    } = props;

    const {
        title,
        body,
        effectiveMarkdownEnabled,
        isLargeFile,
        titleRef,
        textareaRef,
        markdownEditorRef,
        plainTextContainerRef,
        handleTitleChange,
        handleBodyChange,
        handleTitleKeyDown,
        throttledSync,
        handleExport
    } = useNoteEditor(props);

    const [isExitingFocus, setIsExitingFocus] = React.useState(false);

    const handleExitFocus = React.useCallback(() => {
        if (isFocusMode && !isExitingFocus) {
            setIsExitingFocus(true);
            setTimeout(() => {
                setIsExitingFocus(false);
                onToggleFocus();
            }, 300);
        } else {
            onToggleFocus();
        }
    }, [isFocusMode, isExitingFocus, onToggleFocus]);

    // Handle Escape key to smoothly exit focus mode
    React.useEffect(() => {
        if (!isFocusMode) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                handleExitFocus();
            }
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [isFocusMode, handleExitFocus]);

    React.useEffect(() => {
        if (note) {
            const start = window.__noteOpenStartTime;
            if (start) {
                const duration = (performance.now() - start).toFixed(2);
                console.log(`⏱️ [Perf] Notiz "${note.filename}" geöffnet in ${duration}ms`);
                window.__noteOpenStartTime = null;
            }
        }
    }, [note?.filename]);

    const showFocusOverlay = isFocusMode || isExitingFocus;

    return (
        <div className={clsx(
            "h-full overflow-hidden flex flex-col transition-colors duration-500",
            showFocusOverlay
                ? clsx(
                    "fixed inset-0 z-[10001] border-none",
                    isExitingFocus ? "animate-focus-exit" : "animate-focus-enter"
                )
                : "relative flex-1",
            className
        )} style={{ backgroundColor: 'var(--canvas-bg)' }}>

            {/* Focus Mode Controls (Floating Top Right) */}
            {showFocusOverlay && (
                <div className={clsx(
                    "fixed top-6 right-8 flex items-center gap-3 z-[10001] no-drag transition-opacity duration-300",
                    isExitingFocus ? "opacity-0" : "opacity-100"
                )}>
                    <button
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
                        onClick={handleExitFocus}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all active:scale-90"
                        title="Exit Focus Mode (Esc)"
                    >
                        <X size={24} />
                    </button>
                </div>
            )}

            {/* 3-Dots Menu - Always sticky/fixed at top right of editor viewport */}
            {!showFocusOverlay && (
                <div className="absolute top-3 right-4 md:right-8 z-30 flex items-center gap-2">
                    <EditorMenu
                        isIOS={isIOS}
                        toolbarVisible={toolbarVisible}
                        setToolbarVisible={setToolbarVisible}
                        onToggleFocus={handleExitFocus}
                        onExport={handleExport}
                    />
                </div>
            )}

            {/* Loading Overlay for Lazy Content */}
            {note.content === undefined && (
                <div className="absolute inset-0 z-40 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
                        <span className="text-sm font-medium text-gray-400">Loading content...</span>
                    </div>
                </div>
            )}

            {/* Large-file notice */}
            {isLargeFile && markdownEnabled && (
                <div className="mx-8 mb-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs">
                    Large file — rich-text editor disabled for better performance.
                </div>
            )}

            {/* --- EDITOR CONTENT AREA --- */}
            {effectiveMarkdownEnabled ? (
                /* RICH TEXT MODE */
                <MarkdownEditor
                    content={body}
                    allNotes={allNotes}
                    workspacePath={workspacePath}
                    onChange={handleBodyChange}
                    onNavigate={onNavigate}
                    toolbarVisible={toolbarVisible}
                    spellcheckEnabled={spellcheckEnabled}
                    header={
                        <div className={clsx("w-full", isFocusMode ? "pt-8 mb-6" : "pt-4 pb-2")}>
                            <textarea
                                ref={titleRef}
                                className={clsx(
                                    "w-full p-0 font-extrabold bg-transparent border-none outline-none resize-none overflow-hidden text-[var(--text-main)] leading-tight placeholder-[var(--text-muted)]",
                                    isFocusMode ? "text-5xl font-black text-center" : "text-3xl pr-12"
                                )}
                                placeholder="Note Title"
                                value={title}
                                onChange={(e) => handleTitleChange(e.target.value)}
                                onKeyDown={handleTitleKeyDown}
                                onBlur={() => throttledSync()}
                                spellCheck={spellcheckEnabled}
                                rows={1}
                            />
                        </div>
                    }
                    isFocusMode={isFocusMode}
                    iosLandscapeFullscreen={iosLandscapeFullscreen}
                    ref={markdownEditorRef}
                    onArrowUpAtStart={() => titleRef.current?.focus()}
                    onBlur={() => throttledSync()}
                />
            ) : (
                /* PLAIN TEXT MODE - Standard Fallback */
                <div ref={plainTextContainerRef} className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-8 pb-8 overflow-y-auto custom-scrollbar">
                    <div className="pt-4 pb-2">
                        <textarea
                            ref={titleRef}
                            className="w-full p-0 text-3xl font-extrabold bg-transparent border-none outline-none resize-none overflow-hidden text-[var(--text-main)] leading-tight placeholder-[var(--text-muted)] pr-12"
                            placeholder="Note Title"
                            value={title}
                            onChange={(e) => handleTitleChange(e.target.value)}
                            onKeyDown={handleTitleKeyDown}
                            onBlur={() => throttledSync()}
                            spellCheck={spellcheckEnabled}
                            rows={1}
                        />
                    </div>
                    <textarea
                        ref={textareaRef}
                        className="w-full p-0 text-sm bg-transparent border-none outline-none resize-none text-[var(--text-main)] placeholder-[var(--text-muted)] leading-relaxed flex-1"
                        placeholder="Start typing your note here..."
                        value={body}
                        onChange={(e) => handleBodyChange(e.target.value)}
                        onBlur={() => throttledSync()}
                        spellCheck={spellcheckEnabled}
                    />
                </div>
            )}
        </div>
    );
});

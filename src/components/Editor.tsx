import React from 'react';
import type { Note } from '../types';
import { MarkdownEditor } from './MarkdownEditor';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import { EditorMenu } from './EditorMenu';
import { EditorFocusControls } from './EditorFocusControls';
import { EditorTitleInput } from './EditorTitleInput';
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
                <EditorFocusControls
                    toolbarVisible={toolbarVisible}
                    setToolbarVisible={setToolbarVisible}
                    onExitFocus={handleExitFocus}
                    isExitingFocus={isExitingFocus}
                />
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
                        <EditorTitleInput
                            title={title}
                            titleRef={titleRef}
                            isFocusMode={isFocusMode}
                            spellcheckEnabled={spellcheckEnabled}
                            onChange={handleTitleChange}
                            onKeyDown={handleTitleKeyDown}
                            onBlur={() => throttledSync()}
                        />
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
                    <EditorTitleInput
                        title={title}
                        titleRef={titleRef}
                        isFocusMode={false}
                        spellcheckEnabled={spellcheckEnabled}
                        onChange={handleTitleChange}
                        onKeyDown={handleTitleKeyDown}
                        onBlur={() => throttledSync()}
                    />
                    <textarea
                        ref={textareaRef as React.RefObject<HTMLTextAreaElement>}
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

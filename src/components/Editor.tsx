import type { Note } from '../types';
import { MarkdownEditor } from './MarkdownEditor';
import clsx from 'clsx';
import { Eye, EyeOff, Loader2, X } from 'lucide-react';
import { EditorMenu } from './EditorMenu';
import { useNoteEditor } from '../hooks/useNoteEditor';

interface EditorProps {
    note: Note;
    allNotes?: Note[];
    onSave: (id: string, filename: string, content: string, folder?: string, skipRename?: boolean) => Promise<string | void>;
    onUpdateLocally: (filename: string, content: string, folder?: string, updateTimestamp?: boolean) => void;
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
        handleTitleChange,
        handleBodyChange,
        handleTitleKeyDown,
        throttledSync,
        handleExport
    } = useNoteEditor(props);

    return (
        <div className={clsx(
            "h-full overflow-hidden flex flex-col md:border-l border-gray-100 dark:border-gray-800 transition-colors duration-300",
            isFocusMode ? "fixed inset-0 z-[10000] border-none animate-focus-enter" : "relative flex-1",
            className
        )} style={{ backgroundColor: 'var(--app-bg)' }}>

            {/* Focus Mode Controls (Floating Top Right) */}
            {isFocusMode && (
                <div className="fixed top-6 right-8 flex items-center gap-3 z-[10001] no-drag">
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
                        onClick={onToggleFocus}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all active:scale-90"
                        title="Exit Focus Mode (Esc)"
                    >
                        <X size={24} />
                    </button>
                </div>
            )}

            {/* On iOS: menu button lives in the TitleBar row (fixed top-right) */}
            {isIOS && !isFocusMode && (
                <div className="absolute top-2 right-4 z-20 flex items-center gap-2">
                    <EditorMenu
                        isIOS={isIOS}
                        toolbarVisible={toolbarVisible}
                        setToolbarVisible={setToolbarVisible}
                        onToggleFocus={onToggleFocus}
                        onExport={handleExport}
                    />
                </div>
            )}

            {/* Header with Title and Actions - Hidden in Focus Mode */}
            {!isFocusMode && (
                <div className="w-full pt-3">
                    <div className={clsx(
                        "flex items-start justify-between gap-4 max-w-4xl mx-auto px-4 md:px-8 w-full",
                    )}>
                        <textarea
                            ref={titleRef}
                            className="flex-1 p-0 text-3xl font-extrabold bg-transparent border-none outline-none resize-none overflow-hidden text-gray-700 dark:text-gray-100 leading-tight placeholder-gray-300 dark:placeholder-gray-700"
                            placeholder="Note Title"
                            value={title}
                            onChange={(e) => handleTitleChange(e.target.value)}
                            onKeyDown={handleTitleKeyDown}
                            onBlur={() => throttledSync()}
                            spellCheck={spellcheckEnabled}
                            rows={1}
                        />

                        {/* Desktop/non-iOS menu button */}
                        {!isIOS && (
                            <EditorMenu
                                isIOS={false}
                                toolbarVisible={toolbarVisible}
                                setToolbarVisible={setToolbarVisible}
                                onToggleFocus={onToggleFocus}
                                onExport={handleExport}
                            />
                        )}
                    </div>
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
                    header={isFocusMode ? (
                        <div className="max-w-3xl mx-auto px-8 w-full pt-8 mb-6">
                            <textarea
                                ref={titleRef}
                                className="w-full p-0 text-5xl font-black bg-transparent border-none outline-none resize-none overflow-hidden text-gray-800 dark:text-gray-100 leading-tight placeholder-gray-300 dark:placeholder-gray-700 text-center"
                                placeholder="Note Title"
                                value={title}
                                onChange={(e) => handleTitleChange(e.target.value)}
                                onKeyDown={handleTitleKeyDown}
                                onBlur={() => throttledSync()}
                                spellCheck={spellcheckEnabled}
                                rows={1}
                            />
                        </div>
                    ) : null}
                    isFocusMode={isFocusMode}
                    iosLandscapeFullscreen={iosLandscapeFullscreen}
                    ref={markdownEditorRef}
                    onArrowUpAtStart={() => titleRef.current?.focus()}
                    onBlur={() => throttledSync()}
                />
            ) : (
                /* PLAIN TEXT MODE - Standard Fallback */
                <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-8 pb-8">
                    <textarea
                        ref={textareaRef}
                        className="w-full p-0 text-sm bg-transparent border-none outline-none resize-none text-gray-800 dark:text-gray-300 leading-relaxed flex-1"
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

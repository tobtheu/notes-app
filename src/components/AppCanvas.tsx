import React from 'react';
import clsx from 'clsx';
import type { Note } from '../types';
import { NoteList } from './NoteList';
import { Editor } from './Editor';
import { EmptyStateTutorial } from './EmptyStateTutorial';

interface AppCanvasProps {
    notes: Note[];
    allNotes: Note[];
    selectedNote: Note | null;
    selectedCategory: string | null;
    folders: string[];
    searchTerm: string;
    onSearchChange: (value: string) => void;
    onSelectNote: (note: Note) => void;
    onDeleteNote: (id: string) => void;
    onMoveNote: (id: string, folder: string | null) => void;
    onTogglePin: (note: Note) => void;
    isNotePinned: (note: Note) => boolean;
    getNoteId: (note: Note) => string;
    onCreateNote: () => void;
    activeView: 'sidebar' | 'notelist' | 'editor';
    isIOS: boolean;
    isLandscape: boolean;
    landscapeFullscreen: boolean;
    isMobile: boolean;
    workspacePath: string;
    onSaveNote: (id: string, filename: string, content: string, folder?: string) => Promise<string>;
    onUpdateLocally: (filename: string, content: string, folder?: string) => void;
    markdownEnabled: boolean;
    toolbarVisible: boolean;
    setToolbarVisible: (visible: boolean) => void;
    spellcheckEnabled: boolean;
    isFocusMode: boolean;
    onToggleFocus: () => void;
    onSync: () => Promise<void>;
    onNavigate: (id: string, anchor?: string) => void;
}

export const AppCanvas: React.FC<AppCanvasProps> = ({
    notes,
    allNotes,
    selectedNote,
    selectedCategory,
    folders,
    searchTerm,
    onSearchChange,
    onSelectNote,
    onDeleteNote,
    onMoveNote,
    onTogglePin,
    isNotePinned,
    getNoteId,
    onCreateNote,
    activeView,
    isIOS,
    isLandscape,
    landscapeFullscreen,
    isMobile,
    workspacePath,
    onSaveNote,
    onUpdateLocally,
    markdownEnabled,
    toolbarVisible,
    setToolbarVisible,
    spellcheckEnabled,
    isFocusMode,
    onToggleFocus,
    onSync,
    onNavigate,
}) => {
    return (
        <section
            id="floating-canvas"
            className={clsx(
                "flex-1 bg-[var(--canvas-bg)] flex overflow-hidden relative transition-colors duration-500",
                !isMobile && "rounded-[18px] shadow-sm border border-[var(--border-subtle)]"
            )}
        >
            {/* NOTELIST — visible when not in sidebar-only or editor view */}
            <NoteList
                className={clsx(
                    "flex-1 min-w-0 md:flex-none md:w-80 md:shrink-0 transition-all duration-300 ease-in-out border-r border-[var(--border-subtle)]",
                    activeView === 'editor' ? (isIOS && isLandscape && !landscapeFullscreen ? "flex" : "flex") :
                        activeView === 'sidebar' ? "hidden md:flex" : "flex"
                )}
                notes={notes}
                selectedNote={activeView === 'editor' ? selectedNote : null}
                onSelectNote={onSelectNote}
                onDeleteNote={onDeleteNote}
                onMoveNote={onMoveNote}
                onTogglePin={onTogglePin}
                isNotePinned={isNotePinned}
                getNoteId={getNoteId}
                searchTerm={searchTerm}
                onSearchChange={onSearchChange}
                folders={folders}
                selectedCategory={selectedCategory}
                isIOS={isIOS}
                onCreateNote={onCreateNote}
            />

            {/* EDITOR — on desktop, it is rendered inline */}
            {selectedNote && !isMobile && (
                <Editor
                    className={clsx(
                        "flex-1",
                        activeView === 'editor' ? "flex" : "hidden md:flex"
                    )}
                    note={selectedNote}
                    allNotes={allNotes}
                    workspacePath={workspacePath}
                    onSave={onSaveNote}
                    onUpdateLocally={onUpdateLocally}
                    markdownEnabled={markdownEnabled}
                    toolbarVisible={toolbarVisible}
                    setToolbarVisible={setToolbarVisible}
                    spellcheckEnabled={spellcheckEnabled}
                    isFocusMode={isFocusMode}
                    onToggleFocus={onToggleFocus}
                    onSync={onSync}
                    onNavigate={onNavigate}
                    isIOS={isIOS}
                    iosLandscapeFullscreen={isIOS && isLandscape && landscapeFullscreen}
                />
            )}

            {!selectedNote && (
                <EmptyStateTutorial
                    onCreateNote={onCreateNote}
                    className={activeView === 'editor' ? "flex" : "hidden md:flex"}
                />
            )}
        </section>
    );
};

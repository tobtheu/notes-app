import { forwardRef } from 'react';
import type { Note } from '../types';
import clsx from 'clsx';
import { FileText, Hash, ChevronRight } from 'lucide-react';
import { useWikiLinkMenu } from '../hooks/useWikiLinkMenu';

interface WikiLinkMenuProps {
    items: Note[];
    command: (props: { id: string; anchor?: string; label: string }) => void;
    editor: any;
    range: any;
}

/**
 * WikiLinkMenu Component
 * A custom dropdown menu for wiki-style internal linking (`[[note name]]`).
 * Supports a two-step selection process: 
 * 1. Select a Note
 * 2. Select a Heading (Anchor) within that note (optional)
 */
export const WikiLinkMenu = forwardRef((props: WikiLinkMenuProps, ref) => {
    const {
        selectedIndex,
        step,
        setStep,
        selectedNote,
        setSelectedNote,
        containerRef,
        currentItems,
        handleMouseMove,
        selectNote,
        selectAnchor
    } = useWikiLinkMenu(props, ref);

    return (
        <div ref={containerRef} className="bg-white dark:bg-gray-800 shadow-2xl rounded-xl border border-gray-200 dark:border-gray-700 p-1.5 min-w-[280px] max-h-[350px] overflow-y-auto z-[1000] custom-scrollbar animate-in fade-in zoom-in duration-150">
            {/* Header / Context indicator */}
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-100 dark:border-gray-700/50 mb-1">
                <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest opacity-60">
                    {step === 'note' ? 'Select Note' : `Anchors in ${selectedNote?.filename.replace('.md', '')}`}
                </span>
                {step === 'anchor' && (
                    <button
                        onClick={() => {
                            setStep('note');
                            setSelectedNote(null);
                        }}
                        className="text-[10px] text-primary-500 hover:text-primary-600 font-bold uppercase tracking-widest"
                    >
                        Back
                    </button>
                )}
            </div>

            {/* Empty State */}
            {currentItems.length === 0 && (
                <div className="px-3 py-6 text-center text-gray-400 text-sm italic">
                    No {step === 'note' ? 'notes' : 'anchors'} found
                </div>
            )}

            {/* --- LIST RENDERING --- */}
            {step === 'note' ? (
                (currentItems as Note[]).map((note, index) => (
                    <button
                        key={note.filename}
                        onClick={() => selectNote(note)}
                        onMouseMove={(e) => handleMouseMove(e, index)}
                        className={clsx(
                            "w-full text-left px-3 py-2 text-sm rounded-lg flex items-center justify-between group transition-all",
                            index === selectedIndex
                                ? 'bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <div className={clsx(
                                "w-8 h-8 flex-shrink-0 rounded-md flex items-center justify-center font-bold transition-colors",
                                index === selectedIndex
                                    ? 'bg-primary-100 dark:bg-primary-800 text-primary-600 dark:text-primary-200'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                            )}>
                                <FileText size={16} />
                            </div>
                            <div className="flex flex-col">
                                <span className="font-semibold truncate max-w-[160px]">{note.filename.replace('.md', '')}</span>
                                {note.folder && <span className="text-[10px] opacity-60 truncate">{note.folder}</span>}
                            </div>
                        </div>
                        <ChevronRight size={14} className={clsx("opacity-0 group-hover:opacity-40", index === selectedIndex && "opacity-40")} />
                    </button>
                ))
            ) : (
                (currentItems as { id: string; text: string }[]).map((anchor, index) => (
                    <button
                        key={anchor.id}
                        onClick={() => selectAnchor(anchor)}
                        onMouseMove={(e) => handleMouseMove(e, index)}
                        className={clsx(
                            "w-full text-left px-3 py-2 text-sm rounded-lg flex items-center gap-3 transition-all",
                            index === selectedIndex
                                ? 'bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        )}
                    >
                        <div className={clsx(
                            "w-8 h-8 flex-shrink-0 rounded-md flex items-center justify-center font-bold transition-colors",
                            index === selectedIndex
                                ? 'bg-primary-100 dark:bg-primary-800 text-primary-600 dark:text-primary-200'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                        )}>
                            <Hash size={14} />
                        </div>
                        <span className="font-medium truncate">{anchor.text}</span>
                    </button>
                ))
            )}
        </div>
    );
});

WikiLinkMenu.displayName = 'WikiLinkMenu';

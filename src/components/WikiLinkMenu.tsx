import { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import type { Note } from '../types';
import clsx from 'clsx';
import { FileText, Hash, ChevronRight } from 'lucide-react';

interface WikiLinkMenuProps {
    items: Note[];
    command: (props: { id: string; anchor?: string; label: string }) => void;
    editor: any;
    range: any;
}

export const WikiLinkMenu = forwardRef((props: WikiLinkMenuProps, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [step, setStep] = useState<'note' | 'anchor'>('note');
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [anchors, setAnchors] = useState<{ id: string; text: string }[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    const extractAnchors = (content: string) => {
        const headings: { id: string; text: string }[] = [];
        // Simple regex to find markdown headings
        const lines = content.split('\n');
        lines.forEach(line => {
            const match = line.match(/^(#{1,6})\s+(.+)$/);
            if (match) {
                const text = match[2].trim();
                const id = text
                    .toLowerCase()
                    .replace(/[^a-z0-9äöüß ]/gi, '')
                    .trim()
                    .replace(/\s+/g, '-');
                headings.push({ id, text });
            }
        });
        return headings;
    };

    const selectNote = (note: Note) => {
        const foundAnchors = extractAnchors(note.content || '');
        if (foundAnchors.length > 0) {
            setSelectedNote(note);
            setAnchors(foundAnchors);
            setStep('anchor');
            setSelectedIndex(0);
        } else {
            // No anchors, just insert the note link
            props.command({
                id: note.filename.replace('.md', ''),
                label: note.filename.replace('.md', '')
            });
        }
    };

    const selectAnchor = (anchor: { id: string; text: string }) => {
        if (selectedNote) {
            props.command({
                id: selectedNote.filename.replace('.md', ''),
                anchor: anchor.id,
                label: `${selectedNote.filename.replace('.md', '')}#${anchor.text}`
            });
        }
    };

    const currentItems = step === 'note' ? props.items : anchors;

    useEffect(() => {
        setSelectedIndex(0);
    }, [props.items, step]);

    useEffect(() => {
        const selectedElement = containerRef.current?.children[selectedIndex + (step === 'note' ? 1 : 1)] as HTMLElement;
        if (selectedElement) {
            selectedElement.scrollIntoView({ block: 'nearest' });
        }
    }, [selectedIndex, step]);

    useImperativeHandle(ref, () => ({
        onKeyDown: ({ event }: { event: KeyboardEvent }) => {
            if (event.key === 'ArrowUp') {
                setSelectedIndex((selectedIndex + currentItems.length - 1) % currentItems.length);
                return true;
            }
            if (event.key === 'ArrowDown') {
                setSelectedIndex((selectedIndex + 1) % currentItems.length);
                return true;
            }
            if (event.key === 'Enter') {
                if (step === 'note') {
                    selectNote(currentItems[selectedIndex] as Note);
                } else {
                    selectAnchor(currentItems[selectedIndex] as { id: string; text: string });
                }
                return true;
            }
            if (event.key === 'Escape') {
                if (step === 'anchor') {
                    setStep('note');
                    setSelectedNote(null);
                    return true;
                }
            }
            return false;
        },
    }));

    return (
        <div ref={containerRef} className="bg-white dark:bg-gray-800 shadow-2xl rounded-xl border border-gray-200 dark:border-gray-700 p-1.5 min-w-[280px] max-h-[350px] overflow-y-auto z-[1000] custom-scrollbar animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-100 dark:border-gray-700/50 mb-1">
                <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest opacity-60">
                    {step === 'note' ? 'Select Note' : `Anchors in ${selectedNote?.filename.replace('.md', '')}`}
                </span>
                {step === 'anchor' && (
                    <button
                        onClick={() => setStep('note')}
                        className="text-[10px] text-primary-500 hover:text-primary-600 font-bold uppercase tracking-widest"
                    >
                        Back
                    </button>
                )}
            </div>

            {currentItems.length === 0 && (
                <div className="px-3 py-6 text-center text-gray-400 text-sm italic">
                    No {step === 'note' ? 'notes' : 'anchors'} found
                </div>
            )}

            {step === 'note' ? (
                (currentItems as Note[]).map((note, index) => (
                    <button
                        key={note.filename}
                        onClick={() => selectNote(note)}
                        onMouseEnter={() => setSelectedIndex(index)}
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
                        onMouseEnter={() => setSelectedIndex(index)}
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

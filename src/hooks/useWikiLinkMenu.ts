import { useState, useEffect, useRef, useImperativeHandle } from 'react';
import type { Note } from '../types';

interface UseWikiLinkMenuProps {
    items: Note[];
    command: (props: { id: string; anchor?: string; label: string }) => void;
    editor: any;
    range: any;
}

export function useWikiLinkMenu(props: UseWikiLinkMenuProps, ref: any) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [step, setStep] = useState<'note' | 'anchor'>('note');
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [anchors, setAnchors] = useState<{ id: string; text: string }[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);
    const lastMousePos = useRef({ x: 0, y: 0 });

    const handleMouseMove = (e: React.MouseEvent, index: number) => {
        if (e.clientX !== lastMousePos.current.x || e.clientY !== lastMousePos.current.y) {
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            if (selectedIndex !== index) {
                setSelectedIndex(index);
            }
        }
    };

    const extractAnchors = (content: string) => {
        const headings: { id: string; text: string }[] = [];
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

    // Reset cursor when results or step change
    useEffect(() => {
        setSelectedIndex(0);
    }, [props.items, step]);

    // Keep active element in view during keyboard navigation
    useEffect(() => {
        const selectedElement = containerRef.current?.children[selectedIndex + 1] as HTMLElement;
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

    return {
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
    };
}

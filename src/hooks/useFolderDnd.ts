import { useState } from 'react';
import {
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent, DropAnimation } from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';

interface UseFolderDndProps {
    folders: string[];
    onReorderFolders?: (newOrder: string[]) => void;
}

export function useFolderDnd({ folders, onReorderFolders }: UseFolderDndProps) {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isReorderMode, setIsReorderMode] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = folders.indexOf(active.id as string);
            const newIndex = folders.indexOf(over.id as string);
            if (oldIndex !== -1 && newIndex !== -1 && onReorderFolders) {
                const newOrder = arrayMove(folders, oldIndex, newIndex);
                onReorderFolders(newOrder);
            }
        }
        setActiveId(null);
    };

    const dropAnimation: DropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({
            styles: {
                active: {
                    opacity: '0.4',
                },
            },
        }),
    };

    return {
        activeId,
        isReorderMode,
        setIsReorderMode,
        sensors,
        handleDragStart,
        handleDragEnd,
        dropAnimation,
    };
}

import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import clsx from 'clsx';
import { useTranslation } from '../i18n';

interface SlashMenuProps {
    items: any[];
    command: (item: any) => void;
}

export const SlashMenu = forwardRef((props: SlashMenuProps, ref) => {
    const { t } = useTranslation();
    const [selectedIndex, setSelectedIndex] = useState(0);
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

    const selectItem = (index: number) => {
        const item = props.items[index];
        if (item) {
            props.command(item);
        }
    };

    useEffect(() => {
        const selectedElement = containerRef.current?.children[selectedIndex + 1] as HTMLElement;
        if (selectedElement) {
            selectedElement.scrollIntoView({ block: 'nearest' });
        }
    }, [selectedIndex]);

    useImperativeHandle(ref, () => ({
        onKeyDown: ({ event }: { event: KeyboardEvent }) => {
            if (event.key === 'ArrowUp') {
                setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
                return true;
            }
            if (event.key === 'ArrowDown') {
                setSelectedIndex((selectedIndex + 1) % props.items.length);
                return true;
            }
            if (event.key === 'Enter') {
                selectItem(selectedIndex);
                return true;
            }
            return false;
        },
    }));

    return (
        <div ref={containerRef} className="bg-white dark:bg-gray-800 shadow-2xl rounded-xl border border-gray-200 dark:border-gray-700 p-1.5 min-w-[220px] max-h-[300px] overflow-y-auto z-[1000] overflow-hidden custom-scrollbar">
            <div className="text-[10px] text-gray-400 p-2 font-black uppercase tracking-widest opacity-60">{t('editor.addBlock')}</div>
            {props.items.map((item: any, index: number) => (
                <button
                    key={index}
                    onClick={() => selectItem(index)}
                    onMouseMove={(e) => handleMouseMove(e, index)}
                    className={clsx(
                        "w-full text-left px-3 py-2 text-sm rounded-lg flex items-center gap-3 group transition-all",
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
                        <item.icon size={16} />
                    </div>
                    <span className="font-semibold">{item.title}</span>
                </button>
            ))}
        </div>
    );
});

SlashMenu.displayName = 'SlashMenu';


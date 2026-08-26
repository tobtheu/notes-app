import React, { useState, useEffect } from 'react';
import { Type } from 'lucide-react';
import type { FolderMetadata } from '../types';
import { FolderColorGrid, FOLDER_COLORS } from './FolderColorGrid';
import { FolderIconGrid, FOLDER_ICONS } from './FolderIconGrid';
import { useTranslation } from '../i18n';

interface FolderEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    folderName: string;
    metadata: FolderMetadata;
    onSave: (newName: string, metadata: FolderMetadata) => void;
}

export function FolderEditModal({ isOpen, onClose, folderName, metadata, onSave }: FolderEditModalProps) {
    const { t } = useTranslation();
    const [name, setName] = useState(folderName);
    const [selectedIcon, setSelectedIcon] = useState(metadata.icon || 'Folder');
    const [selectedColor, setSelectedColor] = useState(metadata.color || 'gray');

    useEffect(() => {
        if (isOpen) {
            setName(folderName);
            setSelectedIcon(metadata.icon || 'Folder');
            setSelectedColor(metadata.color || 'gray');
        }
    }, [isOpen, folderName]);

    const handleIconSelect = (iconId: string) => {
        setSelectedIcon(iconId);
        onSave(name, { icon: iconId, color: selectedColor });
    };

    const handleColorSelect = (colorId: string) => {
        setSelectedColor(colorId);
        onSave(name, { icon: selectedIcon, color: colorId });
    };

    const handleNameBlur = () => {
        if (name.trim() && name.trim() !== folderName) {
            onSave(name.trim(), { icon: selectedIcon, color: selectedColor });
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleNameBlur();
            (e.target as HTMLInputElement).blur();
        }
    };

    if (!isOpen) return null;

    const selectedColorData = FOLDER_COLORS.find(c => c.id === selectedColor) || FOLDER_COLORS[14];
    const SelectedIconComponent = (FOLDER_ICONS.find(i => i.id === selectedIcon) || FOLDER_ICONS[0]).icon;

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="rounded-3xl w-full max-w-md border border-[var(--border-subtle)] shadow-2xl overflow-hidden animate-modal-spring flex flex-col max-h-[85vh] text-xs select-none relative"
                onClick={e => e.stopPropagation()}
                style={{ backgroundColor: 'var(--canvas-bg)' }}
            >
                {/* Header with Compact Preview */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] shrink-0 bg-[var(--canvas-bg)]">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-black/5 dark:bg-white/5">
                            <SelectedIconComponent size={16} style={{ color: selectedColorData.hex }} />
                        </div>
                        <h2 className="text-sm font-bold text-[var(--text-main)]">{t('modals.editFolder')}</h2>
                    </div>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                    {/* Name Input */}
                    <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                            <Type size={12} /> {t('common.save') !== 'Save' ? 'Name' : 'Name'}
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onBlur={handleNameBlur}
                            onKeyDown={handleKeyDown}
                            className="smooth-transition w-full px-3 py-1.5 bg-[var(--card-hover)] border border-transparent focus:border-[var(--border-subtle)] rounded-xl outline-none text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:ring-1 focus:ring-[var(--accent-color)]/30"
                            placeholder={`${t('sidebar.newFolder')}...`}
                            autoFocus
                        />
                    </div>

                    {/* Compact Color Picker */}
                    <FolderColorGrid
                        selectedColor={selectedColor}
                        onSelectColor={handleColorSelect}
                    />

                    {/* Compact Icon Picker */}
                    <FolderIconGrid
                        selectedIcon={selectedIcon}
                        onSelectIcon={handleIconSelect}
                    />
                </div>

                {/* Sticky Footer Button */}
                <div className="px-5 py-3 border-t border-[var(--border-subtle)] flex justify-end gap-2 shrink-0 bg-[var(--canvas-bg)] sticky bottom-0 z-10">
                    <button
                        type="button"
                        onClick={onClose}
                        className="smooth-transition px-4 py-1.5 text-xs font-semibold text-white bg-[var(--accent-color)] hover:opacity-90 rounded-xl shadow-sm active:scale-95"
                    >
                        {t('common.done')}
                    </button>
                </div>
            </div>
        </div>
    );
}


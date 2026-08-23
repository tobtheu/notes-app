import React, { useState, useEffect } from 'react';
import {
    Folder, Book, Star, Code, Heart, Target, Briefcase, Music, Home, Layout,
    Type, Palette, Coffee, Zap, Flag, Bell, Cloud, Camera, Smile, ShoppingCart,
    Settings, Trash2,
    Pen, Globe, Lock, Archive, Bookmark, Lightbulb, Rocket, Award,
    FileText, Headphones, Gamepad2, Dumbbell, Plane, Utensils,
    Microscope, Film, TreePine, GraduationCap, Bike
} from 'lucide-react';
import clsx from 'clsx';
import type { FolderMetadata } from '../types';

interface FolderEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    folderName: string;
    metadata: FolderMetadata;
    onSave: (newName: string, metadata: FolderMetadata) => void;
}

const ICONS = [
    { id: 'Folder', icon: Folder },
    { id: 'Book', icon: Book },
    { id: 'Star', icon: Star },
    { id: 'Code', icon: Code },
    { id: 'Heart', icon: Heart },
    { id: 'Target', icon: Target },
    { id: 'Briefcase', icon: Briefcase },
    { id: 'Music', icon: Music },
    { id: 'Home', icon: Home },
    { id: 'Layout', icon: Layout },
    { id: 'Coffee', icon: Coffee },
    { id: 'Zap', icon: Zap },
    { id: 'Flag', icon: Flag },
    { id: 'Bell', icon: Bell },
    { id: 'Cloud', icon: Cloud },
    { id: 'Camera', icon: Camera },
    { id: 'Smile', icon: Smile },
    { id: 'ShoppingCart', icon: ShoppingCart },
    { id: 'Settings', icon: Settings },
    { id: 'Trash2', icon: Trash2 },
    { id: 'Pen', icon: Pen },
    { id: 'Globe', icon: Globe },
    { id: 'Lock', icon: Lock },
    { id: 'Archive', icon: Archive },
    { id: 'Bookmark', icon: Bookmark },
    { id: 'Lightbulb', icon: Lightbulb },
    { id: 'Rocket', icon: Rocket },
    { id: 'Award', icon: Award },
    { id: 'FileText', icon: FileText },
    { id: 'Headphones', icon: Headphones },
    { id: 'Gamepad2', icon: Gamepad2 },
    { id: 'Dumbbell', icon: Dumbbell },
    { id: 'Plane', icon: Plane },
    { id: 'Utensils', icon: Utensils },
    { id: 'Microscope', icon: Microscope },
    { id: 'Palette', icon: Palette },
    { id: 'Film', icon: Film },
    { id: 'TreePine', icon: TreePine },
    { id: 'GraduationCap', icon: GraduationCap },
    { id: 'Bike', icon: Bike },
] as const;

const COLORS = [
    { id: 'red', bg: 'bg-red-500', hex: '#EF4444' },
    { id: 'orange', bg: 'bg-orange-500', hex: '#F97316' },
    { id: 'amber', bg: 'bg-amber-500', hex: '#F59E0B' },
    { id: 'lime', bg: 'bg-lime-500', hex: '#84CC16' },
    { id: 'green', bg: 'bg-emerald-500', hex: '#10B981' },
    { id: 'teal', bg: 'bg-teal-500', hex: '#14B8A6' },
    { id: 'cyan', bg: 'bg-cyan-500', hex: '#06B6D4' },
    { id: 'sky', bg: 'bg-sky-500', hex: '#0EA5E9' },
    { id: 'blue', bg: 'bg-blue-500', hex: '#3B82F6' },
    { id: 'indigo', bg: 'bg-indigo-500', hex: '#6366F1' },
    { id: 'violet', bg: 'bg-violet-500', hex: '#8B5CF6' },
    { id: 'purple', bg: 'bg-purple-500', hex: '#A855F7' },
    { id: 'pink', bg: 'bg-pink-500', hex: '#EC4899' },
    { id: 'rose', bg: 'bg-rose-500', hex: '#F43F5E' },
    { id: 'gray', bg: 'bg-gray-400', hex: '#9CA3AF' },
];

export function FolderEditModal({ isOpen, onClose, folderName, metadata, onSave }: FolderEditModalProps) {
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

    const selectedColorData = COLORS.find(c => c.id === selectedColor) || COLORS[14];
    const SelectedIconComponent = (ICONS.find(i => i.id === selectedIcon) || ICONS[0]).icon;

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
                        <h2 className="text-sm font-bold text-[var(--text-main)]">Edit Folder</h2>
                    </div>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                    {/* Name Input */}
                    <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                            <Type size={12} /> Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onBlur={handleNameBlur}
                            onKeyDown={handleKeyDown}
                            className="smooth-transition w-full px-3 py-1.5 bg-[var(--card-hover)] border border-transparent focus:border-[var(--border-subtle)] rounded-xl outline-none text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:ring-1 focus:ring-[var(--accent-color)]/30"
                            placeholder="Folder name..."
                            autoFocus
                        />
                    </div>

                    {/* Compact Color Picker */}
                    <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                            <Palette size={12} /> Color
                        </label>
                        <div className="grid grid-cols-8 gap-1.5">
                            {COLORS.map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => handleColorSelect(c.id)}
                                    className={clsx(
                                        "w-6 h-6 rounded-full transition-all flex items-center justify-center relative",
                                        c.bg,
                                        selectedColor === c.id
                                            ? "ring-2 ring-[var(--accent-color)] scale-110 shadow-sm"
                                            : "opacity-80 hover:opacity-100 hover:scale-105"
                                    )}
                                    title={c.id}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Compact Icon Picker */}
                    <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                            <Folder size={12} /> Icon
                        </label>
                        <div className="grid grid-cols-8 gap-1.5 p-1 bg-black/5 dark:bg-white/5 rounded-2xl">
                            {ICONS.map(({ id, icon: IconComponent }) => (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => handleIconSelect(id)}
                                    className={clsx(
                                        "w-7 h-7 rounded-xl flex items-center justify-center transition-all",
                                        selectedIcon === id
                                            ? "bg-[var(--canvas-bg)] text-[var(--accent-color)] shadow-sm font-semibold border border-[var(--border-subtle)] scale-105"
                                            : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10"
                                    )}
                                >
                                    <IconComponent size={14} />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Sticky Footer Button */}
                <div className="px-5 py-3 border-t border-[var(--border-subtle)] flex justify-end gap-2 shrink-0 bg-[var(--canvas-bg)] sticky bottom-0 z-10">
                    <button
                        type="button"
                        onClick={onClose}
                        className="smooth-transition px-4 py-1.5 text-xs font-semibold text-white bg-[var(--accent-color)] hover:opacity-90 rounded-xl shadow-sm active:scale-95"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}

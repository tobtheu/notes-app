import React, { useState, useEffect } from 'react';
import {
    X, Folder, Book, Star, Code, Heart, Target, Briefcase, Music, Home, Layout,
    Type, Palette, Coffee, Zap, Flag, Bell, Cloud, Camera, Smile, ShoppingCart,
    Settings, Trash2
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
] as const;

const COLORS = [
    { id: 'red', bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200', darkBg: 'dark:bg-red-900/30', darkText: 'dark:text-red-400' },
    { id: 'orange', bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200', darkBg: 'dark:bg-orange-900/30', darkText: 'dark:text-orange-400' },
    { id: 'amber', bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-200', darkBg: 'dark:bg-amber-900/30', darkText: 'dark:text-amber-400' },
    { id: 'green', bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-200', darkBg: 'dark:bg-emerald-900/30', darkText: 'dark:text-emerald-400' },
    { id: 'cyan', bg: 'bg-cyan-100', text: 'text-cyan-600', border: 'border-cyan-200', darkBg: 'dark:bg-cyan-900/30', darkText: 'dark:text-cyan-400' },
    { id: 'blue', bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200', darkBg: 'dark:bg-blue-900/30', darkText: 'dark:text-blue-400' },
    { id: 'indigo', bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200', darkBg: 'dark:bg-indigo-900/30', darkText: 'dark:text-indigo-400' },
    { id: 'purple', bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200', darkBg: 'dark:bg-purple-900/30', darkText: 'dark:text-purple-400' },
    { id: 'pink', bg: 'bg-pink-100', text: 'text-pink-600', border: 'border-pink-200', darkBg: 'dark:bg-pink-900/30', darkText: 'dark:text-pink-400' },
    { id: 'gray', bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', darkBg: 'dark:bg-gray-800', darkText: 'dark:text-gray-400' },
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
    }, [isOpen, folderName, metadata]);

    if (!isOpen) return null;

    const selectedColorData = COLORS.find(c => c.id === selectedColor) || COLORS[9];
    const SelectedIconComponent = (ICONS.find(i => i.id === selectedIcon) || ICONS[0]).icon;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onSave(name.trim(), {
                icon: selectedIcon,
                color: selectedColor
            });
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-3">
                        <div className={clsx("p-2 rounded-lg transition-colors duration-300", selectedColorData.bg, selectedColorData.darkBg)}>
                            <SelectedIconComponent size={24} className={clsx("transition-colors duration-300", selectedColorData.text, selectedColorData.darkText)} />
                        </div>
                        <h2 className="text-xl font-bold dark:text-gray-100">Edit Category</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Name Input */}
                    <div className="space-y-3">
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-400">
                            <Type size={16} /> Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-primary-500 rounded-xl outline-none transition-all dark:text-gray-100"
                            placeholder="Category name..."
                            autoFocus
                        />
                    </div>

                    {/* Color Picker */}
                    <div className="space-y-3">
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-400">
                            <Palette size={16} /> Accent Color
                        </label>
                        <div className="grid grid-cols-5 gap-3">
                            {COLORS.map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setSelectedColor(c.id)}
                                    className={clsx(
                                        "w-full aspect-square rounded-full transition-all border-4 flex items-center justify-center",
                                        c.bg, c.darkBg,
                                        selectedColor === c.id
                                            ? "border-primary-500 shadow-md scale-110"
                                            : "border-white dark:border-gray-900"
                                    )}
                                    title={c.id}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Icon Picker */}
                    <div className="space-y-3">
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-400">
                            <Folder size={16} /> Icon
                        </label>
                        <div className="grid grid-cols-5 gap-3 h-48 overflow-y-auto px-1 custom-scrollbar">
                            {ICONS.map(({ id, icon: IconComponent }) => (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => setSelectedIcon(id)}
                                    className={clsx(
                                        "p-3 rounded-xl flex items-center justify-center transition-all border-2",
                                        selectedIcon === id
                                            ? "bg-primary-50 dark:bg-primary-900/30 border-primary-500"
                                            : "bg-gray-50 dark:bg-gray-800 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700"
                                    )}
                                >
                                    <IconComponent
                                        size={24}
                                        className={clsx("transition-colors duration-300", selectedIcon === id ? selectedColorData.text + " " + selectedColorData.darkText : "text-gray-500")}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-3 px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-primary-500/20 active:scale-95"
                        >
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

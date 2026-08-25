import {
    Folder, Book, Star, Code, Heart, Target, Briefcase, Music, Home, Layout,
    Palette, Coffee, Zap, Flag, Bell, Cloud, Camera, Smile, ShoppingCart,
    Settings, Trash2, Pen, Globe, Lock, Archive, Bookmark, Lightbulb, Rocket, Award,
    FileText, Headphones, Gamepad2, Dumbbell, Plane, Utensils,
    Microscope, Film, TreePine, GraduationCap, Bike
} from 'lucide-react';
import clsx from 'clsx';

export const FOLDER_ICONS = [
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

interface FolderIconGridProps {
    selectedIcon: string;
    onSelectIcon: (iconId: string) => void;
}

export function FolderIconGrid({
    selectedIcon,
    onSelectIcon,
}: FolderIconGridProps) {
    return (
        <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                <Folder size={12} /> Icon
            </label>
            <div className="grid grid-cols-8 gap-1.5 p-1 bg-black/5 dark:bg-white/5 rounded-2xl">
                {FOLDER_ICONS.map(({ id, icon: IconComponent }) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => onSelectIcon(id)}
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
    );
}

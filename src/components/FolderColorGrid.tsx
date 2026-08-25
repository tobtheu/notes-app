import { Palette } from 'lucide-react';
import clsx from 'clsx';

export const FOLDER_COLORS = [
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

interface FolderColorGridProps {
    selectedColor: string;
    onSelectColor: (colorId: string) => void;
}

export function FolderColorGrid({
    selectedColor,
    onSelectColor,
}: FolderColorGridProps) {
    return (
        <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                <Palette size={12} /> Color
            </label>
            <div className="grid grid-cols-8 gap-1.5">
                {FOLDER_COLORS.map((c) => (
                    <button
                        key={c.id}
                        type="button"
                        onClick={() => onSelectColor(c.id)}
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
    );
}

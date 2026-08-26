import clsx from 'clsx';

export interface SegmentOption<T extends string> {
    value: T;
    label: string;
}

interface SlidingSegmentedControlProps<T extends string> {
    options: SegmentOption<T>[];
    value: T;
    onChange: (value: T) => void;
    className?: string;
}

export function SlidingSegmentedControl<T extends string>({
    options,
    value,
    onChange,
    className,
}: SlidingSegmentedControlProps<T>) {
    const selectedIndex = Math.max(0, options.findIndex(opt => opt.value === value));
    const count = options.length;

    return (
        <div
            className={clsx(
                "relative flex items-center p-1 bg-[var(--card-hover)] rounded-xl border border-[var(--border-subtle)] select-none",
                className
            )}
        >
            {/* Sliding Active Pill Background */}
            <div
                className="absolute top-1 bottom-1 rounded-lg bg-[var(--canvas-bg)] shadow-sm border border-[var(--border-subtle)]/70 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none"
                style={{
                    width: `calc((100% - 8px) / ${count})`,
                    left: '4px',
                    transform: `translateX(${selectedIndex * 100}%)`,
                }}
            />

            {/* Option Buttons */}
            {options.map((opt) => {
                const isActive = opt.value === value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange(opt.value)}
                        className={clsx(
                            "relative z-10 flex-1 py-1.5 px-2.5 rounded-lg text-xs text-center truncate transition-colors duration-200 focus:outline-none active:scale-[0.98]",
                            isActive
                                ? "font-semibold text-[var(--text-main)]"
                                : "font-medium text-[var(--text-muted)] hover:text-[var(--text-main)]"
                        )}
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}

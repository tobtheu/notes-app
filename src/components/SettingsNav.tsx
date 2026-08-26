import React from 'react';
import { Palette, Edit3, Cloud, HardDrive, Info, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { FEATURES } from '../config/features';
import { useTranslation, type TranslationKey } from '../i18n';

export type TabKey = 'appearance' | 'editor' | 'sync' | 'storage' | 'trash' | 'about';

interface SettingsNavProps {
    activeTab: TabKey;
    onSelectTab: (tab: TabKey) => void;
}

const ALL_NAV_ITEMS: Array<{ key: TabKey; labelKey: TranslationKey; icon: React.FC<{ size?: number }>; requireSync?: boolean }> = [
    { key: 'appearance', labelKey: 'settings.tabs.appearance', icon: Palette },
    { key: 'editor', labelKey: 'settings.tabs.editor', icon: Edit3 },
    { key: 'sync', labelKey: 'settings.tabs.sync', icon: Cloud, requireSync: true },
    { key: 'storage', labelKey: 'settings.tabs.storage', icon: HardDrive },
    { key: 'trash', labelKey: 'settings.tabs.trash', icon: Trash2 },
    { key: 'about', labelKey: 'settings.tabs.about', icon: Info },
];

export const SettingsNav: React.FC<SettingsNavProps> = ({
    activeTab,
    onSelectTab,
}) => {
    const { t } = useTranslation();
    const navItems = ALL_NAV_ITEMS.filter(item => !item.requireSync || FEATURES.SYNC);

    return (
        <aside className="w-40 sm:w-44 bg-[var(--shell-bg)] border-r border-[var(--border-subtle)] p-3 flex flex-col justify-between select-none shrink-0 overflow-x-hidden">
            <div className="space-y-4">
                <div className="px-2 pt-1">
                    <h3 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">{t('settings.title')}</h3>
                </div>
                <nav className="space-y-1 text-xs font-medium">
                    {navItems.map(({ key, labelKey, icon: Icon }) => {
                        const isActive = activeTab === key;
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => onSelectTab(key)}
                                className={clsx(
                                    "smooth-transition w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-left",
                                    isActive
                                        ? "bg-[var(--canvas-bg)] text-[var(--accent-color)] font-semibold shadow-sm border border-[var(--border-subtle)]"
                                        : "text-[var(--text-muted)] hover:bg-[var(--card-hover)] hover:text-[var(--text-main)]"
                                )}
                            >
                                <Icon size={16} />
                                <span>{t(labelKey)}</span>
                            </button>
                        );
                    })}
                </nav>
            </div>
        </aside>
    );
};


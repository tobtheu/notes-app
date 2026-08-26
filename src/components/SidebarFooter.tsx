import React from 'react';
import { Settings } from 'lucide-react';
import clsx from 'clsx';
import type { SyncStatus } from '../types';
import { useTranslation } from '../i18n';

interface SidebarFooterProps {
    userId?: string | null;
    userEmail?: string | null;
    syncStatus?: SyncStatus;
    hasPending?: boolean;
    isCollapsed: boolean;
    onOpenSettings?: () => void;
}

export const SidebarFooter: React.FC<SidebarFooterProps> = ({
    userId,
    userEmail,
    syncStatus,
    hasPending = false,
    isCollapsed,
    onOpenSettings,
}) => {
    const { t } = useTranslation();
    const isLocalMode = !userId || userId === 'local' || !userEmail;

    const syncInfo = (() => {
        if (isLocalMode) {
            return {
                label: t('onboarding.localTitle'),
                dotClass: 'bg-gray-400 dark:bg-gray-500',
            };
        }
        if (syncStatus === 'pending' || hasPending) {
            return {
                label: t('settings.syncSection.statusPending'),
                dotClass: 'bg-amber-500 animate-pulse',
            };
        }
        if (syncStatus === 'error') {
            return {
                label: t('settings.syncSection.statusError'),
                dotClass: 'bg-red-500',
            };
        }
        if (syncStatus === 'offline') {
            return {
                label: t('settings.syncSection.statusOffline'),
                dotClass: 'bg-gray-400',
            };
        }
        return {
            label: t('settings.syncSection.statusSynced'),
            dotClass: 'bg-emerald-500',
        };
    })();

    return (
        <div className="px-2.5 py-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-muted)] shrink-0 select-none">
            <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className={clsx("w-2 h-2 rounded-full shrink-0", syncInfo.dotClass)} />
                {!isCollapsed && <span className="text-[11px] font-medium truncate">{syncInfo.label}</span>}
            </div>
            <button
                type="button"
                onClick={onOpenSettings}
                className="smooth-transition p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-md hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 shrink-0"
                title={t('settings.title')}
            >
                <Settings size={14} />
            </button>
        </div>
    );
};


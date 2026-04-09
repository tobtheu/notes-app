import { RefreshCw, Cloud, CloudOff, CheckCircle2, XCircle, Clock } from 'lucide-react';
import clsx from 'clsx';
import type { SyncStatus } from '../hooks/useNotes';

interface SyncStatusBadgeProps {
    syncStatus: SyncStatus;
    syncError?: string | null;
    hasPending?: boolean;
    onSync?: () => void;
    onOpenSettings?: () => void;
}

export function SyncStatusBadge({
    syncStatus,
    syncError,
    hasPending = false,
    onSync,
    onOpenSettings,
}: SyncStatusBadgeProps) {

    type Config = {
        icon: React.ReactNode;
        label: string;
        color: string;
        clickable: boolean;
    };

    const config: Config = (() => {
        switch (syncStatus) {
            case 'initialising':
                return {
                    icon: <RefreshCw size={18} className="animate-spin" />,
                    label: 'Wird geladen…',
                    color: 'text-blue-500 dark:text-blue-400',
                    clickable: false,
                };
            case 'synced':
                return {
                    icon: <CheckCircle2 size={18} />,
                    label: hasPending ? 'Synchronisiert (ausstehend)' : 'Synchronisiert',
                    color: hasPending
                        ? 'text-amber-500 dark:text-amber-400'
                        : 'text-emerald-500 dark:text-emerald-400',
                    clickable: true,
                };
            case 'pending':
                return {
                    icon: <Clock size={18} />,
                    label: 'Ausstehende Änderungen',
                    color: 'text-amber-500 dark:text-amber-400',
                    clickable: true,
                };
            case 'offline':
                return {
                    icon: <CloudOff size={18} />,
                    label: 'Offline',
                    color: 'text-gray-400 dark:text-gray-500',
                    clickable: false,
                };
            case 'error':
                return {
                    icon: <XCircle size={18} />,
                    label: 'Sync-Fehler',
                    color: 'text-red-500 dark:text-red-400',
                    clickable: true,
                };
            case 'unauthenticated':
                return {
                    icon: <Cloud size={18} />,
                    label: 'Nicht angemeldet',
                    color: 'text-gray-400 dark:text-gray-500',
                    clickable: true,
                };
        }
    })();

    const handleClick = () => {
        if (syncStatus === 'error' && syncError) {
            alert(`Sync-Fehler:\n\n${syncError}`);
            return;
        }
        if (syncStatus === 'unauthenticated' && onOpenSettings) {
            onOpenSettings();
            return;
        }
        if (config.clickable && onSync) {
            onSync();
        }
    };

    return (
        <button
            type="button"
            onClick={config.clickable ? handleClick : undefined}
            disabled={!config.clickable}
            title={
                syncStatus === 'error' && syncError
                    ? syncError
                    : syncStatus === 'unauthenticated'
                        ? 'In den Einstellungen anmelden um zu synchronisieren'
                        : syncStatus === 'pending'
                            ? 'Lokale Änderungen werden synchronisiert sobald online'
                            : syncStatus === 'offline'
                                ? 'Keine Internetverbindung'
                                : 'Sync-Status'
            }
            className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors select-none',
                config.color,
                config.clickable
                    ? 'hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer'
                    : 'cursor-default opacity-75',
            )}
        >
            {config.icon}
            <span>{config.label}</span>
        </button>
    );
}

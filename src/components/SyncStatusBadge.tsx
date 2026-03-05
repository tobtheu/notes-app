import { RefreshCw, Cloud, CloudOff, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import clsx from 'clsx';
import type { ConflictPair } from '../types';

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error' | 'conflict';

interface SyncStatusBadgeProps {
    syncStatus: SyncStatus;
    lastSyncedAt: Date | null;
    conflictFiles?: ConflictPair[];
    onSync?: () => void;
}

function formatRelativeTime(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
}

export function SyncStatusBadge({ syncStatus, lastSyncedAt, conflictFiles = [], onSync }: SyncStatusBadgeProps) {
    const config = {
        idle: {
            icon: <Cloud size={13} />,
            label: 'Sync',
            color: 'text-gray-400 dark:text-gray-500',
            dot: 'bg-gray-300 dark:bg-gray-600',
            clickable: true,
        },
        syncing: {
            icon: <RefreshCw size={13} className="animate-spin" />,
            label: 'Syncing…',
            color: 'text-blue-500 dark:text-blue-400',
            dot: 'bg-blue-400',
            clickable: false,
        },
        synced: {
            icon: <CheckCircle2 size={13} />,
            label: lastSyncedAt ? formatRelativeTime(lastSyncedAt) : 'Synced',
            color: 'text-emerald-500 dark:text-emerald-400',
            dot: 'bg-emerald-400',
            clickable: true,
        },
        offline: {
            icon: <CloudOff size={13} />,
            label: 'Offline',
            color: 'text-gray-400 dark:text-gray-500',
            dot: 'bg-gray-400',
            clickable: false,
        },
        error: {
            icon: <XCircle size={13} />,
            label: 'Sync failed',
            color: 'text-red-500 dark:text-red-400',
            dot: 'bg-red-400',
            clickable: true,
        },
        conflict: {
            icon: <AlertTriangle size={13} />,
            label: conflictFiles && conflictFiles.length > 0 ? `Konflikt in ${conflictFiles.length} Datei(en)` : 'Konflikt',
            color: 'text-orange-500 dark:text-orange-400',
            dot: 'bg-orange-400',
            clickable: true,
        },
    }[syncStatus];

    return (
        <button
            onClick={config.clickable && onSync ? onSync : undefined}
            disabled={!config.clickable || !onSync}
            title={
                syncStatus === 'conflict'
                    ? `Conflict in: ${conflictFiles.join(', ')}`
                    : syncStatus === 'synced' && lastSyncedAt
                        ? `Last synced ${formatRelativeTime(lastSyncedAt)}`
                        : syncStatus === 'offline'
                            ? 'No internet connection'
                            : 'Sync with GitHub'
            }
            className={clsx(
                'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all select-none',
                config.color,
                config.clickable && onSync
                    ? 'hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer'
                    : 'cursor-default opacity-75'
            )}
        >
            <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', config.dot)} />
            {config.icon}
            <span>{config.label}</span>
        </button>
    );
}

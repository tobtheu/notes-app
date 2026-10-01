import React, { useState, useEffect, useRef, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery, usePGlite } from '@electric-sql/pglite-react';
import { RefreshCw, CheckCircle, AlertCircle, CloudOff, ArrowUpRight, Clock, X, Database, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { useSyncProgress } from '../lib/syncProgress';
import type { SyncStatus } from '../types';

interface PendingRow {
  id: string;
  table_name: string;
  operation: string;
  payload: string;
  attempts: number;
  next_retry_at: string;
  created_at: string;
}

interface DevSyncTooltipProps {
  children: React.ReactNode;
  syncStatus?: SyncStatus;
  hasPending?: boolean;
  onTriggerSync?: () => Promise<void>;
}

// Error boundary to gracefully handle rendering when outside of a PGliteProvider (e.g. unit tests)
class LiveQueryBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {}
  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}

function getRowTitle(row: PendingRow): string {
  try {
    const p = JSON.parse(row.payload);
    if (row.table_name === 'notes' && p.content) {
      const line = p.content.trim().split('\n')[0].replace(/^#+\s*/, '').trim();
      return line ? line.slice(0, 32) : `Notiz: ${row.id.replace('notes:', '').slice(0, 8)}...`;
    }
    if (row.table_name === 'app_config') {
      return 'App-Metadaten & Einstellungen';
    }
  } catch {
    // Fallback
  }
  return row.id;
}

/**
 * Isolated component for live query of pending_writes rows.
 */
function PendingQueueList() {
  const pendingQuery = useLiveQuery<PendingRow>(
    `SELECT id, table_name, operation, payload, attempts, next_retry_at, created_at FROM pending_writes ORDER BY created_at ASC LIMIT 10`
  );

  let db: any = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    db = usePGlite();
  } catch {
    // Outside PGliteProvider
  }

  const pendingRows: PendingRow[] = pendingQuery?.rows || [];

  const handleClearQueue = async () => {
    if (!db) return;
    if (window.confirm('Möchtest du alle ausstehenden Writes aus der lokalen Queue löschen?')) {
      await db.query(`DELETE FROM pending_writes`);
    }
  };

  if (pendingRows.length === 0) {
    return (
      <div className="p-2.5 text-center text-[10px] text-[var(--text-muted)] bg-[var(--sidebar-item-hover)]/20 rounded-md border border-dashed border-[var(--border-subtle)]">
        Keine ausstehenden Writes — alle Notizen aktuell.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-end pb-0.5">
        {db && (
          <button
            type="button"
            onClick={handleClearQueue}
            className="text-[9px] text-red-500 hover:text-red-600 flex items-center gap-0.5 hover:underline cursor-pointer"
            title="Löscht alle ausstehenden Einträge aus pending_writes"
          >
            <Trash2 size={9} /> Queue leeren
          </button>
        )}
      </div>
      {pendingRows.map((row) => (
        <div
          key={row.id}
          className="flex items-center justify-between gap-1.5 p-1.5 rounded-md bg-[var(--sidebar-item-hover)]/30 border border-[var(--border-subtle)] text-[10px]"
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span
              className={clsx(
                "px-1 py-0.2 rounded text-[8px] font-bold uppercase shrink-0",
                row.operation === 'delete'
                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                  : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              )}
            >
              {row.operation}
            </span>
            <span className="truncate font-medium text-[var(--text-main)]" title={row.id}>
              {getRowTitle(row)}
            </span>
          </div>
          {row.attempts > 0 && (
            <span
              className="shrink-0 text-[9px] font-mono text-amber-500 bg-amber-500/10 px-1 rounded"
              title={`Versuche: ${row.attempts}/10`}
            >
              {row.attempts}x
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * DevSyncTooltip
 *
 * ONLY active in development mode (`import.meta.env.DEV`).
 * In production builds, this component is completely bypassed and only
 * returns its children without any extra DOM, listeners, or bundle overhead.
 *
 * Uses React Portal to document.body with fixed positioning so it escapes
 * the overflow: hidden and stacking context of Sidebar, hovering cleanly above
 * NoteList and Editor while remaining beneath modals.
 */
export const DevSyncTooltip: React.FC<DevSyncTooltipProps> = ({
  children,
  syncStatus,
  hasPending = false,
  onTriggerSync,
}) => {
  // STRICT CONSTRAINT: Only visible in dev mode
  if (!import.meta.env.DEV) {
    return <>{children}</>;
  }

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ bottom: number; left: number }>({ bottom: 60, left: 16 });

  const progress = useSyncProgress();
  const [isManualSyncing, startManualSync] = useTransition();

  const isFlushing = progress.phase === 'pushing';
  const isPulling = progress.phase === 'pulling';
  // ONLY mark active in-flight sync if a network operation is actually running
  const isSyncing = isFlushing || isPulling || isManualSyncing;

  // Calculate progress percentage
  const total = progress.total > 0 ? progress.total : (hasPending ? 1 : 0);
  const completed = progress.completed;
  const progressPercent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : (hasPending ? 30 : 100);

  // Position calculation relative to trigger
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const updatePosition = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const tooltipWidth = 320;
      const padding = 12;
      const bottom = Math.max(padding, window.innerHeight - rect.top + 8);
      let left = rect.left;
      if (left + tooltipWidth > window.innerWidth - padding) {
        left = Math.max(padding, window.innerWidth - tooltipWidth - padding);
      }
      setCoords({ bottom, left });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        popoverRef.current && !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isOpen]);

  const handleManualSync = () => {
    if (!onTriggerSync) return;
    startManualSync(async () => {
      try {
        await onTriggerSync();
      } catch (err) {
        console.error('Manual sync failed:', err);
      }
    });
  };

  return (
    <div ref={containerRef} className="relative inline-flex items-center min-w-0 flex-1">
      {/* Trigger */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setIsOpen((prev) => !prev);
          }
        }}
        title="[DEV] Klicke für Sync-Details & Fortschritt"
        className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer hover:opacity-85 transition-opacity select-none group"
      >
        {children}
      </div>

      {/* Floating Popover via Portal: above NoteList & Editor, below Modals */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            bottom: `${coords.bottom}px`,
            left: `${coords.left}px`,
            zIndex: 900,
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.25)',
          }}
          className={clsx(
            "w-72 sm:w-80",
            "bg-white/95 dark:bg-gray-900/95 backdrop-blur-md",
            "border border-gray-200/90 dark:border-gray-700/80 shadow-2xl rounded-xl p-3",
            "text-[var(--text-main)] animate-in fade-in zoom-in-95 duration-150 origin-bottom-left"
          )}
        >
          <div className="flex flex-col gap-2.5">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-1.5">
                <div className="relative flex items-center justify-center">
                  <span
                    className={clsx(
                      "w-2 h-2 rounded-full",
                      isSyncing ? "bg-amber-500 animate-ping" : (syncStatus === 'error' ? "bg-red-500" : "bg-emerald-500")
                    )}
                  />
                  <span
                    className={clsx(
                      "w-2 h-2 rounded-full absolute",
                      isSyncing ? "bg-amber-500" : (syncStatus === 'error' ? "bg-red-500" : "bg-emerald-500")
                    )}
                  />
                </div>
                <span className="font-semibold text-[11px] tracking-wide text-[var(--text-main)]">DEV SYNC MONITOR</span>
                <span className="px-1 py-0.2 text-[9px] font-bold rounded bg-indigo-500/10 text-indigo-500 dark:bg-indigo-400/10 dark:text-indigo-400 uppercase">
                  Dev Only
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                title="Schließen"
              >
                <X size={13} />
              </button>
            </div>

            {/* Current Activity Status Card */}
            <div className="bg-[var(--sidebar-item-hover)]/40 rounded-lg p-2 flex flex-col gap-1.5 border border-[var(--border-subtle)]/50">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[var(--text-main)] flex items-center gap-1.5">
                  {isSyncing ? (
                    <RefreshCw size={12} className="animate-spin text-amber-500" />
                  ) : syncStatus === 'error' ? (
                    <AlertCircle size={12} className="text-red-500" />
                  ) : syncStatus === 'offline' ? (
                    <CloudOff size={12} className="text-gray-400" />
                  ) : hasPending ? (
                    <Clock size={12} className="text-amber-500" />
                  ) : (
                    <CheckCircle size={12} className="text-emerald-500" />
                  )}
                  {isPulling
                    ? 'Lade Daten von Supabase...'
                    : isFlushing
                    ? 'Übertrage lokale Writes...'
                    : hasPending
                    ? 'Ausstehende Änderungen in Queue'
                    : syncStatus === 'offline'
                    ? 'Offline — Writes lokal gepuffert'
                    : syncStatus === 'error'
                    ? 'Synchronisationsfehler'
                    : 'Alles synchronisiert (Cloud & PGlite)'}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] font-mono">
                  {isFlushing && total > 0 ? `${completed}/${total}` : hasPending ? 'Queue aktiv' : 'synced'}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-[var(--border-subtle)] rounded-full h-1.5 overflow-hidden">
                <div
                  className={clsx(
                    "h-full transition-all duration-300 rounded-full",
                    isSyncing ? "bg-amber-500 animate-pulse" : (hasPending ? "bg-amber-500/80" : "bg-emerald-500")
                  )}
                  style={{ width: `${Math.max(5, progressPercent)}%` }}
                />
              </div>

              {/* Current Active Item Detail */}
              {progress.currentItem && isSyncing && (
                <div className="text-[10px] text-[var(--text-muted)] truncate flex items-center gap-1">
                  <ArrowUpRight size={10} className="shrink-0 text-amber-500" />
                  <span className="truncate">Aktiv: {progress.currentItem}</span>
                </div>
              )}

              {progress.error && (
                <div className="text-[10px] text-red-500 dark:text-red-400 bg-red-500/10 p-1 rounded font-mono truncate">
                  {progress.error}
                </div>
              )}
            </div>

            {/* Queue Details List */}
            <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
              <div className="flex items-center justify-between text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider px-0.5">
                <span className="flex items-center gap-1">
                  <Database size={10} /> Warteschlange
                </span>
                {progress.lastFlushedAt && (
                  <span className="flex items-center gap-1 normal-case font-normal">
                    <Clock size={10} /> {new Date(progress.lastFlushedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
              </div>

              <LiveQueryBoundary
                fallback={
                  <div className="p-2 text-center text-[10px] text-[var(--text-muted)] bg-[var(--sidebar-item-hover)]/20 rounded-md">
                    Keine ausstehenden Writes.
                  </div>
                }
              >
                <PendingQueueList />
              </LiveQueryBoundary>
            </div>

            {/* Footer / Manual Trigger Button */}
            {onTriggerSync && (
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="mt-1 w-full py-1.5 px-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-md text-[10px] font-medium flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] shadow-sm cursor-pointer"
              >
                <RefreshCw size={11} className={clsx(isSyncing && "animate-spin")} />
                {isSyncing ? 'Synchronisiere...' : 'Jetzt synchronisieren (Force Flush)'}
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

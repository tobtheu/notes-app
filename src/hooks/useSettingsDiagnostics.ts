import { useState, useEffect, useRef } from 'react';
import { runDiagnostics } from '../utils/health';
import type { HealthStatus } from '../utils/health';

interface UseSettingsDiagnosticsProps {
    isOpen: boolean;
    onInstallUpdate?: () => Promise<void>;
}

export function useSettingsDiagnostics({
    isOpen,
    onInstallUpdate,
}: UseSettingsDiagnosticsProps) {
    const [version, setVersion] = useState<string>('0.0.0');
    const [updateStatus, setUpdateStatus] = useState<{
        type: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
        progress?: number;
        error?: string;
        version?: string;
    }>({ type: 'idle' });
    const [diagResults, setDiagResults] = useState<HealthStatus[] | null>(null);
    const [isDiagnosing, setIsDiagnosing] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to update status box when it appears
    useEffect(() => {
        if (updateStatus.type !== 'idle' && scrollContainerRef.current) {
            setTimeout(() => {
                scrollContainerRef.current?.scrollTo({
                    top: scrollContainerRef.current.scrollHeight,
                    behavior: 'smooth'
                });
            }, 50);
        }
    }, [updateStatus.type]);

    useEffect(() => {
        if (!isOpen) return;
        window.tauriAPI?.getAppVersion?.().then(setVersion);
        const unsubscribe = window.tauriAPI?.onUpdateStatus?.((status) => {
            setUpdateStatus(status);
        });
        return () => unsubscribe?.();
    }, [isOpen]);

    const handleCheckForUpdates = () => {
        setUpdateStatus({ type: 'checking' });
        window.tauriAPI?.checkForUpdates?.();
    };

    const handleDownloadUpdate = () => {
        window.tauriAPI?.downloadUpdate?.();
    };

    const handleInstallUpdate = async () => {
        if (onInstallUpdate) await onInstallUpdate();
        else window.tauriAPI?.quitAndInstall?.();
    };

    const handleRunDiagnostics = async () => {
        setIsDiagnosing(true);
        try {
            const results = await runDiagnostics();
            setDiagResults(results);
        } catch (err) {
            console.error('Diagnostics failed:', err);
        } finally {
            setIsDiagnosing(false);
        }
    };

    return {
        version,
        updateStatus,
        diagResults,
        isDiagnosing,
        scrollContainerRef,
        handleCheckForUpdates,
        handleDownloadUpdate,
        handleInstallUpdate,
        handleRunDiagnostics,
    };
}

import { useState, useEffect } from 'react';
import { platform } from '@tauri-apps/plugin-os';

export function useTauriUpdater() {
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<{
    type: 'idle' | 'available' | 'downloading' | 'error' | 'downloaded';
    progress?: number;
    error?: string;
  }>({ type: 'idle' });

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const p = await platform();
        if (p === 'ios' || p === 'android') return;
        const { check } = await import('@tauri-apps/plugin-updater');
        const update = await check();
        if (update) {
          setUpdateVersion(update.version);
          setUpdateStatus({ type: 'available' });
          setIsUpdateModalOpen(true);
        }
      } catch (error) {
        console.error('Failed to check for updates:', error);
      }
    };
    checkForUpdates();
  }, []);

  const handleUpdate = async () => {
    try {
      setUpdateStatus({ type: 'downloading' });
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update) {
        await update.downloadAndInstall();
        setUpdateStatus({ type: 'downloaded' });
      }
    } catch (error) {
      console.error('Update failed:', error);
      setUpdateStatus({ type: 'error', error: String(error) });
    }
  };

  const handleInstallUpdate = async () => {
    const { relaunch } = await import('@tauri-apps/plugin-process');
    await relaunch();
  };

  const handleSkipUpdate = () => {
    setIsUpdateModalOpen(false);
  };

  return {
    isUpdateModalOpen,
    setIsUpdateModalOpen,
    updateVersion,
    updateStatus,
    handleUpdate,
    handleInstallUpdate,
    handleSkipUpdate,
  };
}

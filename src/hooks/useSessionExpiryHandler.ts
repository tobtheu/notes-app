import { useEffect } from 'react';
import type { SyncStatus } from './useNotes';

interface UseSessionExpiryHandlerProps {
  syncStatus: SyncStatus;
  syncError: string | null;
  signOut: (deleteLocal?: boolean) => Promise<void>;
  setIsSettingsOpen: (open: boolean) => void;
}

export function useSessionExpiryHandler({
  syncStatus,
  syncError,
  signOut,
  setIsSettingsOpen,
}: UseSessionExpiryHandlerProps) {
  useEffect(() => {
    if (syncStatus === 'error' && syncError === 'session_expired') {
      signOut(false).then(() => {
        setTimeout(() => {
          alert('Deine Sitzung ist abgelaufen. Bitte melde dich erneut an, um deine Notizen weiterhin zu synchronisieren.');
          setIsSettingsOpen(true);
        }, 100);
      });
    }
  }, [syncStatus, syncError, signOut, setIsSettingsOpen]);
}

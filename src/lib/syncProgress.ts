import { useState, useEffect } from 'react';

export type SyncPhase = 'idle' | 'pulling' | 'pushing' | 'error';

export interface SyncProgressState {
  phase: SyncPhase;
  total: number;
  completed: number;
  currentItem?: string;
  lastFlushedAt?: number;
  error?: string;
}

type SyncProgressSubscriber = (state: SyncProgressState) => void;

let currentState: SyncProgressState = {
  phase: 'idle',
  total: 0,
  completed: 0,
};

const subscribers = new Set<SyncProgressSubscriber>();

export function getSyncProgress(): SyncProgressState {
  return currentState;
}

export function updateSyncProgress(update: Partial<SyncProgressState>): void {
  currentState = { ...currentState, ...update };
  subscribers.forEach((sub) => {
    try {
      sub(currentState);
    } catch (e) {
      console.error('[syncProgress] subscriber error:', e);
    }
  });
}

export function subscribeSyncProgress(sub: SyncProgressSubscriber): () => void {
  subscribers.add(sub);
  return () => {
    subscribers.delete(sub);
  };
}

export function useSyncProgress(): SyncProgressState {
  const [state, setState] = useState<SyncProgressState>(getSyncProgress);
  useEffect(() => {
    return subscribeSyncProgress(setState);
  }, []);
  return state;
}

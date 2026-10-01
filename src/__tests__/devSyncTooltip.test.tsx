import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import {
  getSyncProgress,
  updateSyncProgress,
  subscribeSyncProgress,
} from '../lib/syncProgress';
import { DevSyncTooltip } from '../components/DevSyncTooltip';

describe('syncProgress store', () => {
  beforeEach(() => {
    updateSyncProgress({
      phase: 'idle',
      total: 0,
      completed: 0,
      currentItem: undefined,
      error: undefined,
    });
  });

  it('updates progress state and notifies subscribers', () => {
    const subscriber = vi.fn();
    const unsubscribe = subscribeSyncProgress(subscriber);

    updateSyncProgress({
      phase: 'pushing',
      total: 5,
      completed: 2,
      currentItem: 'Notiz A',
    });

    expect(subscriber).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: 'pushing',
        total: 5,
        completed: 2,
        currentItem: 'Notiz A',
      })
    );

    const state = getSyncProgress();
    expect(state.phase).toBe('pushing');
    expect(state.total).toBe(5);
    expect(state.completed).toBe(2);

    unsubscribe();
  });
});

describe('DevSyncTooltip component', () => {
  beforeEach(() => {
    updateSyncProgress({
      phase: 'idle',
      total: 0,
      completed: 0,
      currentItem: undefined,
      error: undefined,
    });
  });

  it('renders children trigger in dev mode and toggles popover on click', () => {
    render(
      <DevSyncTooltip syncStatus="synced" hasPending={false}>
        <span data-testid="sync-trigger">Synced Dot</span>
      </DevSyncTooltip>
    );

    const trigger = screen.getByTestId('sync-trigger');
    expect(trigger).toBeDefined();

    // Popover should not be visible initially
    expect(screen.queryByText('DEV SYNC MONITOR')).toBeNull();

    // Click trigger to open
    fireEvent.click(trigger);

    expect(screen.getByText('DEV SYNC MONITOR')).toBeDefined();
    expect(screen.getByText('Dev Only')).toBeDefined();
  });

  it('calls onTriggerSync when manual sync button is clicked', async () => {
    const onTriggerSync = vi.fn().mockResolvedValue(undefined);

    render(
      <DevSyncTooltip
        syncStatus="synced"
        hasPending={false}
        onTriggerSync={onTriggerSync}
      >
        <span data-testid="sync-trigger">Sync Dot</span>
      </DevSyncTooltip>
    );

    // Open popover
    fireEvent.click(screen.getByTestId('sync-trigger'));

    // Manual sync button
    const syncBtn = screen.getByText(/Jetzt synchronisieren/);
    expect(syncBtn).toBeDefined();

    await act(async () => {
      fireEvent.click(syncBtn);
    });

    expect(onTriggerSync).toHaveBeenCalled();
  });

  it('does not render tooltip popover when DEV is false', () => {
    const originalDev = import.meta.env.DEV;
    try {
      (import.meta.env as any).DEV = false;
      render(
        <DevSyncTooltip syncStatus="synced" hasPending={false}>
          <span data-testid="prod-sync-trigger">Prod Synced Dot</span>
        </DevSyncTooltip>
      );

      const trigger = screen.getByTestId('prod-sync-trigger');
      expect(trigger).toBeDefined();

      fireEvent.click(trigger);
      expect(screen.queryByText('DEV SYNC MONITOR')).toBeNull();
    } finally {
      (import.meta.env as any).DEV = originalDev;
    }
  });
});

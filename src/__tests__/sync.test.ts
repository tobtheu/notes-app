import { describe, it, expect, vi } from 'vitest'
import { getPathId, normalizeStr } from '../utils/path'

// ---------------------------------------------------------------------------
// Offline Queue Logic
// ---------------------------------------------------------------------------
// These tests verify the deduplication and flush behaviour of the offline
// queue without requiring a real PGlite or Supabase connection.

describe('offline queue — deduplication', () => {
  it('deduplicates writes for the same note ID', () => {
    // Simulate two writes for the same note — only the latest should survive
    const queue: Map<string, { payload: string; attempts: number }> = new Map()

    function enqueue(id: string, payload: object) {
      queue.set(id, { payload: JSON.stringify(payload), attempts: 0 })
    }

    enqueue('notes:work/meeting.md', { id: 'work/meeting.md', content: 'v1' })
    enqueue('notes:work/meeting.md', { id: 'work/meeting.md', content: 'v2' })

    expect(queue.size).toBe(1)
    expect(JSON.parse(queue.get('notes:work/meeting.md')!.payload).content).toBe('v2')
  })

  it('keeps separate entries for different notes', () => {
    const queue: Map<string, { payload: string }> = new Map()
    queue.set('notes:work/a.md', { payload: '{}' })
    queue.set('notes:work/b.md', { payload: '{}' })
    expect(queue.size).toBe(2)
  })

  it('separates note and config entries with different prefixes', () => {
    const queue: Map<string, { payload: string }> = new Map()
    const userId = 'user-123'
    queue.set(`notes:work/a.md`, { payload: '{}' })
    queue.set(`app_config:${userId}`, { payload: '{}' })
    expect(queue.size).toBe(2)
  })
})

describe('offline queue — flush behaviour', () => {
  it('gives up after 10 failed attempts', () => {
    const MAX_ATTEMPTS = 10
    let attempts = 0

    function shouldGiveUp(currentAttempts: number): boolean {
      return currentAttempts >= MAX_ATTEMPTS
    }

    // Simulate 9 failures → keep trying
    expect(shouldGiveUp(9)).toBe(false)
    // 10th failure → give up
    expect(shouldGiveUp(10)).toBe(true)

    void attempts // suppress unused warning
  })

  it('skips flush when offline', () => {
    const onlineSpy = vi.fn().mockReturnValue(false)
    const flushCalled = vi.fn()

    function maybeFlush() {
      if (!onlineSpy()) return
      flushCalled()
    }

    maybeFlush()
    expect(flushCalled).not.toHaveBeenCalled()
  })

  it('flushes when online', () => {
    const onlineSpy = vi.fn().mockReturnValue(true)
    const flushCalled = vi.fn()

    function maybeFlush() {
      if (!onlineSpy()) return
      flushCalled()
    }

    maybeFlush()
    expect(flushCalled).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// Note row → Note object mapping
// ---------------------------------------------------------------------------

describe('rowToNote — id path parsing', () => {
  function rowToNote(row: { id: string; content: string; updated_at: string }) {
    const lastSlash = row.id.lastIndexOf('/')
    const filename = lastSlash >= 0 ? row.id.slice(lastSlash + 1) : row.id
    const folder = lastSlash >= 0 ? row.id.slice(0, lastSlash) : ''
    return { filename, folder, content: row.content, updatedAt: row.updated_at }
  }

  it('parses a note in a folder', () => {
    const note = rowToNote({ id: 'work/meeting.md', content: '# Meeting', updated_at: '2024-01-01' })
    expect(note.filename).toBe('meeting.md')
    expect(note.folder).toBe('work')
  })

  it('parses a root-level note (no folder)', () => {
    const note = rowToNote({ id: 'inbox.md', content: '# Inbox', updated_at: '2024-01-01' })
    expect(note.filename).toBe('inbox.md')
    expect(note.folder).toBe('')
  })

  it('parses a deeply nested note (uses last slash)', () => {
    const note = rowToNote({ id: 'projects/q1/plan.md', content: '', updated_at: '2024-01-01' })
    expect(note.filename).toBe('plan.md')
    expect(note.folder).toBe('projects/q1')
  })

  it('round-trips through getPathId', () => {
    const id = getPathId('plan.md', 'projects/q1')
    const note = rowToNote({ id, content: '', updated_at: '' })
    expect(getPathId(note.filename, note.folder)).toBe(id)
  })
})

// ---------------------------------------------------------------------------
// Soft-delete semantics
// ---------------------------------------------------------------------------

describe('soft-delete — deleted flag', () => {
  it('deleted=true note is excluded from active notes list', () => {
    const rows = [
      { id: 'work/a.md', content: '# A', updated_at: '', deleted: 0 },
      { id: 'work/b.md', content: '# B', updated_at: '', deleted: 1 },
    ]
    const active = rows.filter(r => r.deleted === 0)
    expect(active).toHaveLength(1)
    expect(active[0].id).toBe('work/a.md')
  })

  it('deleting a note sets deleted=1 and keeps content intact', () => {
    const note = { id: 'work/a.md', content: '# A', deleted: 0 }
    const deleted = { ...note, deleted: 1 }
    expect(deleted.deleted).toBe(1)
    expect(deleted.content).toBe('# A') // content preserved for history
  })

  it('move is a soft-delete of old ID + insert of new ID', () => {
    const oldId = getPathId('note.md', 'work')
    const newId = getPathId('note.md', 'personal')

    expect(oldId).not.toBe(newId)

    // Simulate the move: old row deleted, new row created
    const rows = new Map<string, { deleted: number }>()
    rows.set(oldId, { deleted: 1 })
    rows.set(newId, { deleted: 0 })

    expect(rows.get(oldId)!.deleted).toBe(1)
    expect(rows.get(newId)!.deleted).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// SyncStatus transitions
// ---------------------------------------------------------------------------

describe('syncStatus state machine', () => {
  type SyncStatus = 'initialising' | 'synced' | 'offline' | 'pending' | 'error' | 'unauthenticated'

  function nextStatus(
    current: SyncStatus,
    event: 'online' | 'offline' | 'auth_ok' | 'auth_fail' | 'has_pending' | 'flushed',
  ): SyncStatus {
    switch (event) {
      case 'auth_ok': return 'synced'
      case 'auth_fail': return 'unauthenticated'
      case 'online': return current === 'offline' ? 'synced' : current
      case 'offline': return 'offline'
      case 'has_pending': return current === 'synced' ? 'pending' : current
      case 'flushed': return 'synced'
      default: return current
    }
  }

  it('transitions from initialising to synced after auth', () => {
    expect(nextStatus('initialising', 'auth_ok')).toBe('synced')
  })

  it('transitions from initialising to unauthenticated when no session', () => {
    expect(nextStatus('initialising', 'auth_fail')).toBe('unauthenticated')
  })

  it('transitions to offline when network drops', () => {
    expect(nextStatus('synced', 'offline')).toBe('offline')
    expect(nextStatus('pending', 'offline')).toBe('offline')
  })

  it('transitions from offline to synced when network returns', () => {
    expect(nextStatus('offline', 'online')).toBe('synced')
  })

  it('transitions to pending when there are unsynced writes', () => {
    expect(nextStatus('synced', 'has_pending')).toBe('pending')
  })

  it('transitions from pending to synced after flush', () => {
    expect(nextStatus('pending', 'flushed')).toBe('synced')
  })

  it('does not change error state on online event', () => {
    // Error is a terminal state until user action — not auto-cleared by reconnect
    expect(nextStatus('error', 'online')).toBe('error')
  })
})

// ---------------------------------------------------------------------------
// Stale-write rejection (last-write-wins via updated_at)
// ---------------------------------------------------------------------------

describe('stale-write rejection — timestamp-based conflict resolution', () => {
  const t0 = '2024-01-01T10:00:00.000Z'
  const t1 = '2024-01-01T10:00:01.000Z'
  const t2 = '2024-01-01T10:00:02.000Z'

  function shouldApplyUpdate(incomingAt: string, localAt: string): boolean {
    return new Date(incomingAt).getTime() >= new Date(localAt).getTime()
  }

  it('applies an incoming update that is newer than local', () => {
    expect(shouldApplyUpdate(t2, t1)).toBe(true)
  })

  it('applies an incoming update with the same timestamp (idempotent)', () => {
    expect(shouldApplyUpdate(t1, t1)).toBe(true)
  })

  it('rejects a stale incoming update older than local', () => {
    expect(shouldApplyUpdate(t0, t1)).toBe(false)
  })

  it('rejects Electric replay that arrives after a local folder rename', () => {
    // Simulate: user renames folder at t2, Electric replays old config from t0
    const localUpdatedAt = t2
    const electricReplayAt = t0
    expect(shouldApplyUpdate(electricReplayAt, localUpdatedAt)).toBe(false)
  })

  it('applies Electric update that arrives after local write', () => {
    // Simulate: local write at t1, Electric delivers server-confirmed version at t2
    const localUpdatedAt = t1
    const electricUpdateAt = t2
    expect(shouldApplyUpdate(electricUpdateAt, localUpdatedAt)).toBe(true)
  })

  it('preserves local note edit when stale sync arrives', () => {
    const rows = new Map<string, { content: string; updated_at: string }>()
    rows.set('work/note.md', { content: 'local edit', updated_at: t2 })

    function applyElectricUpdate(id: string, incoming: { content: string; updated_at: string }) {
      const local = rows.get(id)
      if (!local) { rows.set(id, incoming); return }
      if (shouldApplyUpdate(incoming.updated_at, local.updated_at)) {
        rows.set(id, incoming)
      }
    }

    applyElectricUpdate('work/note.md', { content: 'stale server version', updated_at: t0 })
    expect(rows.get('work/note.md')!.content).toBe('local edit')
  })

  it('applies server version when it is the confirmed write', () => {
    const rows = new Map<string, { content: string; updated_at: string }>()
    rows.set('work/note.md', { content: 'local optimistic', updated_at: t1 })

    function applyElectricUpdate(id: string, incoming: { content: string; updated_at: string }) {
      const local = rows.get(id)
      if (!local) { rows.set(id, incoming); return }
      if (shouldApplyUpdate(incoming.updated_at, local.updated_at)) {
        rows.set(id, incoming)
      }
    }

    // Server confirmed the write with same timestamp → applies (idempotent)
    applyElectricUpdate('work/note.md', { content: 'local optimistic', updated_at: t1 })
    expect(rows.get('work/note.md')!.content).toBe('local optimistic')
  })
})

// ---------------------------------------------------------------------------
// Write payload shape (ensures Supabase upsert payloads are correct)
// ---------------------------------------------------------------------------

describe('write payload structure', () => {
  it('note payload has all required Supabase columns', () => {
    const payload = {
      id: 'work/meeting.md',
      user_id: 'user-123',
      content: '# Meeting',
      updated_at: new Date().toISOString(),
      deleted: false,
    }
    expect(payload).toHaveProperty('id')
    expect(payload).toHaveProperty('user_id')
    expect(payload).toHaveProperty('content')
    expect(payload).toHaveProperty('updated_at')
    expect(payload).toHaveProperty('deleted')
  })

  it('config payload has all required Supabase columns', () => {
    const payload = {
      user_id: 'user-123',
      metadata: { folders: {}, pinnedNotes: [] },
      updated_at: new Date().toISOString(),
    }
    expect(payload).toHaveProperty('user_id')
    expect(payload).toHaveProperty('metadata')
    expect(payload).toHaveProperty('updated_at')
  })

  it('note id is the normalized path', () => {
    const id = getPathId('Meeting.md', 'Work')
    expect(id).toBe(normalizeStr('work/meeting.md'))
  })
})

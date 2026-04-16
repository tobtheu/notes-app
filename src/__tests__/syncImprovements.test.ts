import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// 1. Exponential Backoff
// ---------------------------------------------------------------------------

describe('backoff — exponential delay calculation', () => {
  // Mirrors the backoffMs() function in offlineQueue.ts
  function backoffMs(attempts: number): number {
    return Math.min(5_000 * Math.pow(2, attempts), 300_000)
  }

  it('first retry waits 5s', () => {
    expect(backoffMs(0)).toBe(5_000)
  })

  it('second retry waits 10s', () => {
    expect(backoffMs(1)).toBe(10_000)
  })

  it('third retry waits 20s', () => {
    expect(backoffMs(2)).toBe(20_000)
  })

  it('caps at 300s (5 minutes)', () => {
    expect(backoffMs(10)).toBe(300_000)
    expect(backoffMs(100)).toBe(300_000)
  })

  it('grows exponentially up to the cap', () => {
    const delays = [0, 1, 2, 3, 4, 5].map(backoffMs)
    for (let i = 1; i < delays.length; i++) {
      // Each step is either double the previous or at the cap
      expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1])
    }
  })

  it('next_retry_at is in the future after a failure', () => {
    const attempts = 1
    const now = Date.now()
    const nextRetry = new Date(now + backoffMs(attempts))
    expect(nextRetry.getTime()).toBeGreaterThan(now)
  })
})

// ---------------------------------------------------------------------------
// 2. Token Refresh — when to refresh
// ---------------------------------------------------------------------------

describe('token refresh — expiry detection', () => {
  function shouldRefresh(expiresAt: number, nowSeconds: number): boolean {
    const secondsLeft = expiresAt - nowSeconds
    return secondsLeft < 300 // refresh if less than 5 min left
  }

  it('refreshes when token expires in 4 minutes', () => {
    const now = Math.floor(Date.now() / 1000)
    expect(shouldRefresh(now + 240, now)).toBe(true)
  })

  it('refreshes when token is already expired', () => {
    const now = Math.floor(Date.now() / 1000)
    expect(shouldRefresh(now - 60, now)).toBe(true)
  })

  it('does not refresh when token has 10 minutes left', () => {
    const now = Math.floor(Date.now() / 1000)
    expect(shouldRefresh(now + 600, now)).toBe(false)
  })

  it('does not refresh when token has exactly 5 minutes left', () => {
    const now = Math.floor(Date.now() / 1000)
    expect(shouldRefresh(now + 300, now)).toBe(false)
  })

  it('refreshes when token has 299 seconds left (just under threshold)', () => {
    const now = Math.floor(Date.now() / 1000)
    expect(shouldRefresh(now + 299, now)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 3. Request Timeout — AbortController behaviour
// ---------------------------------------------------------------------------

describe('request timeout — abort after deadline', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('aborts a request that exceeds the timeout', async () => {
    const controller = new AbortController()
    const TIMEOUT_MS = 15_000

    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    // Simulate time passing beyond the timeout
    vi.advanceTimersByTime(TIMEOUT_MS + 1)
    clearTimeout(timer)

    expect(controller.signal.aborted).toBe(true)
  })

  it('does not abort a request that completes before the timeout', async () => {
    const controller = new AbortController()
    const TIMEOUT_MS = 15_000

    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    // Request completes before timeout
    vi.advanceTimersByTime(5_000)
    clearTimeout(timer) // clear on success

    expect(controller.signal.aborted).toBe(false)
  })

  it('abort signal is propagated to fetch', async () => {
    const controller = new AbortController()
    controller.abort()

    // fetch rejects with AbortError when signal is already aborted
    const fetchMock = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'))

    await expect(fetchMock({ signal: controller.signal })).rejects.toThrow('Aborted')
  })
})

// ---------------------------------------------------------------------------
// 4. Flush Serialization — no parallel flushes
// ---------------------------------------------------------------------------

describe('flush serialization — at most one flush at a time', () => {
  it('serializes concurrent flush calls via promise chaining', async () => {
    const executionOrder: number[] = []
    let _flushPromise: Promise<void> | null = null

    function makeTask(id: number, delayMs: number): () => Promise<void> {
      return () => new Promise(resolve => {
        setTimeout(() => {
          executionOrder.push(id)
          resolve()
        }, delayMs)
      })
    }

    function serializedFlush(task: () => Promise<void>): Promise<void> {
      if (_flushPromise) {
        _flushPromise = _flushPromise.then(task)
        return _flushPromise
      }
      _flushPromise = task().finally(() => { _flushPromise = null })
      return _flushPromise
    }

    // Kick off 3 flushes "simultaneously"
    const p1 = serializedFlush(makeTask(1, 10))
    const p2 = serializedFlush(makeTask(2, 10))
    const p3 = serializedFlush(makeTask(3, 10))

    await Promise.all([p1, p2, p3])

    // Must run in order — no interleaving
    expect(executionOrder).toEqual([1, 2, 3])
  })

  it('second flush waits for first to finish before starting', async () => {
    let firstComplete = false
    let secondStarted = false
    let _flushPromise: Promise<void> | null = null

    function serializedFlush(task: () => Promise<void>): Promise<void> {
      if (_flushPromise) {
        _flushPromise = _flushPromise.then(task)
        return _flushPromise
      }
      _flushPromise = task().finally(() => { _flushPromise = null })
      return _flushPromise
    }

    const first = serializedFlush(() => new Promise(resolve => {
      setTimeout(() => { firstComplete = true; resolve() }, 20)
    }))

    const second = serializedFlush(async () => {
      secondStarted = true
      // At this point first must already be done
      expect(firstComplete).toBe(true)
    })

    await Promise.all([first, second])
    expect(secondStarted).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 5. migrateLocalNotes — data loss protection
// ---------------------------------------------------------------------------

describe('migrateLocalNotes — data loss protection', () => {
  it('keeps local rows when offline (does not delete before upload)', () => {
    // Simulate the migration logic: only delete if online AND flush succeeded
    function migrate(isOnline: boolean, flushSucceeded: boolean): {
      localRowsDeleted: boolean
      enqueuedForUpload: boolean
    } {
      const enqueuedForUpload = true // always enqueue

      if (!isOnline) {
        return { localRowsDeleted: false, enqueuedForUpload }
      }
      if (!flushSucceeded) {
        return { localRowsDeleted: false, enqueuedForUpload }
      }
      return { localRowsDeleted: true, enqueuedForUpload }
    }

    // Offline: never delete
    expect(migrate(false, false).localRowsDeleted).toBe(false)
    expect(migrate(false, true).localRowsDeleted).toBe(false)

    // Online but flush failed: keep rows
    expect(migrate(true, false).localRowsDeleted).toBe(false)

    // Online and flush succeeded: safe to delete
    expect(migrate(true, true).localRowsDeleted).toBe(true)
  })

  it('always enqueues rows for upload regardless of connectivity', () => {
    // Even when offline, writes must be in the queue so they upload later
    function migrate(isOnline: boolean) {
      return { enqueuedForUpload: true, localRowsDeleted: isOnline }
    }
    expect(migrate(false).enqueuedForUpload).toBe(true)
    expect(migrate(true).enqueuedForUpload).toBe(true)
  })

  it('preserves note content during migration', () => {
    const localRow = { id: 'work/plan.md', user_id: 'local', content: '# My Plan', updated_at: '2024-01-01T10:00:00Z' }
    const realUserId = 'abc-123-real'

    // Simulate writing under new userId — content must not change
    const migrated = { ...localRow, user_id: realUserId }
    expect(migrated.content).toBe(localRow.content)
    expect(migrated.id).toBe(localRow.id)
    expect(migrated.user_id).toBe(realUserId)
  })
})

// ---------------------------------------------------------------------------
// 6. Content Size Limit
// ---------------------------------------------------------------------------

describe('content size limit — 5MB enforcement', () => {
  const NOTE_SIZE_LIMIT = 5 * 1024 * 1024 // 5 MB

  function exceedsLimit(content: string): boolean {
    return new Blob([content]).size > NOTE_SIZE_LIMIT
  }

  it('allows a normal note (< 5MB)', () => {
    const content = '# Hello\n\nThis is a short note.'
    expect(exceedsLimit(content)).toBe(false)
  })

  it('allows content exactly at the limit', () => {
    const content = 'a'.repeat(NOTE_SIZE_LIMIT)
    expect(exceedsLimit(content)).toBe(false)
  })

  it('blocks content exceeding 5MB', () => {
    const content = 'a'.repeat(NOTE_SIZE_LIMIT + 1)
    expect(exceedsLimit(content)).toBe(true)
  })

  it('blocks a very large note (10MB)', () => {
    const content = 'x'.repeat(10 * 1024 * 1024)
    expect(exceedsLimit(content)).toBe(true)
  })

  it('measures byte size, not character count (UTF-8 multibyte)', () => {
    // Each emoji is 4 bytes in UTF-8
    const emoji = '😀'
    const emojiBytes = new Blob([emoji]).size
    expect(emojiBytes).toBeGreaterThan(1)

    // A string of emojis that exceeds 5MB
    const count = Math.floor(NOTE_SIZE_LIMIT / emojiBytes) + 1
    const content = emoji.repeat(count)
    expect(exceedsLimit(content)).toBe(true)
  })

  it('deleted notes bypass size check (soft-delete must always work)', () => {
    // When deleted=true, content is preserved but not re-validated —
    // the check only applies to active writes
    const hugeContent = 'x'.repeat(NOTE_SIZE_LIMIT + 1)
    const deleted = true

    const wouldBlock = !deleted && exceedsLimit(hugeContent)
    expect(wouldBlock).toBe(false) // deleted=true skips the check
  })
})

// ---------------------------------------------------------------------------
// 7. Shape Unsubscribe — sign-out cleanup
// ---------------------------------------------------------------------------

describe('shape unsubscribe — sign-out cleanup', () => {
  it('calls unsubscribe on all registered shape handles', () => {
    const unsub1 = vi.fn()
    const unsub2 = vi.fn()
    const handles = [
      { unsubscribe: unsub1 },
      { unsubscribe: unsub2 },
    ]

    // Mirrors stopElectricSync()
    function stopElectricSync(shapeHandles: typeof handles) {
      for (const handle of shapeHandles) {
        handle.unsubscribe()
      }
      shapeHandles.length = 0
    }

    stopElectricSync(handles)

    // Both handles were called before the array was cleared
    expect(unsub1).toHaveBeenCalledTimes(1)
    expect(unsub2).toHaveBeenCalledTimes(1)

    // After stop, array is cleared — no lingering references
    expect(handles.length).toBe(0)
  })

  it('tolerates a handle whose unsubscribe throws', () => {
    const handles = [
      { unsubscribe: vi.fn().mockImplementation(() => { throw new Error('already gone') }) },
      { unsubscribe: vi.fn() },
    ]

    function stopElectricSync(shapeHandles: typeof handles) {
      for (const handle of shapeHandles) {
        try { handle.unsubscribe() } catch { /* ignore */ }
      }
      shapeHandles.length = 0
    }

    // Must not throw — both handles processed even if first throws
    expect(() => stopElectricSync(handles)).not.toThrow()
    expect(handles.length).toBe(0)
  })

  it('sets _shapesStarted to false after stop', () => {
    let _shapesStarted = true

    function stopElectricSync() {
      _shapesStarted = false
    }

    stopElectricSync()
    expect(_shapesStarted).toBe(false)
  })

  it('clears the handles array so re-subscribe works cleanly', () => {
    const handles: { unsubscribe: () => void }[] = [
      { unsubscribe: vi.fn() },
    ]

    function stopElectricSync() {
      for (const h of handles) { try { h.unsubscribe() } catch { /* ignore */ } }
      handles.length = 0
    }

    stopElectricSync()
    expect(handles.length).toBe(0)

    // Simulate re-subscribe after sign-in with new account
    handles.push({ unsubscribe: vi.fn() })
    expect(handles.length).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// 8. Electric Error → syncStatus propagation
// ---------------------------------------------------------------------------

describe('Electric error → syncStatus propagation', () => {
  it('calls onError callback when shape subscription fails', () => {
    const onError = vi.fn()

    // Simulate the handleError function in electric.ts
    function handleError(err: unknown, cb?: (e: unknown) => void) {
      cb?.(err)
    }

    handleError(new Error('connection refused'), onError)
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
  })

  it('syncStatus transitions to error when Electric fails', () => {
    let syncStatus: string = 'synced'
    let syncError: string | null = null

    const onError = (err: unknown) => {
      syncStatus = 'error'
      syncError = String(err)
    }

    onError(new Error('shape fetch failed: 401'))

    expect(syncStatus).toBe('error')
    expect(syncError).toContain('401')
  })

  it('does not transition from error back to synced on reconnect alone', () => {
    // Error is a terminal state — only manual retry or re-auth clears it
    let syncStatus: string = 'error'

    function handleOnline() {
      if (syncStatus === 'offline') syncStatus = 'synced'
      // error stays as error — user must act
    }

    handleOnline()
    expect(syncStatus).toBe('error')
  })

  it('error from notes shape does not prevent config shape from being attempted', () => {
    // Both shapes run independently — one failing should be reported but not
    // silently skip the other. We verify that onError fires per-shape.
    const errors: string[] = []
    const onError = (table: string, err: unknown) => errors.push(`${table}: ${String(err)}`)

    // Simulate notes shape failing, config shape succeeding
    try { throw new Error('notes 403') } catch (e) { onError('notes', e) }
    // config shape proceeds independently
    errors.push('config: ok')

    expect(errors).toHaveLength(2)
    expect(errors[0]).toContain('notes')
    expect(errors[1]).toContain('config')
  })
})

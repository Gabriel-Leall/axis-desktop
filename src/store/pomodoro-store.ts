/**
 * Pomodoro store — Zustand v5
 *
 * Timer state survives navigation (in-memory) but resets on app restart.
 *
 * Drift-free approach:
 *   startedAt: number | null  — Date.now() when last resumed
 *   pausedElapsed: number     — total seconds accumulated before last pause
 *   timeRemaining is recomputed from (startedAt + pausedElapsed + now)
 *
 * Interval lifecycle:
 *   The interval is owned exclusively by this store via `_intervalRef`.
 *   `_startInterval` and `_clearInterval` are the single points of creation
 *   and teardown — no other code touches the interval directly.
 *
 *   Using an object ref (`{ id: null }`) instead of a bare module-level
 *   variable makes the reference stable across Vite HMR reloads: the object
 *   identity is preserved so old intervals are always cleared before a new
 *   one is created.
 *
 * Double-completion guard:
 *   `timerState` is set to `'completing'` synchronously inside `tick()` before
 *   the async `_completeSession` is awaited. Subsequent ticks hitting
 *   `remaining === 0` see state !== 'running' and exit early, preventing
 *   duplicate saves.
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import {
  loadPomodoroSettings,
  savePomodoroSettings,
  savePomodoroSession,
  loadTodaySessions,
  DEFAULT_SETTINGS,
} from '@/services/pomodoro-db'
import { logger } from '@/lib/logger'

import type {
  PomodoroSettings,
  PomodoroSession,
  TimerState,
  SessionType,
} from './pomodoro-types'

// ─── Store shape ───────────────────────────────────────────────────────────────

interface PomodoroStoreState {
  // Timer state
  timerState: TimerState
  currentType: SessionType
  totalDuration: number // seconds for current interval
  cyclesCompleted: number

  // Drift-free tracking (internal)
  startedAt: number | null // Date.now() when last resumed
  pausedElapsed: number // elapsed seconds accumulated before last pause
  sessionStartedAt: string | null // ISO UTC when the current session began

  // Current session
  currentSessionId: string | null

  // UI state
  linkedTaskId: string | null

  // Loaded data
  settings: PomodoroSettings
  todaySessions: PomodoroSession[]
  isLoadingSettings: boolean
  isLoadingSessions: boolean

  // Derived — updated by tick()
  timeRemaining: number

  // ── Actions ──────────────────────────────────────────────────────────────────
  start: () => void
  pause: () => void
  reset: () => void
  skip: () => Promise<void>
  tick: () => void
  linkTask: (taskId: string) => void
  unlinkTask: () => void
  loadSettings: () => Promise<void>
  updateSettings: (updates: Partial<PomodoroSettings>) => Promise<void>
  loadTodaySessions: () => Promise<void>
  /** Internal — called when a session naturally completes */
  _completeSession: () => Promise<void>
  /** Internal — starts the tick interval (single entry point) */
  _startInterval: () => void
  /** Internal — clears the tick interval (single entry point) */
  _clearInterval: () => void
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function utcNow(): string {
  return new Date().toISOString()
}

function generateId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15)
}

function durationForType(
  type: SessionType,
  settings: PomodoroSettings
): number {
  switch (type) {
    case 'focus':
      return settings.focus_duration * 60
    case 'short_break':
      return settings.short_break_duration * 60
    case 'long_break':
      return settings.long_break_duration * 60
  }
}

function nextType(
  currentType: SessionType,
  cyclesCompleted: number,
  pomosUntilLong: number
): SessionType {
  if (currentType !== 'focus') return 'focus'
  const newCycles = cyclesCompleted + 1
  return newCycles % pomosUntilLong === 0 ? 'long_break' : 'short_break'
}

/**
 * Stable object reference — survives Vite HMR module re-evaluation because
 * the *object* is re-used across hot reloads (the store singleton is preserved
 * by Zustand's module-level `create` call). The interval id lives on the
 * object so we always clear the right handle.
 */
const _intervalRef: { id: ReturnType<typeof setInterval> | null } = { id: null }

// ─── Store ─────────────────────────────────────────────────────────────────────

export const usePomodoroStore = create<PomodoroStoreState>()(
  devtools(
    (set, get) => ({
      timerState: 'idle',
      currentType: 'focus',
      totalDuration: DEFAULT_SETTINGS.focus_duration * 60,
      cyclesCompleted: 0,

      startedAt: null,
      pausedElapsed: 0,
      sessionStartedAt: null,
      currentSessionId: null,

      linkedTaskId: null,
      settings: DEFAULT_SETTINGS,
      todaySessions: [],
      isLoadingSettings: false,
      isLoadingSessions: false,

      timeRemaining: DEFAULT_SETTINGS.focus_duration * 60,

      // ── Interval helpers (single source of truth) ─────────────────────────────
      _startInterval: () => {
        // Guard: never create a second interval if one is already running.
        if (_intervalRef.id !== null) return
        _intervalRef.id = setInterval(
          () => usePomodoroStore.getState().tick(),
          1000
        )
      },

      _clearInterval: () => {
        if (_intervalRef.id !== null) {
          clearInterval(_intervalRef.id)
          _intervalRef.id = null
        }
      },

      // ── Start / Resume ────────────────────────────────────────────────────────
      start: () => {
        const {
          timerState,
          totalDuration,
          currentType,
          linkedTaskId,
          pausedElapsed,
          _startInterval,
        } = get()
        if (timerState === 'running') return

        const now = Date.now()
        const isFirstStart = timerState === 'idle'

        set(
          {
            timerState: 'running',
            startedAt: now,
            currentSessionId: isFirstStart
              ? generateId()
              : get().currentSessionId,
            sessionStartedAt: isFirstStart ? utcNow() : get().sessionStartedAt,
          },
          undefined,
          'start'
        )

        if (isFirstStart) {
          logger.debug(
            `[pomodoro] Started ${currentType} session (${totalDuration}s), task=${linkedTaskId ?? 'none'}`
          )
        } else {
          logger.debug(
            `[pomodoro] Resumed with ${pausedElapsed}s already elapsed`
          )
        }

        _startInterval()
      },

      // ── Pause ─────────────────────────────────────────────────────────────────
      pause: () => {
        const { timerState, startedAt, pausedElapsed, _clearInterval } = get()
        if (timerState !== 'running' || startedAt === null) return

        const elapsedNow = (Date.now() - startedAt) / 1000
        const newPausedElapsed = pausedElapsed + elapsedNow

        set(
          {
            timerState: 'paused',
            startedAt: null,
            pausedElapsed: newPausedElapsed,
          },
          undefined,
          'pause'
        )
        _clearInterval()
        logger.debug(
          `[pomodoro] Paused at ${newPausedElapsed.toFixed(1)}s elapsed`
        )
      },

      // ── Reset ─────────────────────────────────────────────────────────────────
      reset: () => {
        const { currentType, settings, _clearInterval } = get()
        const duration = durationForType(currentType, settings)
        set(
          {
            timerState: 'idle',
            startedAt: null,
            pausedElapsed: 0,
            timeRemaining: duration,
            totalDuration: duration,
            currentSessionId: null,
            sessionStartedAt: null,
          },
          undefined,
          'reset'
        )
        _clearInterval()
        logger.debug('[pomodoro] Reset')
      },

      // ── Skip ──────────────────────────────────────────────────────────────────
      skip: async () => {
        const {
          timerState,
          currentType,
          cyclesCompleted,
          settings,
          currentSessionId,
          sessionStartedAt,
          linkedTaskId,
          startedAt,
          pausedElapsed,
          _clearInterval,
        } = get()

        // Save aborted session if one was active
        if (currentSessionId && sessionStartedAt && timerState !== 'idle') {
          const elapsedSec = startedAt
            ? pausedElapsed + (Date.now() - startedAt) / 1000
            : pausedElapsed

          const abortedSession: PomodoroSession = {
            id: currentSessionId,
            type: currentType,
            duration_seconds: Math.round(elapsedSec),
            completed: false,
            task_id: linkedTaskId,
            started_at: sessionStartedAt,
            ended_at: utcNow(),
            created_at: sessionStartedAt,
          }
          try {
            await savePomodoroSession(abortedSession)
            set(
              state => ({
                todaySessions: [...state.todaySessions, abortedSession],
              }),
              undefined,
              'skip/saveAborted'
            )
          } catch {
            // non-fatal — skip proceeds regardless
          }
        }

        // Advance to next type
        const newCycles =
          currentType === 'focus' ? cyclesCompleted + 1 : cyclesCompleted
        const nextSessionType = nextType(
          currentType,
          cyclesCompleted,
          settings.pomos_until_long_break
        )
        const duration = durationForType(nextSessionType, settings)

        set(
          {
            currentType: nextSessionType,
            cyclesCompleted: newCycles,
            totalDuration: duration,
            timeRemaining: duration,
            timerState: 'idle',
            startedAt: null,
            pausedElapsed: 0,
            currentSessionId: null,
            sessionStartedAt: null,
          },
          undefined,
          'skip'
        )
        _clearInterval()
        logger.debug(`[pomodoro] Skipped to ${nextSessionType}`)
      },

      // ── Tick ──────────────────────────────────────────────────────────────────
      // Called every second by the internal interval.
      // Computes timeRemaining from timestamps — no drift.
      tick: () => {
        const { timerState, startedAt, pausedElapsed, totalDuration } = get()
        if (timerState !== 'running' || startedAt === null) return

        const elapsedSec = (Date.now() - startedAt) / 1000 + pausedElapsed
        const remaining = Math.max(0, Math.ceil(totalDuration - elapsedSec))

        set({ timeRemaining: remaining }, undefined, 'tick')

        if (remaining === 0) {
          // --- Double-completion guard ---
          // Set timerState to 'idle' synchronously BEFORE the async call so
          // any subsequent tick() invocations that still fire before the
          // interval is cleared will see timerState !== 'running' and exit
          // at the guard above.
          set({ timerState: 'idle' }, undefined, 'tick/completing')

          get()
            ._completeSession()
            .catch(err =>
              logger.error(`[pomodoro] completeSession error: ${String(err)}`)
            )
        }
      },

      // ── Complete Session ──────────────────────────────────────────────────────
      _completeSession: async () => {
        const {
          currentType,
          cyclesCompleted,
          settings,
          currentSessionId,
          sessionStartedAt,
          linkedTaskId,
          totalDuration,
          _startInterval,
          _clearInterval,
        } = get()

        if (!currentSessionId || !sessionStartedAt) return

        const newCycles =
          currentType === 'focus' ? cyclesCompleted + 1 : cyclesCompleted
        const nextSessionType = nextType(
          currentType,
          cyclesCompleted,
          settings.pomos_until_long_break
        )
        const nextDuration = durationForType(nextSessionType, settings)
        const endedAt = utcNow()

        const autoStart =
          nextSessionType === 'focus'
            ? settings.auto_start_focus
            : settings.auto_start_breaks

        const completedSession: PomodoroSession = {
          id: currentSessionId,
          type: currentType,
          duration_seconds: totalDuration,
          completed: true,
          task_id: linkedTaskId,
          started_at: sessionStartedAt,
          ended_at: endedAt,
          created_at: sessionStartedAt,
        }

        // Update state — timerState was already set to 'idle' by tick() above,
        // so we only override it when autoStart is true.
        set(
          state => ({
            timerState: autoStart ? 'running' : 'idle',
            currentType: nextSessionType,
            cyclesCompleted: newCycles,
            totalDuration: nextDuration,
            timeRemaining: nextDuration,
            startedAt: autoStart ? Date.now() : null,
            pausedElapsed: 0,
            currentSessionId: autoStart ? generateId() : null,
            sessionStartedAt: autoStart ? utcNow() : null,
            todaySessions: [...state.todaySessions, completedSession],
          }),
          undefined,
          '_completeSession'
        )

        // Interval management — single decision point:
        //   autoStart → keep/restart interval (clear first to avoid duplicates)
        //   !autoStart → ensure interval is cleared
        _clearInterval()
        if (autoStart) {
          _startInterval()
        }

        // Persist to SQLite
        try {
          await savePomodoroSession(completedSession)
        } catch (err) {
          logger.error(`[pomodoro] Failed to save session: ${String(err)}`)
        }

        logger.debug(
          `[pomodoro] Session completed: ${currentType} cycle ${newCycles}`
        )
      },

      // ── Link / Unlink task ────────────────────────────────────────────────────
      linkTask: (taskId: string) =>
        set({ linkedTaskId: taskId }, undefined, 'linkTask'),

      unlinkTask: () => set({ linkedTaskId: null }, undefined, 'unlinkTask'),

      // ── Settings ──────────────────────────────────────────────────────────────
      loadSettings: async () => {
        set({ isLoadingSettings: true }, undefined, 'loadSettings/start')
        try {
          const settings = await loadPomodoroSettings()
          const { currentType } = get()
          // Only update totalDuration/timeRemaining if timer is idle
          const duration = durationForType(currentType, settings)
          set(
            state => ({
              settings,
              isLoadingSettings: false,
              totalDuration:
                state.timerState === 'idle' ? duration : state.totalDuration,
              timeRemaining:
                state.timerState === 'idle' ? duration : state.timeRemaining,
            }),
            undefined,
            'loadSettings/done'
          )
        } catch (err) {
          logger.error(`Failed to load pomodoro settings: ${String(err)}`)
          set({ isLoadingSettings: false }, undefined, 'loadSettings/error')
        }
      },

      updateSettings: async (updates: Partial<PomodoroSettings>) => {
        const state = get()
        const newSettings = { ...state.settings, ...updates }

        let newDuration = state.totalDuration
        let newRemaining = state.timeRemaining

        // If timer is idle, update duration and timeRemaining dynamically based on new settings
        if (state.timerState === 'idle') {
          newDuration = durationForType(state.currentType, newSettings)
          newRemaining = newDuration
        }

        set(
          {
            settings: newSettings,
            totalDuration: newDuration,
            timeRemaining: newRemaining,
          },
          undefined,
          'updateSettings'
        )
        try {
          await savePomodoroSettings(newSettings)
        } catch (err) {
          logger.error(`Failed to save pomodoro settings: ${String(err)}`)
        }
      },

      // ── Sessions ──────────────────────────────────────────────────────────────
      loadTodaySessions: async () => {
        set({ isLoadingSessions: true }, undefined, 'loadTodaySessions/start')
        try {
          const sessions = await loadTodaySessions()
          set(
            { todaySessions: sessions, isLoadingSessions: false },
            undefined,
            'loadTodaySessions/done'
          )
        } catch (err) {
          logger.error(`Failed to load today's sessions: ${String(err)}`)
          set(
            { isLoadingSessions: false },
            undefined,
            'loadTodaySessions/error'
          )
        }
      },
    }),
    { name: 'pomodoro-store' }
  )
)

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { commands } from '@/lib/tauri-bindings'
import { DEFAULT_SETTINGS, usePomodoroStore } from './pomodoro-store'

vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    savePomodoroSession: vi
      .fn()
      .mockResolvedValue({ status: 'ok', data: null }),
    getPomodoroSettings: vi.fn().mockResolvedValue({
      status: 'ok',
      data: {
        focus_duration: 25,
        short_break_duration: 5,
        long_break_duration: 15,
        pomos_until_long_break: 4,
        auto_start_breaks: false,
        auto_start_focus: false,
        sound_notifications: false,
      },
    }),
    getTodaySessions: vi.fn().mockResolvedValue({ status: 'ok', data: [] }),
    savePomodoroSettings: vi
      .fn()
      .mockResolvedValue({ status: 'ok', data: null }),
  },
}))

describe('usePomodoroStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePomodoroStore.setState({
      timerState: 'idle',
      currentType: 'focus',
      totalDuration: DEFAULT_SETTINGS.focus_duration * 60,
      cyclesCompleted: 0,
      startedAt: null,
      pausedElapsed: 0,
      sessionStartedAt: null,
      currentSessionId: null,
      linkedTaskId: null,
      completionPrompt: null,
      settings: DEFAULT_SETTINGS,
      todaySessions: [],
      isLoadingSettings: false,
      isLoadingSessions: false,
      timeRemaining: DEFAULT_SETTINGS.focus_duration * 60,
    })
  })

  it('starts contextual focus with a linked task', async () => {
    const ok = await usePomodoroStore.getState().startContextualFocus('task-1')

    expect(ok).toBe(true)
    expect(usePomodoroStore.getState().linkedTaskId).toBe('task-1')
    expect(usePomodoroStore.getState().timerState).toBe('running')
  })

  it('opens a completion prompt after a focus session completes', async () => {
    usePomodoroStore.setState({
      timerState: 'idle',
      currentType: 'focus',
      totalDuration: 1500,
      cyclesCompleted: 0,
      currentSessionId: 'session-1',
      sessionStartedAt: '2026-06-02T12:00:00.000Z',
      linkedTaskId: 'task-9',
      settings: {
        ...DEFAULT_SETTINGS,
        sound_notifications: false,
      },
    })

    await usePomodoroStore.getState()._completeSession()

    expect(commands.savePomodoroSession).toHaveBeenCalled()
    expect(usePomodoroStore.getState().completionPrompt).toEqual({
      sessionId: 'session-1',
      taskId: 'task-9',
    })
  })
})

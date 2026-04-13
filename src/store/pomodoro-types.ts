export interface PomodoroSettings {
  focus_duration: number // minutes
  short_break_duration: number // minutes
  long_break_duration: number // minutes
  pomos_until_long_break: number
  auto_start_breaks: boolean
  auto_start_focus: boolean
  sound_notifications: boolean
}

export interface PomodoroSession {
  id: string
  session_type: 'focus' | 'short_break' | 'long_break'
  duration_seconds: number
  completed: boolean
  task_id: string | null
  started_at: string // ISO UTC
  ended_at?: string // ISO UTC, set when session ends
  created_at: string // ISO UTC
}

export type TimerState = 'idle' | 'running' | 'paused'
export type SessionType = 'focus' | 'short_break' | 'long_break'

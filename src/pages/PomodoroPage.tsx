import { useEffect, useRef, useCallback, useState } from 'react'
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  X,
  Plus,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  Coffee,
  Zap,
} from 'lucide-react'
import { usePomodoroStore } from '@/store/pomodoro-store'
import { useTasksStore, selectTodayTasks } from '@/store/tasks-store'
import type {
  PomodoroSession,
  PomodoroSettings,
  SessionType,
} from '@/store/pomodoro-types'
import { cn } from '@/lib/utils'
import { sendNotification } from '@tauri-apps/plugin-notification'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60)
  const s = Math.floor(Math.max(0, seconds) % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function typeLabel(type: SessionType): string {
  switch (type) {
    case 'focus':
      return 'Focus'
    case 'short_break':
      return 'Short Break'
    case 'long_break':
      return 'Long Break'
  }
}

function formatSessionTime(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (s === 0) return `${m}m`
  return `${m}m ${s}s`
}

// ─── Auto-Start Badge ─────────────────────────────────────────────────────────

/**
 * Shows a subtle indicator when the next session will start automatically.
 * Helps the user understand the timer behaviour without opening Settings.
 */
function AutoStartBadge({
  currentType,
  autoStartBreaks,
  autoStartFocus,
}: {
  currentType: SessionType
  autoStartBreaks: boolean
  autoStartFocus: boolean
}) {
  // Determine what will auto-start after the current session
  const nextWillAutoStart =
    currentType === 'focus' ? autoStartBreaks : autoStartFocus
  const nextLabel = currentType === 'focus' ? 'break' : 'focus'

  if (!nextWillAutoStart) return null

  return (
    <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
      <Zap className="size-3 shrink-0" strokeWidth={1.5} />
      <span>Next {nextLabel} starts automatically</span>
    </div>
  )
}

// ─── Cycle Dots Large ─────────────────────────────────────────────────────────

function CycleDotsLarge({
  completed,
  total,
}: {
  completed: number
  total: number
}) {
  const cyclePos = completed % total
  const dots = Array.from({ length: total }, (_, i) => ({
    filled: i < cyclePos || (completed > 0 && cyclePos === 0 && i < total),
  }))

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="flex items-center gap-1.5"
        aria-label={`${cyclePos || total} of ${total}`}
      >
        {dots.map((dot, i) => (
          <span
            key={i}
            className={cn(
              'size-2.5 rounded-full transition-all',
              dot.filled
                ? 'bg-foreground opacity-80'
                : 'border border-muted-foreground/30'
            )}
          />
        ))}
      </div>
      <span className="text-[11px] text-muted-foreground">
        {cyclePos || total} of {total} pomodoros
      </span>
    </div>
  )
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBarLarge({
  progress,
  type,
}: {
  progress: number
  type: SessionType
}) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          'h-full rounded-full transition-all duration-1000 ease-linear',
          type === 'focus' ? 'bg-foreground' : 'bg-muted-foreground/50'
        )}
        style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }}
      />
    </div>
  )
}

// ─── Task Link Section ────────────────────────────────────────────────────────

function TaskLinkSection() {
  const linkedTaskId = usePomodoroStore(state => state.linkedTaskId)
  const linkTask = usePomodoroStore(state => state.linkTask)
  const unlinkTask = usePomodoroStore(state => state.unlinkTask)

  const tasks = useTasksStore(state => state.tasks)
  const todayTasks = selectTodayTasks(tasks)
  const linkedTask = linkedTaskId
    ? tasks.find(t => t.id === linkedTaskId)
    : null

  const [showPicker, setShowPicker] = useState(false)
  const [search, setSearch] = useState('')
  const pickerRef = useRef<HTMLDivElement>(null)

  // Close picker on click outside
  useEffect(() => {
    if (!showPicker) return
    const handler = (e: MouseEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) {
        setShowPicker(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showPicker])

  const filtered = todayTasks.filter(
    t =>
      t.title.toLowerCase().includes(search.toLowerCase()) &&
      t.id !== linkedTaskId
  )

  return (
    <section className="space-y-2">
      <h2 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        Linked task
      </h2>

      {linkedTask ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
          <CheckCircle2
            className="size-4 shrink-0 text-muted-foreground/50"
            strokeWidth={1.5}
          />
          <span className="flex-1 truncate text-[13px]">
            {linkedTask.title}
          </span>
          <button
            type="button"
            onClick={unlinkTask}
            aria-label="Unlink task"
            className="rounded p-0.5 text-muted-foreground/50 transition-colors hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <div className="text-[13px] text-muted-foreground/50 italic px-1">
          No task linked
        </div>
      )}

      {/* Task picker */}
      <div className="relative" ref={pickerRef}>
        <button
          type="button"
          onClick={() => setShowPicker(v => !v)}
          className="flex items-center gap-1.5 text-[12px] text-muted-foreground/70 transition-colors hover:text-foreground"
        >
          <Plus className="size-3.5" />
          Link a task
        </button>

        {showPicker && (
          <div className="absolute top-full left-0 z-50 mt-1.5 w-72 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
            <div className="border-b border-border px-3 py-2">
              <input
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search tasks..."
                className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/50"
              />
            </div>
            <div className="max-h-48 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-[12px] text-muted-foreground/50">
                  No tasks found
                </div>
              ) : (
                filtered.slice(0, 10).map(task => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => {
                      linkTask(task.id)
                      setShowPicker(false)
                      setSearch('')
                    }}
                    className="w-full truncate px-3 py-2 text-start text-[13px] transition-colors hover:bg-accent"
                  >
                    {task.title}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

// ─── Session History ──────────────────────────────────────────────────────────

function SessionIcon({ type }: { type: SessionType }) {
  if (type === 'focus')
    return (
      <Clock className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
    )
  return <Coffee className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
}

function SessionHistorySection({ sessions }: { sessions: PomodoroSession[] }) {
  const tasks = useTasksStore(state => state.tasks)
  const completedFocus = sessions.filter(
    s => s.session_type === 'focus' && s.completed
  ).length

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          Today&apos;s sessions
        </h2>
        {completedFocus > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {completedFocus} {completedFocus === 1 ? 'pomo' : 'pomos'}
          </span>
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="py-4 text-center text-[12px] text-muted-foreground/50">
          No sessions today yet
        </div>
      ) : (
        <div className="space-y-0.5">
          {sessions.map(session => {
            const task = session.task_id
              ? tasks.find(t => t.id === session.task_id)
              : null

            return (
              <div
                key={session.id}
                className={cn(
                  'flex items-center gap-3 rounded-md px-2 py-1.5 text-[12px]',
                  !session.completed && 'bg-muted/40'
                )}
              >
                <SessionIcon type={session.session_type} />
                <span className="font-mono text-muted-foreground w-11 shrink-0">
                  {formatSessionTime(session.started_at)}
                </span>
                <span className="text-muted-foreground/70 shrink-0">
                  {typeLabel(session.session_type)}
                </span>
                <span className="text-muted-foreground/50 shrink-0">
                  {formatDuration(session.duration_seconds)}
                </span>
                {task && (
                  <span className="flex-1 truncate text-muted-foreground/60">
                    {task.title}
                  </span>
                )}
                {!session.completed && (
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/50 italic">
                    in progress
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ─── Settings Section ─────────────────────────────────────────────────────────

function NumberInput({
  value,
  onChange,
  min = 1,
  max = 120,
  label,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  label: string
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      aria-label={label}
      onChange={e => {
        const v = parseInt(e.target.value, 10)
        if (!isNaN(v) && v >= min && v <= max) onChange(v)
      }}
      className="w-14 rounded-md border border-border bg-background px-2 py-1 text-center text-[13px] tabular-nums outline-none focus:ring-1 focus:ring-ring"
    />
  )
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full transition-colors',
        checked ? 'bg-foreground' : 'bg-muted-foreground/30'
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0.5'
        )}
      />
    </button>
  )
}

function SettingsSection({
  settings,
  onUpdate,
}: {
  settings: PomodoroSettings
  onUpdate: (updates: Partial<PomodoroSettings>) => void
}) {
  const [open, setOpen] = useState(false)

  const rows: {
    label: string
    unit?: string
    type: 'number' | 'toggle'
    key: keyof PomodoroSettings
    min?: number
    max?: number
  }[] = [
    {
      label: 'Focus duration',
      unit: 'min',
      type: 'number',
      key: 'focus_duration',
      min: 1,
      max: 120,
    },
    {
      label: 'Short break',
      unit: 'min',
      type: 'number',
      key: 'short_break_duration',
      min: 1,
      max: 60,
    },
    {
      label: 'Long break',
      unit: 'min',
      type: 'number',
      key: 'long_break_duration',
      min: 1,
      max: 120,
    },
    {
      label: 'Pomos until long break',
      type: 'number',
      key: 'pomos_until_long_break',
      min: 1,
      max: 12,
    },
    { label: 'Auto-start breaks', type: 'toggle', key: 'auto_start_breaks' },
    { label: 'Auto-start focus', type: 'toggle', key: 'auto_start_focus' },
    {
      label: 'Sound notifications',
      type: 'toggle',
      key: 'sound_notifications',
    },
  ]

  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between text-[11px] font-medium uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
      >
        Settings
        {open ? (
          <ChevronUp className="size-3.5" />
        ) : (
          <ChevronDown className="size-3.5" />
        )}
      </button>

      {open && (
        <div className="space-y-2 rounded-lg border border-border bg-card px-4 py-3">
          {rows.map(row => (
            <div
              key={row.key}
              className="flex items-center justify-between gap-4"
            >
              <label className="text-[13px] text-foreground/80">
                {row.label}
              </label>
              <div className="flex items-center gap-1.5">
                {row.type === 'number' ? (
                  <>
                    <NumberInput
                      value={settings[row.key] as number}
                      onChange={v => onUpdate({ [row.key]: v })}
                      min={row.min}
                      max={row.max}
                      label={row.label}
                    />
                    {row.unit && (
                      <span className="text-[12px] text-muted-foreground">
                        {row.unit}
                      </span>
                    )}
                  </>
                ) : (
                  <Toggle
                    checked={settings[row.key] as boolean}
                    onChange={v => onUpdate({ [row.key]: v })}
                    label={row.label}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ─── Pomodoro Page ────────────────────────────────────────────────────────────

export function PomodoroPage() {
  const timerState = usePomodoroStore(state => state.timerState)
  const currentType = usePomodoroStore(state => state.currentType)
  const timeRemaining = usePomodoroStore(state => state.timeRemaining)
  const totalDuration = usePomodoroStore(state => state.totalDuration)
  const cyclesCompleted = usePomodoroStore(state => state.cyclesCompleted)
  const settings = usePomodoroStore(state => state.settings)
  const todaySessions = usePomodoroStore(state => state.todaySessions)

  const start = usePomodoroStore(state => state.start)
  const pause = usePomodoroStore(state => state.pause)
  const reset = usePomodoroStore(state => state.reset)
  const skip = usePomodoroStore(state => state.skip)
  const updateSettings = usePomodoroStore(state => state.updateSettings)
  const loadSettings = usePomodoroStore(state => state.loadSettings)
  const loadTodaySessions = usePomodoroStore(state => state.loadTodaySessions)

  const loadTasks = useTasksStore(state => state.loadTasks)

  // Track type changes for notification
  const prevTimerState = useRef(timerState)
  const prevType = useRef(currentType)

  useEffect(() => {
    loadSettings()
    loadTodaySessions()
    loadTasks()
  }, [loadSettings, loadTodaySessions, loadTasks])

  // Notifications on completion
  useEffect(() => {
    const justCompleted =
      prevTimerState.current === 'running' &&
      timerState !== 'running' &&
      prevType.current !== currentType

    if (justCompleted && settings.sound_notifications) {
      const wasBreak = prevType.current !== 'focus'
      void Promise.resolve(
        sendNotification({
          title: wasBreak ? 'Break is over' : 'Focus session complete!',
          body: wasBreak
            ? 'Ready to focus again?'
            : 'Time for a break. You earned it.',
        })
      ).catch(console.error)
    }

    prevTimerState.current = timerState
    prevType.current = currentType
  }, [timerState, currentType, settings.sound_notifications])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === ' ') {
        e.preventDefault()
        if (timerState === 'running') pause()
        else start()
      }
      if (e.key === 'r' || e.key === 'R') reset()
      if (e.key === 's' || e.key === 'S') void skip()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [timerState, start, pause, reset, skip])

  const isRunning = timerState === 'running'
  const progress = totalDuration > 0 ? 1 - timeRemaining / totalDuration : 0

  const handlePlayPause = useCallback(() => {
    if (isRunning) pause()
    else start()
  }, [isRunning, pause, start])

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Page header */}
      <div className="shrink-0 border-b border-border px-6 py-3">
        <h1 className="text-[13px] font-medium text-foreground">Focus</h1>
      </div>

      <div className="flex flex-col gap-8 px-6 py-6 max-w-lg mx-auto w-full">
        {/* ── Timer card ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-5 rounded-2xl border border-border bg-card px-8 py-8">
          {/* Type label */}
          <div className="flex items-center justify-between w-full">
            <span
              className={cn(
                'text-[11px] font-medium uppercase tracking-widest transition-colors',
                currentType === 'focus'
                  ? 'text-foreground/70'
                  : 'text-muted-foreground'
              )}
            >
              {typeLabel(currentType)}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Space to start · S to skip · R to reset
            </span>
          </div>

          {/* Time display */}
          <div
            className={cn(
              'flex items-center justify-center transition-opacity',
              timerState === 'idle' && 'opacity-50'
            )}
          >
            <span
              className={cn(
                'font-mono tracking-tighter tabular-nums transition-colors',
                currentType === 'focus'
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              )}
              style={{ fontSize: '80px', fontWeight: 200, lineHeight: 1 }}
              aria-label={`${formatTime(timeRemaining)} remaining`}
              aria-live="polite"
              aria-atomic="true"
            >
              {formatTime(timeRemaining)}
            </span>
          </div>

          {/* Progress bar */}
          <ProgressBarLarge progress={progress} type={currentType} />

          {/* Cycle dots */}
          <CycleDotsLarge
            completed={cyclesCompleted}
            total={settings.pomos_until_long_break}
          />

          {/* Controls */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={reset}
              aria-label="Reset timer (R)"
              className="rounded-lg p-2 text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
            >
              <RotateCcw className="size-4" />
            </button>

            <button
              type="button"
              onClick={handlePlayPause}
              aria-label={
                isRunning ? 'Pause timer (Space)' : 'Start timer (Space)'
              }
              className={cn(
                'flex size-12 items-center justify-center rounded-full transition-all',
                isRunning
                  ? 'bg-foreground text-background shadow-md hover:bg-foreground/80'
                  : 'bg-foreground/10 text-foreground hover:bg-foreground/20'
              )}
            >
              {isRunning ? (
                <Pause className="size-5" fill="currentColor" />
              ) : (
                <Play className="size-5 translate-x-px" fill="currentColor" />
              )}
            </button>

            <button
              type="button"
              onClick={() => void skip()}
              aria-label="Skip interval (S)"
              className="rounded-lg p-2 text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
            >
              <SkipForward className="size-4" />
            </button>
          </div>

          {/* Auto-start indicator */}
          <AutoStartBadge
            currentType={currentType}
            autoStartBreaks={settings.auto_start_breaks}
            autoStartFocus={settings.auto_start_focus}
          />
        </div>

        {/* ── Divider ──────────────────────────────────────────────────────────── */}
        <div className="h-px bg-border" />

        {/* ── Task link ────────────────────────────────────────────────────────── */}
        <TaskLinkSection />

        {/* ── Divider ──────────────────────────────────────────────────────────── */}
        <div className="h-px bg-border" />

        {/* ── Session history ───────────────────────────────────────────────────── */}
        <SessionHistorySection sessions={todaySessions} />

        {/* ── Divider ──────────────────────────────────────────────────────────── */}
        <div className="h-px bg-border" />

        {/* ── Settings ─────────────────────────────────────────────────────────── */}
        <SettingsSection settings={settings} onUpdate={updateSettings} />

        {/* Bottom padding */}
        <div className="h-4" />
      </div>
    </div>
  )
}

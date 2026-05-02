import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
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
  Settings2,
} from 'lucide-react'
import { usePomodoroStore } from '@/store/pomodoro-store'
import { useTasksStore, selectTodayTasks } from '@/store/tasks-store'
import type {
  PomodoroSession,
  PomodoroSettings,
  SessionType,
} from '@/store/pomodoro-types'
import { cn } from '@/lib/utils'
import { LazyMotion, domAnimation, m } from 'motion/react'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60)
  const s = Math.floor(Math.max(0, seconds) % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function typeLabel(type: SessionType, t: (k: string) => string): string {
  switch (type) {
    case 'focus':
      return t('pomodoro.session.focus')
    case 'short_break':
      return t('pomodoro.session.shortBreak')
    case 'long_break':
      return t('pomodoro.session.longBreak')
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

function AutoStartBadge({
  currentType,
  autoStartBreaks,
  autoStartFocus,
}: {
  currentType: SessionType
  autoStartBreaks: boolean
  autoStartFocus: boolean
}) {
  const { t } = useTranslation()
  const nextWillAutoStart =
    currentType === 'focus' ? autoStartBreaks : autoStartFocus
  const nextType =
    currentType === 'focus'
      ? t('pomodoro.session.shortBreak')
      : t('pomodoro.session.focus')

  if (!nextWillAutoStart) return null

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
      <Zap className="size-3 shrink-0 text-amber-500" strokeWidth={2} />
      <span>{t('pomodoro.autoStart', { type: nextType })}</span>
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
  const { t } = useTranslation()
  const cyclePos = completed % total
  const dots = Array.from({ length: total }, (_, i) => ({
    id: `cycle-dot-${total}-${i}`,
    filled: i < cyclePos || (completed > 0 && cyclePos === 0 && i < total),
  }))

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="flex items-center gap-2"
        aria-label={`${cyclePos || total} of ${total}`}
      >
        {dots.map(dot => (
          <m.div
            key={dot.id}
            initial={false}
            animate={{
              scale: dot.filled ? 1 : 0.85,
              opacity: dot.filled ? 1 : 0.3,
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className={cn(
              'size-2.5 rounded-full',
              dot.filled ? 'bg-primary shadow-sm' : 'bg-muted-foreground'
            )}
          />
        ))}
      </div>
      <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/60">
        {t('pomodoro.cycleLabel', { current: cyclePos || total, total })}
      </span>
    </div>
  )
}

// ─── Task Link Section ────────────────────────────────────────────────────────

function TaskLinkSection() {
  const { t } = useTranslation()
  const linkedTaskId = usePomodoroStore(state => state.linkedTaskId)
  const linkTask = usePomodoroStore(state => state.linkTask)
  const unlinkTask = usePomodoroStore(state => state.unlinkTask)

  const tasks = useTasksStore(state => state.tasks)
  const todayTasks = selectTodayTasks(tasks)
  const linkedTask = linkedTaskId
    ? tasks.find(task => task.id === linkedTaskId)
    : null

  const [showPicker, setShowPicker] = useState(false)
  const [search, setSearch] = useState('')
  const pickerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

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

  const filtered = useMemo(
    () =>
      todayTasks.filter(
        task =>
          task.title.toLowerCase().includes(search.toLowerCase()) &&
          task.id !== linkedTaskId
      ),
    [todayTasks, search, linkedTaskId]
  )

  return (
    <section className="space-y-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
        {t('pomodoro.linkedTask.heading')}
      </h2>

      {linkedTask ? (
        <div className="group flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 p-3 shadow-sm backdrop-blur transition-all hover:border-border hover:shadow-md">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="size-3.5" strokeWidth={2.5} />
          </div>
          <span className="flex-1 truncate text-sm font-medium">
            {linkedTask.title}
          </span>
          <button
            type="button"
            onClick={unlinkTask}
            aria-label="Unlink task"
            className="flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground opacity-0 transition-all hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground/50 italic px-1">
          {t('pomodoro.linkedTask.none')}
        </div>
      )}

      {/* Task picker */}
      <div className="relative" ref={pickerRef}>
        <button
          type="button"
          onClick={() => {
            setShowPicker(prev => {
              const next = !prev
              if (!prev) {
                requestAnimationFrame(() => searchInputRef.current?.focus())
              }
              return next
            })
          }}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Plus className="size-3.5" />
          {t('pomodoro.linkedTask.linkButton')}
        </button>

        {showPicker && (
          <div className="absolute left-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-popover shadow-xl animate-in fade-in zoom-in-95">
            <div className="border-b border-border/50 bg-muted/20 px-3 py-2.5">
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('pomodoro.linkedTask.searchPlaceholder')}
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
              />
            </div>
            <div className="max-h-56 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted-foreground/50">
                  {t('pomodoro.linkedTask.noResults')}
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
                    className="flex w-full items-center px-4 py-2.5 text-start text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <span className="truncate">{task.title}</span>
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
    return <Clock className="size-4 text-primary" strokeWidth={2} />
  return <Coffee className="size-4 text-blue-500" strokeWidth={2} />
}

function SessionHistorySection({ sessions }: { sessions: PomodoroSession[] }) {
  const { t } = useTranslation()
  const tasks = useTasksStore(state => state.tasks)
  const completedFocus = sessions.filter(
    s => s.session_type === 'focus' && s.completed
  ).length

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          {t('pomodoro.history.heading')}
        </h2>
        {completedFocus > 0 && (
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
            {t('pomodoro.history.pomosCount', { count: completedFocus })}
          </span>
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 py-8 text-center">
          <Clock className="mb-2 size-6 text-muted-foreground/30" />
          <span className="text-sm text-muted-foreground/60">
            {t('pomodoro.history.empty')}
          </span>
        </div>
      ) : (
        <div className="grid gap-2">
          {sessions.map(session => {
            const task = session.task_id
              ? tasks.find(task => task.id === session.task_id)
              : null

            return (
              <div
                key={session.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors',
                  session.completed
                    ? 'border-border/50 bg-card/50 shadow-sm'
                    : 'border-dashed border-border/40 bg-muted/20 opacity-80'
                )}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent">
                  <SessionIcon type={session.session_type} />
                </div>
                <div className="flex flex-1 flex-col overflow-hidden">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {typeLabel(session.session_type, t)}
                    </span>
                    <span className="text-xs text-muted-foreground/60">
                      • {formatDuration(session.duration_seconds)}
                    </span>
                  </div>
                  {task && (
                    <span className="truncate text-xs text-muted-foreground">
                      {task.title}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                  <span className="font-mono text-xs font-medium text-muted-foreground/80">
                    {formatSessionTime(session.started_at)}
                  </span>
                  {!session.completed && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-500">
                      {t('pomodoro.history.inProgress')}
                    </span>
                  )}
                </div>
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
      className="w-16 rounded-lg border border-border bg-background/50 px-2.5 py-1.5 text-center text-sm font-medium tabular-nums shadow-inner outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
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
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-muted-foreground/30'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block size-5 rounded-full bg-background shadow-sm ring-0 transition-transform duration-200 ease-in-out',
          checked ? 'translate-x-5' : 'translate-x-0'
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
  const { t } = useTranslation()
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
      label: t('pomodoro.settings.focusDuration'),
      unit: t('pomodoro.settings.unitMin'),
      type: 'number',
      key: 'focus_duration',
      min: 1,
      max: 120,
    },
    {
      label: t('pomodoro.settings.shortBreak'),
      unit: t('pomodoro.settings.unitMin'),
      type: 'number',
      key: 'short_break_duration',
      min: 1,
      max: 60,
    },
    {
      label: t('pomodoro.settings.longBreak'),
      unit: t('pomodoro.settings.unitMin'),
      type: 'number',
      key: 'long_break_duration',
      min: 1,
      max: 120,
    },
    {
      label: t('pomodoro.settings.pomosUntilLongBreak'),
      type: 'number',
      key: 'pomos_until_long_break',
      min: 1,
      max: 12,
    },
    {
      label: t('pomodoro.settings.autoStartBreaks'),
      type: 'toggle',
      key: 'auto_start_breaks',
    },
    {
      label: t('pomodoro.settings.autoStartFocus'),
      type: 'toggle',
      key: 'auto_start_focus',
    },
    {
      label: t('pomodoro.settings.soundNotifications'),
      type: 'toggle',
      key: 'sound_notifications',
    },
  ]

  return (
    <section className="space-y-4">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="group flex w-full items-center justify-between rounded-xl border border-transparent px-2 py-2 transition-colors hover:border-border/50 hover:bg-card/30"
      >
        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 transition-colors group-hover:text-foreground">
          <Settings2 className="size-4" />
          {t('pomodoro.settings.heading')}
        </span>
        <div className="rounded-full bg-muted/50 p-1 transition-colors group-hover:bg-muted group-hover:text-foreground">
          {open ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {open && (
        <div className="grid gap-1 rounded-2xl border border-border/50 bg-card/30 p-2 shadow-sm animate-in fade-in slide-in-from-top-2">
          {rows.map(row => (
            <div
              key={row.key}
              className="flex items-center justify-between gap-4 rounded-xl px-4 py-3 transition-colors hover:bg-card/80"
            >
              <label className="text-sm font-medium text-foreground/80">
                {row.label}
              </label>
              <div className="flex items-center gap-2">
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
                      <span className="w-8 text-xs font-medium text-muted-foreground">
                        {row.unit}
                      </span>
                    )}
                  </>
                ) : (
                  <div className="flex h-8 items-center pr-2">
                    <Toggle
                      checked={settings[row.key] as boolean}
                      onChange={v => onUpdate({ [row.key]: v })}
                      label={row.label}
                    />
                  </div>
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

  const { t } = useTranslation()

  useEffect(() => {
    loadSettings()
    loadTodaySessions()
    loadTasks()
  }, [loadSettings, loadTodaySessions, loadTasks])

  // Request notification permissions on mount
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const { isPermissionGranted, requestPermission } =
          await import('@tauri-apps/plugin-notification')
        let granted = await isPermissionGranted()
        if (!granted) {
          const permission = await requestPermission()
          granted = permission === 'granted'
        }
      } catch (err) {
        console.error('Failed to check notification permissions:', err)
      }
    }
    void checkPermissions()
  }, [])

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
    <LazyMotion features={domAnimation}>
      <div className="flex h-full flex-col overflow-y-auto bg-background/50">
        {/* Page header */}
        <div className="sticky top-0 z-10 shrink-0 border-b border-border/50 bg-background/80 px-8 py-4 backdrop-blur-md">
          <h1 className="text-sm font-semibold tracking-wide text-foreground">
            {t('pomodoro.pageTitle')}
          </h1>
        </div>

        <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-6 py-10">
          {/* ── Timer card ──────────────────────────────────────────────────────── */}
          <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-[2.5rem] border border-border/60 bg-card/60 p-10 shadow-2xl backdrop-blur-xl">
            {/* Background glow when running */}
            {isRunning && currentType === 'focus' && (
              <m.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background/0 to-background/0"
              />
            )}

            {/* Top labels */}
            <div className="mb-8 flex w-full items-center justify-between">
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest transition-colors',
                  currentType === 'focus'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-blue-500/10 text-blue-500'
                )}
              >
                {typeLabel(currentType, t)}
              </span>
              <span className="text-[11px] font-medium text-muted-foreground/60">
                {t('pomodoro.hint')}
              </span>
            </div>

            {/* Time display */}
            <div className="relative mb-10 flex w-full items-center justify-center">
              <m.div
                animate={
                  isRunning && currentType === 'focus'
                    ? { scale: [1, 1.01, 1] }
                    : { scale: 1 }
                }
                transition={
                  isRunning && currentType === 'focus'
                    ? { duration: 4, ease: 'easeInOut', repeat: Infinity }
                    : { duration: 0.3 }
                }
                className={cn(
                  'font-mono tabular-nums tracking-tighter transition-all duration-500',
                  currentType === 'focus'
                    ? 'text-foreground'
                    : 'text-muted-foreground/80',
                  'text-[100px] leading-none sm:text-[130px] md:text-[150px]',
                  !isRunning && 'opacity-70'
                )}
                style={{
                  textShadow:
                    isRunning && currentType === 'focus'
                      ? '0 0 80px rgba(var(--foreground), 0.15)'
                      : 'none',
                }}
              >
                <span
                  aria-label={t('pomodoro.controls.timeRemaining', {
                    time: formatTime(timeRemaining),
                  })}
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {formatTime(timeRemaining)}
                </span>
              </m.div>
            </div>

            {/* Cycle dots & Auto start indicator */}
            <div className="mb-10 flex w-full flex-col items-center gap-4">
              <CycleDotsLarge
                completed={cyclesCompleted}
                total={settings.pomos_until_long_break}
              />
              <AutoStartBadge
                currentType={currentType}
                autoStartBreaks={settings.auto_start_breaks}
                autoStartFocus={settings.auto_start_focus}
              />
            </div>

            {/* Controls */}
            <div className="flex w-full items-center justify-center gap-8">
              <m.button
                type="button"
                onClick={reset}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                aria-label={t('pomodoro.controls.resetAria')}
                className="group flex size-12 items-center justify-center rounded-full bg-secondary/50 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <RotateCcw
                  className="size-5 transition-transform group-hover:-rotate-45"
                  strokeWidth={2}
                />
              </m.button>

              <m.button
                type="button"
                onClick={handlePlayPause}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label={
                  isRunning
                    ? t('pomodoro.controls.pauseAria', {
                        defaultValue: 'Pause',
                      })
                    : t('pomodoro.controls.startAria', {
                        defaultValue: 'Start',
                      })
                }
                className={cn(
                  'flex size-20 items-center justify-center rounded-full shadow-xl transition-all duration-300',
                  isRunning
                    ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-secondary/20'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-primary/30'
                )}
              >
                {isRunning ? (
                  <Pause className="ml-0.5 size-8" strokeWidth={2.5} />
                ) : (
                  <Play className="ml-1.5 size-8" strokeWidth={2.5} />
                )}
              </m.button>

              <m.button
                type="button"
                onClick={() => void skip()}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                aria-label={t('pomodoro.controls.skipAria')}
                className="group flex size-12 items-center justify-center rounded-full bg-secondary/50 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <SkipForward
                  className="size-5 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={2}
                />
              </m.button>
            </div>

            {/* Progress bar positioned at bottom of card */}
            <div className="absolute inset-x-0 bottom-0">
              <div
                className="h-1.5 w-full bg-border/40"
                role="progressbar"
                aria-valuenow={Math.round(progress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={cn(
                    'h-full transition-all duration-1000 ease-linear',
                    currentType === 'focus' ? 'bg-primary' : 'bg-blue-500'
                  )}
                  style={{
                    width: `${Math.max(0, Math.min(100, progress * 100))}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-10 lg:grid-cols-2">
            <div className="space-y-10">
              {/* ── Task link ────────────────────────────────────────────────────────── */}
              <TaskLinkSection />

              {/* ── Settings ─────────────────────────────────────────────────────────── */}
              <SettingsSection settings={settings} onUpdate={updateSettings} />
            </div>

            {/* ── Session history ───────────────────────────────────────────────────── */}
            <div>
              <SessionHistorySection sessions={todaySessions} />
            </div>
          </div>

          {/* Bottom padding */}
          <div className="h-10" />
        </div>
      </div>
    </LazyMotion>
  )
}

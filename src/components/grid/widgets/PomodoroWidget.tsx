import { useEffect, useRef, useCallback } from 'react'
import { Timer, Play, Pause, SkipForward, RotateCcw, Link2 } from 'lucide-react'
import { WidgetCard } from '../WidgetCard'
import { usePomodoroStore } from '@/store/pomodoro-store'
import { useTasksStore } from '@/store/tasks-store'
import { cn } from '@/lib/utils'
import { sendNotification } from '@tauri-apps/plugin-notification'

// ─── Format helpers ───────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60)
  const s = Math.floor(Math.max(0, seconds) % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function typeLabel(type: 'focus' | 'short_break' | 'long_break'): string {
  switch (type) {
    case 'focus':
      return 'Focus'
    case 'short_break':
      return 'Short Break'
    case 'long_break':
      return 'Long Break'
  }
}

// ─── Cycle Dots ────────────────────────────────────────────────────────────────

function CycleDots({
  completed,
  total,
  compact = false,
}: {
  completed: number
  total: number
  compact?: boolean
}) {
  const dots = Array.from(
    { length: total },
    (_, i) =>
      i < completed % total ||
      (completed > 0 && completed % total === 0 && i < total)
  )

  return (
    <div
      className="flex items-center gap-[3px]"
      aria-label={`${completed % total || total} of ${total} pomodoros completed`}
    >
      {dots.map((filled, i) => (
        <span
          key={i}
          className={cn(
            'rounded-full transition-all',
            compact ? 'size-1.5' : 'size-2',
            filled
              ? 'bg-foreground opacity-80'
              : 'border border-muted-foreground/30'
          )}
        />
      ))}
    </div>
  )
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({
  progress,
  type,
}: {
  progress: number
  type: 'focus' | 'short_break' | 'long_break'
}) {
  return (
    <div className="h-[3px] w-full overflow-hidden rounded-full bg-muted">
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

// ─── Pomodoro Widget ──────────────────────────────────────────────────────────

interface PomodoroWidgetProps {
  onNavigateToPomodoro?: () => void
}

export function PomodoroWidget({ onNavigateToPomodoro }: PomodoroWidgetProps) {
  const timerState = usePomodoroStore(state => state.timerState)
  const currentType = usePomodoroStore(state => state.currentType)
  const timeRemaining = usePomodoroStore(state => state.timeRemaining)
  const totalDuration = usePomodoroStore(state => state.totalDuration)
  const cyclesCompleted = usePomodoroStore(state => state.cyclesCompleted)
  const linkedTaskId = usePomodoroStore(state => state.linkedTaskId)
  const settings = usePomodoroStore(state => state.settings)

  const start = usePomodoroStore(state => state.start)
  const pause = usePomodoroStore(state => state.pause)
  const reset = usePomodoroStore(state => state.reset)
  const skip = usePomodoroStore(state => state.skip)
  const loadSettings = usePomodoroStore(state => state.loadSettings)
  const loadTodaySessions = usePomodoroStore(state => state.loadTodaySessions)

  const tasks = useTasksStore(state => state.tasks)
  const linkedTask = linkedTaskId
    ? tasks.find(t => t.id === linkedTaskId)
    : null

  // Track previous timerState to detect completion
  const prevTimerState = useRef(timerState)
  const prevType = useRef(currentType)

  // Load settings on mount (only once globally — safe to call multiple times)
  useEffect(() => {
    loadSettings()
    loadTodaySessions()
  }, [loadSettings, loadTodaySessions])

  // Fire notification when session completes (type changes or cycles increment)
  const notifyRef = useRef(false)
  useEffect(() => {
    const justCompleted =
      prevTimerState.current === 'running' &&
      timerState !== 'running' &&
      prevType.current !== currentType

    if (justCompleted && !notifyRef.current && settings.sound_notifications) {
      notifyRef.current = true
      const wasBreak = prevType.current !== 'focus'
      void Promise.resolve(
        sendNotification({
          title: wasBreak ? 'Break is over' : 'Focus session complete!',
          body: wasBreak
            ? 'Ready to focus again?'
            : 'Time for a break. You earned it.',
        })
      ).catch(console.error)
      setTimeout(() => {
        notifyRef.current = false
      }, 2000)
    }

    prevTimerState.current = timerState
    prevType.current = currentType
  }, [timerState, currentType, settings.sound_notifications])

  const isRunning = timerState === 'running'
  const progress = totalDuration > 0 ? 1 - timeRemaining / totalDuration : 0

  const handlePlayPause = useCallback(() => {
    if (isRunning) pause()
    else start()
  }, [isRunning, pause, start])

  return (
    <WidgetCard title="Focus" icon={Timer} onClick={onNavigateToPomodoro}>
      <div className="flex h-full flex-col gap-3">
        {/* State label + cycle dots */}
        <div className="flex items-center justify-between px-0.5">
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
          <CycleDots
            completed={cyclesCompleted}
            total={settings.pomos_until_long_break}
            compact
          />
        </div>

        {/* Timer display */}
        <div
          className={cn(
            'flex items-center justify-center transition-opacity',
            timerState === 'idle' && 'opacity-60'
          )}
        >
          <span
            className={cn(
              'font-mono tracking-tighter tabular-nums transition-colors',
              currentType === 'focus'
                ? 'text-foreground'
                : 'text-muted-foreground'
            )}
            style={{ fontSize: '42px', fontWeight: 200, lineHeight: 1 }}
            aria-label={`${formatTime(timeRemaining)} remaining`}
          >
            {formatTime(timeRemaining)}
          </span>
        </div>

        {/* Progress bar */}
        <ProgressBar progress={progress} type={currentType} />

        {/* Controls */}
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              reset()
            }}
            aria-label="Reset timer"
            className="rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
          </button>

          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              handlePlayPause()
            }}
            aria-label={isRunning ? 'Pause timer' : 'Start timer'}
            className={cn(
              'flex size-8 items-center justify-center rounded-full transition-all',
              isRunning
                ? 'bg-foreground text-background hover:bg-foreground/80'
                : 'bg-foreground/10 text-foreground hover:bg-foreground/20'
            )}
          >
            {isRunning ? (
              <Pause className="size-3.5" fill="currentColor" />
            ) : (
              <Play className="size-3.5 translate-x-px" fill="currentColor" />
            )}
          </button>

          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              void skip().catch(console.error)
            }}
            aria-label="Skip to next interval"
            className="rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
          >
            <SkipForward className="size-3.5" />
          </button>
        </div>

        {/* Linked task */}
        <div
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors',
            linkedTask ? 'bg-muted/60' : 'border border-dashed border-border/50'
          )}
        >
          <Link2 className="size-3 shrink-0 text-muted-foreground/50" />
          <span
            className={cn(
              'flex-1 truncate text-[11px] leading-tight',
              linkedTask ? 'text-foreground/80' : 'text-muted-foreground/50'
            )}
          >
            {linkedTask ? linkedTask.title : 'No task selected'}
          </span>
        </div>
      </div>
    </WidgetCard>
  )
}

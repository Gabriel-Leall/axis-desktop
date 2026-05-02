import { useEffect, useRef, useCallback } from 'react'
import { Timer, Play, Pause, SkipForward, RotateCcw, Link2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { WidgetCard } from '../WidgetCard'
import { usePomodoroStore } from '@/store/pomodoro-store'
import { useTasksStore } from '@/store/tasks-store'
import { cn } from '@/lib/utils'
import { sendNotification } from '@tauri-apps/plugin-notification'
import {
  formatTime,
  normalizeCycleTotal,
  getCycleProgress,
} from './pomodoro-widget.utils'

// ─── Cycle Dots ────────────────────────────────────────────────────────────────

function CycleDots({
  completed,
  total,
  compact = false,
  ariaLabel,
}: {
  completed: number
  total: number
  compact?: boolean
  ariaLabel: string
}) {
  const safeTotal = normalizeCycleTotal(total)

  const dots = Array.from(
    { length: safeTotal },
    (_, i) =>
      i < completed % safeTotal ||
      (completed > 0 && completed % safeTotal === 0 && i < safeTotal)
  )

  return (
    <div className="flex items-center gap-0.75" aria-label={ariaLabel}>
      {dots.map((filled, i) => (
        <span
          key={i}
          className={cn(
            'rounded-full transition-all',
            compact ? 'size-1.5' : 'size-2',
            filled ? 'bg-foreground/50' : 'bg-muted-foreground/25'
          )}
        />
      ))}
    </div>
  )
}

// ─── Pomodoro Widget ──────────────────────────────────────────────────────────

interface PomodoroWidgetProps {
  onNavigateToPomodoro?: () => void
}
export function PomodoroWidget({ onNavigateToPomodoro }: PomodoroWidgetProps) {
  const { t } = useTranslation()

  const timerState = usePomodoroStore(state => state.timerState)
  const currentType = usePomodoroStore(state => state.currentType)
  const timeRemaining = usePomodoroStore(state => state.timeRemaining)
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
  const cycleTotal = normalizeCycleTotal(settings.pomos_until_long_break)

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
          title: wasBreak
            ? t('widgets.pomodoro.notification.breakOverTitle')
            : t('widgets.pomodoro.notification.focusCompleteTitle'),
          body: wasBreak
            ? t('widgets.pomodoro.notification.breakOverBody')
            : t('widgets.pomodoro.notification.focusCompleteBody'),
        })
      ).catch(() => {
        // Keep timer flow resilient if native notification fails.
      })
      setTimeout(() => {
        notifyRef.current = false
      }, 2000)
    }

    prevTimerState.current = timerState
    prevType.current = currentType
  }, [timerState, currentType, settings.sound_notifications, t])

  const isRunning = timerState === 'running'
  const cycleProgress = getCycleProgress(cyclesCompleted, cycleTotal)
  const cycleAriaLabel = t('widgets.pomodoro.cycleProgress', {
    completed: cycleProgress,
    total: cycleTotal,
  })

  const handlePlayPause = useCallback(() => {
    if (isRunning) pause()
    else start()
  }, [isRunning, pause, start])

  return (
    <WidgetCard
      title={t('widgets.pomodoro.title')}
      icon={Timer}
      onClick={onNavigateToPomodoro}
    >
      <div className="flex h-full flex-col items-center justify-center">
        {/* Cycle dots */}
        <div className="mb-2 flex items-center justify-center">
          <CycleDots
            completed={cyclesCompleted}
            total={cycleTotal}
            compact
            ariaLabel={cycleAriaLabel}
          />
        </div>

        {/* Linked task */}
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
          }}
          className="flex items-center gap-1.5 rounded-full bg-muted px-4 py-1.5 transition-colors hover:bg-accent"
        >
          <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="max-w-[140px] truncate text-sm text-muted-foreground transition-colors hover:text-foreground">
            {linkedTask
              ? linkedTask.title
              : t('widgets.pomodoro.noTaskSelected')}
          </span>
        </button>

        {/* Timer display */}
        <div className="my-6 flex items-center justify-center">
          <span className="text-foreground tabular-nums tracking-tight text-6xl font-bold">
            {formatTime(timeRemaining)}
          </span>
        </div>

        {/* Controls */}
        <div className="flex w-full items-center justify-center gap-6">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            type="button"
            onClick={e => {
              e.stopPropagation()
              reset()
            }}
            aria-label={t('widgets.pomodoro.resetAria')}
            className="p-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <RotateCcw className="size-5" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={e => {
              e.stopPropagation()
              handlePlayPause()
            }}
            aria-label={
              isRunning
                ? t('widgets.pomodoro.pauseAria')
                : t('widgets.pomodoro.startAria')
            }
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex size-16 items-center justify-center rounded-full shadow-lg transition-all"
          >
            {isRunning ? (
              <Pause className="size-7" fill="currentColor" />
            ) : (
              <Play className="size-7 translate-x-0.5" fill="currentColor" />
            )}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            type="button"
            onClick={e => {
              e.stopPropagation()
              void skip().catch(console.error)
            }}
            aria-label={t('widgets.pomodoro.skipAria')}
            className="p-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <SkipForward className="size-5" />
          </motion.button>
        </div>
      </div>
    </WidgetCard>
  )
}

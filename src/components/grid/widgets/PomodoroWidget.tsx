import { useEffect, useRef, useCallback } from 'react'
import { Timer, Play, Pause, SkipForward, RotateCcw, Link2 } from 'lucide-react'
import { motion } from 'motion/react'
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
      className="flex items-center gap-0.75"
      aria-label={`${completed % total || total} of ${total} pomodoros completed`}
    >
      {dots.map((filled, i) => (
        <span
          key={i}
          className={cn(
            'rounded-full transition-all',
            compact ? 'size-1.5' : 'size-2',
            filled
              ? 'bg-neutral-500 dark:bg-neutral-400'
              : 'bg-neutral-200 dark:bg-neutral-700'
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

  const handlePlayPause = useCallback(() => {
    if (isRunning) pause()
    else start()
  }, [isRunning, pause, start])

  return (
    <WidgetCard title="Focus" icon={Timer} onClick={onNavigateToPomodoro}>
      <div className="flex h-full flex-col items-center justify-center">
        {/* Cycle dots */}
        <div className="mb-2 flex items-center justify-center">
          <CycleDots
            completed={cyclesCompleted}
            total={settings.pomos_until_long_break}
            compact
          />
        </div>

        {/* Linked task */}
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
          }}
          className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-4 py-1.5 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
        >
          <Link2 className="size-3.5 shrink-0 text-neutral-500 dark:text-neutral-400" />
          <span className="max-w-[140px] truncate text-sm text-neutral-500 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200">
            {linkedTask ? linkedTask.title : 'No task selected'}
          </span>
        </button>

        {/* Timer display */}
        <div className="my-6 flex items-center justify-center">
          <span className="tabular-nums tracking-tight text-6xl font-bold text-neutral-900 dark:text-white">
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
            aria-label="Reset timer"
            className="p-2 text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-white"
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
            aria-label={isRunning ? 'Pause timer' : 'Start timer'}
            className="flex size-16 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg transition-all hover:bg-orange-600"
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
            aria-label="Skip to next interval"
            className="p-2 text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-white"
          >
            <SkipForward className="size-5" />
          </motion.button>
        </div>
      </div>
    </WidgetCard>
  )
}

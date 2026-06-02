import { useEffect, useState } from 'react'
import {
  Check,
  CheckSquare2,
  ChevronDown,
  Play,
  RefreshCcw,
  Sparkles,
  Sunrise,
  Sunset,
  SunMedium,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { notifications } from '@/lib/notifications'
import { getDailyAxisPeriod } from '@/lib/daily-axis-banner-domain'
import { cn } from '@/lib/utils'
import { useDailyPlanStore } from '@/store/daily-plan-store'
import { usePomodoroStore } from '@/store/pomodoro-store'
import { useTasksStore } from '@/store/tasks-store'
import { useUIStore } from '@/store/ui-store'

function greetingKey(period: ReturnType<typeof getDailyAxisPeriod>) {
  if (period === 'morning') return 'dailyAxis.goodMorning'
  if (period === 'afternoon') return 'dailyAxis.goodAfternoon'
  return 'dailyAxis.goodEvening'
}

export function DailyAxisBanner() {
  const { t } = useTranslation()
  const [selectorOpen, setSelectorOpen] = useState(false)

  const tasks = useTasksStore(state => state.tasks)
  const tasksLoading = useTasksStore(state => state.isLoading)
  const loadTasks = useTasksStore(state => state.loadTasks)

  const activePlan = useDailyPlanStore(state => state.activePlan)
  const planLoading = useDailyPlanStore(state => state.isLoading)
  const planSaving = useDailyPlanStore(state => state.isSaving)
  const planError = useDailyPlanStore(state => state.error)
  const updateFocus = useDailyPlanStore(state => state.updateFocus)

  const linkTask = usePomodoroStore(state => state.linkTask)
  const startPomodoro = usePomodoroStore(state => state.start)
  const timerState = usePomodoroStore(state => state.timerState)
  const linkedTaskId = usePomodoroStore(state => state.linkedTaskId)

  const navigateTo = useUIStore(state => state.navigateTo)

  const period = getDailyAxisPeriod()

  useEffect(() => {
    if (tasks.length === 0 && !tasksLoading) {
      void loadTasks()
    }
  }, [loadTasks, tasks.length, tasksLoading])

  const availableFocusTasks = tasks.filter(
    task => task.status !== 'done' && !task.completed_at
  )
  const focusedTask = activePlan?.focus_task_id
    ? availableFocusTasks.find(task => task.id === activePlan.focus_task_id) ??
      null
    : null
  const selectableTasks = availableFocusTasks.slice(0, 5)
  const isRunningFocusedTask =
    timerState === 'running' &&
    !!focusedTask &&
    linkedTaskId === focusedTask.id
  const isLoading = planLoading || tasksLoading
  const emptyState = !isLoading && !focusedTask

  const primaryLabel =
    period === 'evening'
      ? t('dailyAxis.prepareTomorrow')
      : emptyState
        ? t('dailyAxis.openTasks')
        : isRunningFocusedTask
          ? t('dailyAxis.openFocus')
          : t('dailyAxis.startFocus')

  const handleSelectFocus = async (taskId: string) => {
    if (!taskId || focusedTask?.id === taskId) {
      setSelectorOpen(false)
      return
    }

    try {
      const nextTask = availableFocusTasks.find(task => task.id === taskId)
      await updateFocus(taskId, 'manual')
      setSelectorOpen(false)
      void notifications.success(
        t('dailyAxis.success.focusUpdated'),
        nextTask?.title
      )
    } catch {
      void notifications.error(
        t('dailyAxis.error.loadFailed'),
        t('dailyAxis.error.focusUpdateFailed')
      )
    }
  }

  const handleStartFocus = () => {
    if (!focusedTask) {
      navigateTo('tasks')
      return
    }

    linkTask(focusedTask.id)
    navigateTo('pomodoro')

    if (timerState !== 'running' || linkedTaskId !== focusedTask.id) {
      startPomodoro()
    }

    void notifications.success(
      t('dailyAxis.success.focusStarted'),
      focusedTask.title
    )
  }

  const handlePrimaryAction = () => {
    if (period === 'evening') {
      navigateTo('tasks')
      return
    }

    if (isRunningFocusedTask) {
      navigateTo('pomodoro')
      return
    }

    handleStartFocus()
  }

  return (
    <section
      role="region"
      aria-label="Daily Axis"
      className="border-b border-border px-4 py-4"
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border px-5 py-4',
          period === 'evening'
            ? 'border-amber-500/25 bg-gradient-to-br from-amber-500/8 via-background to-background'
            : 'border-primary/15 bg-gradient-to-br from-primary/8 via-background to-background'
        )}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {period === 'morning' ? (
                <Sunrise className="size-4" />
              ) : period === 'afternoon' ? (
                <SunMedium className="size-4" />
              ) : (
                <Sunset className="size-4" />
              )}
              <span>{t(greetingKey(period))}</span>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-44" />
                <Skeleton className="h-5 w-80 max-w-full" />
              </div>
            ) : planError ? (
              <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight">
                  {t('dailyAxis.errorTitle')}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t('dailyAxis.error.loadFailed')}
                </p>
              </div>
            ) : emptyState ? (
              <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight">
                  {t('dailyAxis.emptyTitle')}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t('dailyAxis.emptyDescription')}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight">
                  {t('dailyAxis.title')}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1">
                    <CheckSquare2 className="size-3.5" />
                    <span className="truncate">{focusedTask?.title}</span>
                  </span>
                  {isRunningFocusedTask && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      <Sparkles className="size-3" />
                      {t('dailyAxis.inProgress')}
                    </span>
                  )}
                  {focusedTask?.priority && (
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs uppercase tracking-wide">
                      {t(`tasks.priority.${focusedTask.priority}`)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Popover open={selectorOpen} onOpenChange={setSelectorOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  disabled={isLoading || planSaving || selectableTasks.length <= 1}
                >
                  <RefreshCcw className="size-4" />
                  <span>{t('dailyAxis.changeFocus')}</span>
                  <ChevronDown className="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-2">
                <div className="mb-1 px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('dailyAxis.selectorTitle')}
                </div>
                <div className="space-y-1">
                  {selectableTasks.map(task => {
                    const selected = task.id === focusedTask?.id
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => void handleSelectFocus(task.id)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                          selected && 'bg-accent'
                        )}
                      >
                        <span className="flex-1 truncate">{task.title}</span>
                        {selected ? <Check className="size-4 text-primary" /> : null}
                      </button>
                    )
                  })}
                </div>
              </PopoverContent>
            </Popover>

            {period === 'evening' && !emptyState ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={isLoading || planSaving}
                onClick={handleStartFocus}
              >
                <Play className="size-4" />
                <span>{t('dailyAxis.startFocus')}</span>
              </Button>
            ) : null}

            <Button
              type="button"
              className="rounded-xl"
              disabled={isLoading || planSaving}
              onClick={handlePrimaryAction}
            >
              <Play className="size-4" />
              <span>{primaryLabel}</span>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

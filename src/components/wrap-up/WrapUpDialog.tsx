import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, Moon, MoveRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { notifications } from '@/lib/notifications'
import { getTomorrowISO, splitWrapUpTasks } from '@/lib/wrap-up-domain'
import {
  commands,
  type CreateDailyPlanInput,
  unwrapResult,
} from '@/lib/tauri-bindings'
import { useDailyPlanStore } from '@/store/daily-plan-store'
import { type Task, useTasksStore } from '@/store/tasks-store'
import { useUIStore } from '@/store/ui-store'

function nowISO() {
  return new Date().toISOString()
}

function newId() {
  return crypto.randomUUID()
}

function buildTomorrowPlanInput(
  planDate: string,
  focusTaskId: string | null
): CreateDailyPlanInput {
  const timestamp = nowISO()
  return {
    id: newId(),
    plan_date: planDate,
    focus_task_id: focusTaskId,
    status: 'open',
    focus_source: 'manual',
    created_at: timestamp,
    updated_at: timestamp,
  }
}

function TaskRow({
  task,
  selected,
  onToggle,
}: {
  task: Task
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card/40 px-3 py-2.5 text-left transition-colors hover:bg-accent"
    >
      {selected ? (
        <CheckCircle2 className="size-4 shrink-0 text-primary" />
      ) : (
        <Circle className="size-4 shrink-0 text-muted-foreground" />
      )}
      <span className="flex-1 truncate text-sm">{task.title}</span>
    </button>
  )
}

export function WrapUpDialog() {
  const { t } = useTranslation()
  const wrapUpOpen = useUIStore(state => state.wrapUpOpen)
  const setWrapUpOpen = useUIStore(state => state.setWrapUpOpen)

  const tasks = useTasksStore(state => state.tasks)
  const updateTask = useTasksStore(state => state.updateTask)
  const activePlan = useDailyPlanStore(state => state.activePlan)
  const completePlan = useDailyPlanStore(state => state.completePlan)
  const initializeTodayPlan = useDailyPlanStore(
    state => state.initializeTodayPlan
  )

  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [tomorrowFocusId, setTomorrowFocusId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const summary = splitWrapUpTasks(tasks)
  const tomorrow = getTomorrowISO()

  useEffect(() => {
    if (!wrapUpOpen) return
    setSelectedTaskIds(summary.open.map(task => task.id))
    setTomorrowFocusId(summary.open[0]?.id ?? null)
  }, [wrapUpOpen, summary.open])

  const toggleSelected = (taskId: string) => {
    setSelectedTaskIds(current =>
      current.includes(taskId)
        ? current.filter(id => id !== taskId)
        : [...current, taskId]
    )
  }

  const saveTomorrowFocus = async () => {
    if (!tomorrowFocusId) return

    const existing = unwrapResult(await commands.getDailyPlan(tomorrow))

    if (existing) {
      await unwrapResult(
        await commands.updateDailyPlanFocus(
          existing.id,
          tomorrowFocusId,
          'manual',
          nowISO()
        )
      )
      return
    }

    await unwrapResult(
      await commands.createDailyPlan(
        buildTomorrowPlanInput(tomorrow, tomorrowFocusId)
      )
    )
  }

  const handleSubmit = async (moveSelected: boolean) => {
    if (!activePlan) {
      setWrapUpOpen(false)
      return
    }

    setIsSubmitting(true)
    try {
      if (moveSelected) {
        for (const taskId of selectedTaskIds) {
          const task = summary.open.find(item => item.id === taskId)
          if (!task) continue

          await updateTask(task.id, { due_date: tomorrow })
        }
      }

      await saveTomorrowFocus()
      await completePlan()
      await initializeTodayPlan()
      setWrapUpOpen(false)
      void notifications.success(
        t('wrapUp.success.title'),
        t('wrapUp.success.description')
      )
    } catch {
      void notifications.error(
        t('wrapUp.error.title'),
        t('wrapUp.error.description')
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const reducedMode = !activePlan

  return (
    <Dialog open={wrapUpOpen} onOpenChange={setWrapUpOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Moon className="size-4" />
            {t('wrapUp.title')}
          </DialogTitle>
          <DialogDescription>
            {reducedMode
              ? t('wrapUp.reducedDescription')
              : t('wrapUp.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-3">
            <h3 className="text-sm font-medium">
              {t('wrapUp.completedHeading')}
            </h3>
            <div className="space-y-2">
              {summary.completed.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('wrapUp.noCompleted')}
                </p>
              ) : (
                summary.completed.slice(0, 6).map(task => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2 text-sm text-muted-foreground"
                  >
                    <CheckCircle2 className="size-4 text-primary" />
                    <span className="truncate">{task.title}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-medium">{t('wrapUp.openHeading')}</h3>
            <div className="space-y-2">
              {summary.open.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('wrapUp.noOpen')}
                </p>
              ) : (
                summary.open
                  .slice(0, 8)
                  .map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      selected={selectedTaskIds.includes(task.id)}
                      onToggle={() => toggleSelected(task.id)}
                    />
                  ))
              )}
            </div>
          </section>
        </div>

        {summary.open.length > 0 ? (
          <section className="space-y-3">
            <h3 className="text-sm font-medium">
              {t('wrapUp.tomorrowHeading')}
            </h3>
            <div className="flex flex-wrap gap-2">
              {summary.open.slice(0, 5).map(task => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => setTomorrowFocusId(task.id)}
                  className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                    tomorrowFocusId === task.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  {task.title}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setWrapUpOpen(false)}
          >
            {t('wrapUp.notNow')}
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleSubmit(false)}
              disabled={isSubmitting}
            >
              {t('wrapUp.keepAsIs')}
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmit(true)}
              disabled={isSubmitting}
            >
              <MoveRight className="size-4" />
              {t('wrapUp.finish')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

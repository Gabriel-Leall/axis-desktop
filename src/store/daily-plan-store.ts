import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import {
  commands,
  type CreateDailyPlanInput,
  type DailyPlan,
  type DailyPlanFocusSource,
} from '@/lib/tauri-bindings'
import { getLocalISODate } from '@/lib/calendar-domain'
import { selectDailyPlanFocus } from '@/lib/daily-plan-domain'
import { logger } from '@/lib/logger'
import type { Task as BindingTask } from '@/lib/tauri-bindings'

interface DailyPlanState {
  activePlan: DailyPlan | null
  currentDate: string | null
  isLoading: boolean
  isSaving: boolean
  error: string | null
  initializeTodayPlan: (dateISO?: string) => Promise<void>
  updateFocus: (
    taskId: string | null,
    source?: DailyPlanFocusSource
  ) => Promise<void>
  completePlan: (completedAt?: string) => Promise<void>
  syncCurrentDate: (dateISO?: string) => Promise<void>
}

function nowISO(): string {
  return new Date().toISOString()
}

function newId(): string {
  return crypto.randomUUID()
}

function unwrapOrThrow<T>(
  result: { status: 'ok'; data: T } | { status: 'error'; error: unknown }
): T {
  if (result.status === 'ok') {
    return result.data
  }

  throw result.error
}

function isTaskStillEligible(
  taskId: string | null,
  tasks: BindingTask[]
): boolean {
  if (!taskId) {
    return false
  }

  const task = tasks.find(item => item.id === taskId)
  return !!task && task.status !== 'done' && !task.completed_at
}

async function loadAllTasks(): Promise<BindingTask[]> {
  return unwrapOrThrow(await commands.getTasks())
}

function buildCreateInput(
  dateISO: string,
  focusTaskId: string | null
): CreateDailyPlanInput {
  const timestamp = nowISO()

  return {
    id: newId(),
    plan_date: dateISO,
    focus_task_id: focusTaskId,
    status: 'open',
    focus_source: 'auto',
    created_at: timestamp,
    updated_at: timestamp,
  }
}

export const useDailyPlanStore = create<DailyPlanState>()(
  devtools(
    (set, get) => ({
      activePlan: null,
      currentDate: null,
      isLoading: false,
      isSaving: false,
      error: null,

      initializeTodayPlan: async (dateISO = getLocalISODate()) => {
        set(
          { isLoading: true, error: null, currentDate: dateISO },
          undefined,
          'dailyPlan/initialize/start'
        )

        try {
          const existingPlan = unwrapOrThrow(
            await commands.getDailyPlan(dateISO)
          )

          if (!existingPlan) {
            const tasks = await loadAllTasks()
            const focus = selectDailyPlanFocus(tasks, dateISO)
            const createdPlan = unwrapOrThrow(
              await commands.createDailyPlan(
                buildCreateInput(dateISO, focus?.id ?? null)
              )
            )

            set(
              { activePlan: createdPlan, isLoading: false },
              undefined,
              'dailyPlan/initialize/create'
            )
            return
          }

          if (existingPlan.status === 'wrapped_up') {
            set(
              { activePlan: existingPlan, isLoading: false },
              undefined,
              'dailyPlan/initialize/reuseWrapped'
            )
            return
          }

          const tasks = await loadAllTasks()
          if (isTaskStillEligible(existingPlan.focus_task_id, tasks)) {
            set(
              { activePlan: existingPlan, isLoading: false },
              undefined,
              'dailyPlan/initialize/reuse'
            )
            return
          }

          const recalculatedFocus = selectDailyPlanFocus(tasks, dateISO)
          const updatedPlan = unwrapOrThrow(
            await commands.updateDailyPlanFocus(
              existingPlan.id,
              recalculatedFocus?.id ?? null,
              'recalculated',
              nowISO()
            )
          )

          set(
            { activePlan: updatedPlan, isLoading: false },
            undefined,
            'dailyPlan/initialize/recalculate'
          )
        } catch (error) {
          logger.error(`Failed to initialize daily plan: ${String(error)}`)
          set(
            {
              isLoading: false,
              error: 'Failed to initialize daily plan.',
            },
            undefined,
            'dailyPlan/initialize/error'
          )
        }
      },

      updateFocus: async (taskId, source = 'manual') => {
        const activePlan = get().activePlan
        if (!activePlan) {
          return
        }

        set({ isSaving: true, error: null }, undefined, 'dailyPlan/focus/start')

        try {
          const updatedPlan = unwrapOrThrow(
            await commands.updateDailyPlanFocus(
              activePlan.id,
              taskId,
              source,
              nowISO()
            )
          )

          set(
            { activePlan: updatedPlan, isSaving: false },
            undefined,
            'dailyPlan/focus/done'
          )
        } catch (error) {
          logger.error(`Failed to update daily plan focus: ${String(error)}`)
          set(
            {
              isSaving: false,
              error: 'Failed to update daily plan focus.',
            },
            undefined,
            'dailyPlan/focus/error'
          )
          throw error
        }
      },

      completePlan: async (completedAt = nowISO()) => {
        const activePlan = get().activePlan
        if (!activePlan) {
          return
        }

        set(
          { isSaving: true, error: null },
          undefined,
          'dailyPlan/complete/start'
        )

        try {
          const updatedPlan = unwrapOrThrow(
            await commands.completeDailyPlan(
              activePlan.id,
              completedAt,
              nowISO()
            )
          )

          set(
            { activePlan: updatedPlan, isSaving: false },
            undefined,
            'dailyPlan/complete/done'
          )
        } catch (error) {
          logger.error(`Failed to complete daily plan: ${String(error)}`)
          set(
            {
              isSaving: false,
              error: 'Failed to complete daily plan.',
            },
            undefined,
            'dailyPlan/complete/error'
          )
          throw error
        }
      },

      syncCurrentDate: async (dateISO = getLocalISODate()) => {
        if (get().currentDate === dateISO) {
          return
        }

        await get().initializeTodayPlan(dateISO)
      },
    }),
    {
      name: 'daily-plan-store',
    }
  )
)

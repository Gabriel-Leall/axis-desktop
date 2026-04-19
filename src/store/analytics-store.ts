import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { commands } from '@/lib/tauri-bindings'
import { logger } from '@/lib/logger'
import type {
  AnalyticsSummary,
  FocusTimeByDay,
  TaskCountByDay,
  PomodoroSummary,
  HabitLog,
} from '@/lib/tauri-bindings'
import { type AnalyticsPeriod, getPeriodRange } from '@/lib/analytics-domain'

interface AnalyticsState {
  period: AnalyticsPeriod

  // Data
  summary: AnalyticsSummary | null
  focusTimeData: FocusTimeByDay[]
  taskCountData: TaskCountByDay[]
  pomodoroSummary: PomodoroSummary[]
  habitLogs: HabitLog[]

  isLoading: boolean
  error: string | null

  // Actions
  setPeriod: (period: AnalyticsPeriod) => void
  loadData: () => Promise<void>
}

// Ensure error throwing matches other stores
function unwrapOrThrow<T>(
  result: { status: 'ok'; data: T } | { status: 'error'; error: unknown }
): T {
  if (result.status === 'ok') return result.data
  throw result.error
}

export const useAnalyticsStore = create<AnalyticsState>()(
  devtools(
    (set, get) => ({
      period: 'this_week',

      summary: null,
      focusTimeData: [],
      taskCountData: [],
      pomodoroSummary: [],
      habitLogs: [],

      isLoading: false,
      error: null,

      setPeriod: (period: AnalyticsPeriod) => {
        set({ period }, undefined, 'analytics/setPeriod')
        get().loadData()
      },

      loadData: async () => {
        const { period } = get()
        const { start, end, prevStart, prevEnd } = getPeriodRange(period)

        set(
          { isLoading: true, error: null },
          undefined,
          'analytics/loadData/start'
        )

        try {
          const startStr = start.toISOString()
          const endStr = end.toISOString()
          const prevStartStr = prevStart.toISOString()
          const prevEndStr = prevEnd.toISOString()

          const [
            summaryResult,
            focusTimeResult,
            taskCountResult,
            pomodoroSummaryResult,
            habitLogsResult,
          ] = await Promise.all([
            commands.getAnalyticsSummary(
              startStr,
              endStr,
              prevStartStr,
              prevEndStr
            ),
            commands.getFocusTimeByDay(startStr, endStr),
            commands.getTaskCountsByDay(startStr, endStr),
            commands.getPomodoroSummary(startStr, endStr),
            commands.getHabitLogsRange(
              startStr.slice(0, 10),
              endStr.slice(0, 10)
            ),
          ])

          const summary = unwrapOrThrow(summaryResult)
          const focusTimeData = unwrapOrThrow(focusTimeResult)
          const taskCountData = unwrapOrThrow(taskCountResult)
          const pomodoroSummary = unwrapOrThrow(pomodoroSummaryResult)
          const habitLogs = unwrapOrThrow(habitLogsResult)

          set(
            {
              summary,
              focusTimeData,
              taskCountData,
              pomodoroSummary,
              habitLogs,
              isLoading: false,
            },
            undefined,
            'analytics/loadData/success'
          )
        } catch (error) {
          logger.error(`Failed to load analytics data: ${String(error)}`)
          set(
            { isLoading: false, error: String(error) },
            undefined,
            'analytics/loadData/error'
          )
        }
      },
    }),
    { name: 'analytics-store' }
  )
)

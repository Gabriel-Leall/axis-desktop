import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { commands } from '@/lib/tauri-bindings'
import {
  bestHistoricalStreak,
  buildDateRange,
  calculateStreakFromDates,
  completionRate,
  getLocalISODate,
  topCompletionWeekday,
  shouldDoOnDate,
  type HabitFrequency,
} from '@/lib/habits-domain'
import { logger } from '@/lib/logger'

export interface Habit {
  id: string
  name: string
  color: string
  icon?: string
  frequency: HabitFrequency
  frequency_days?: string
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface HabitLog {
  id: string
  habit_id: string
  completed_date: string
  completed_at: string
}

export interface HabitInput {
  name: string
  color: string
  icon?: string
  frequency: HabitFrequency
  frequency_days?: string
}

type HabitsTab = 'today' | 'overview' | 'stats'

interface HabitsState {
  habits: Habit[]
  todayLogs: HabitLog[]
  monthLogs: HabitLog[]
  selectedHabitId: string | null
  activeTab: HabitsTab
  isLoading: boolean
  error: string | null

  loadHabits: () => Promise<void>
  loadTodayLogs: () => Promise<void>
  loadMonthLogs: () => Promise<void>
  toggleHabit: (habitId: string) => Promise<void>
  addHabit: (input: HabitInput) => Promise<Habit>
  updateHabit: (id: string, updates: Partial<HabitInput>) => Promise<void>
  archiveHabit: (id: string) => Promise<void>
  deleteHabit: (id: string) => Promise<void>
  setSelectedHabit: (id: string | null) => void
  setActiveTab: (tab: HabitsTab) => void
}

function monthWindowStart(days = 30): string {
  const cursor = new Date()
  cursor.setDate(cursor.getDate() - (days - 1))
  return getLocalISODate(cursor)
}

function newId(): string {
  return crypto.randomUUID()
}

export const useHabitsStore = create<HabitsState>()(
  devtools(
    (set, get) => ({
      habits: [],
      todayLogs: [],
      monthLogs: [],
      selectedHabitId: null,
      activeTab: 'today',
      isLoading: false,
      error: null,

      loadHabits: async () => {
        set({ isLoading: true, error: null }, undefined, 'loadHabits/start')
        try {
          const result = await commands.getHabits()
          if (result.status !== 'ok') throw result.error

          const habits: Habit[] = result.data.map(h => ({
            id: h.id,
            name: h.name,
            color: h.color,
            icon: h.icon ?? undefined,
            frequency: h.frequency as HabitFrequency,
            frequency_days: h.frequency_days ?? undefined,
            active: h.active,
            sort_order: h.sort_order,
            created_at: h.created_at,
            updated_at: h.updated_at,
          }))

          set({ habits, isLoading: false }, undefined, 'loadHabits/done')
        } catch (error) {
          logger.error(`Failed to load habits: ${String(error)}`)
          set(
            { isLoading: false, error: 'Failed to load habits.' },
            undefined,
            'loadHabits/error'
          )
        }
      },

      loadTodayLogs: async () => {
        try {
          const today = getLocalISODate()
          const result = await commands.getHabitLogsForDate(today)
          if (result.status !== 'ok') throw result.error

          const todayLogs: HabitLog[] = result.data.map(l => ({
            id: l.id,
            habit_id: l.habit_id,
            completed_date: l.completed_date,
            completed_at: l.completed_at,
          }))

          set({ todayLogs }, undefined, 'loadTodayLogs')
        } catch (error) {
          logger.error(`Failed to load today logs: ${String(error)}`)
          set(
            { error: 'Failed to load today logs.' },
            undefined,
            'loadTodayLogs/error'
          )
        }
      },

      loadMonthLogs: async () => {
        try {
          const startDate = monthWindowStart(30)
          const endDate = getLocalISODate()
          const result = await commands.getHabitLogsRange(startDate, endDate)
          if (result.status !== 'ok') throw result.error

          const monthLogs: HabitLog[] = result.data.map(l => ({
            id: l.id,
            habit_id: l.habit_id,
            completed_date: l.completed_date,
            completed_at: l.completed_at,
          }))

          set({ monthLogs }, undefined, 'loadMonthLogs')
        } catch (error) {
          logger.error(`Failed to load month logs: ${String(error)}`)
          set(
            { error: 'Failed to load month logs.' },
            undefined,
            'loadMonthLogs/error'
          )
        }
      },

      toggleHabit: async habitId => {
        const today = getLocalISODate()
        const nowISO = new Date().toISOString()
        const existing = get().todayLogs.find(
          log => log.habit_id === habitId && log.completed_date === today
        )

        if (existing) {
          // Optimistic remove
          set(
            state => ({
              todayLogs: state.todayLogs.filter(log => log.id !== existing.id),
              monthLogs: state.monthLogs.filter(log => log.id !== existing.id),
            }),
            undefined,
            'toggleHabit/uncheck'
          )

          try {
            const result = await commands.toggleHabitLog(
              habitId,
              today,
              existing.id,
              nowISO
            )
            // If backend returned true (completed), it means the log was re-inserted
            // which shouldn't happen in uncheck flow — reload to reconcile.
            if (result.status === 'ok' && result.data === true) {
              await get().loadTodayLogs()
              await get().loadMonthLogs()
            }
          } catch (error) {
            logger.error(`Failed to uncheck habit: ${String(error)}`)
            await get().loadTodayLogs()
            await get().loadMonthLogs()
          }
          return
        }

        const newLog: HabitLog = {
          id: newId(),
          habit_id: habitId,
          completed_date: today,
          completed_at: nowISO,
        }

        // Optimistic add
        set(
          state => ({
            todayLogs: [...state.todayLogs, newLog],
            monthLogs: [...state.monthLogs, newLog],
          }),
          undefined,
          'toggleHabit/check'
        )

        try {
          await commands.toggleHabitLog(habitId, today, newLog.id, nowISO)
        } catch (error) {
          logger.error(`Failed to check habit: ${String(error)}`)
          await get().loadTodayLogs()
          await get().loadMonthLogs()
        }
      },

      addHabit: async input => {
        const now = new Date().toISOString()
        const newHabit: Habit = {
          id: newId(),
          name: input.name.trim(),
          color: input.color,
          icon: input.icon,
          frequency: input.frequency,
          frequency_days:
            input.frequency === 'custom'
              ? (input.frequency_days ?? '[]')
              : undefined,
          active: true,
          sort_order: get().habits.length,
          created_at: now,
          updated_at: now,
        }

        set(
          state => ({ habits: [...state.habits, newHabit] }),
          undefined,
          'addHabit/optimistic'
        )

        try {
          await commands.createHabit({
            id: newHabit.id,
            name: newHabit.name,
            color: newHabit.color,
            icon: newHabit.icon ?? null,
            frequency: newHabit.frequency,
            frequency_days: newHabit.frequency_days ?? null,
            sort_order: newHabit.sort_order,
            created_at: newHabit.created_at,
            updated_at: newHabit.updated_at,
          })
          return newHabit
        } catch (error) {
          logger.error(`Failed to add habit: ${String(error)}`)
          set(
            state => ({
              habits: state.habits.filter(habit => habit.id !== newHabit.id),
            }),
            undefined,
            'addHabit/rollback'
          )
          throw error
        }
      },

      updateHabit: async (id, updates) => {
        const now = new Date().toISOString()
        const normalized: Partial<Habit> = {
          ...updates,
          frequency_days:
            updates.frequency === 'custom'
              ? (updates.frequency_days ?? '[]')
              : updates.frequency
                ? undefined
                : updates.frequency_days,
          updated_at: now,
        }

        set(
          state => ({
            habits: state.habits.map(habit =>
              habit.id === id ? { ...habit, ...normalized } : habit
            ),
          }),
          undefined,
          'updateHabit/optimistic'
        )

        try {
          await commands.updateHabit({
            id,
            name: updates.name ?? null,
            color: updates.color ?? null,
            icon: updates.icon ?? null,
            frequency: updates.frequency ?? null,
            frequency_days:
              updates.frequency === 'custom'
                ? (updates.frequency_days ?? '[]')
                : updates.frequency
                  ? null
                  : (updates.frequency_days ?? null),
            sort_order: null,
            updated_at: now,
          })
        } catch (error) {
          logger.error(`Failed to update habit: ${String(error)}`)
          await get().loadHabits()
          throw error
        }
      },

      archiveHabit: async id => {
        const now = new Date().toISOString()
        const snapshot = get().habits

        set(
          state => ({ habits: state.habits.filter(habit => habit.id !== id) }),
          undefined,
          'archiveHabit/optimistic'
        )

        try {
          await commands.archiveHabit(id, now)
        } catch (error) {
          logger.error(`Failed to archive habit: ${String(error)}`)
          set({ habits: snapshot }, undefined, 'archiveHabit/rollback')
          throw error
        }
      },

      deleteHabit: async id => {
        const snapshotHabits = get().habits
        const snapshotToday = get().todayLogs
        const snapshotMonth = get().monthLogs

        set(
          state => ({
            habits: state.habits.filter(habit => habit.id !== id),
            todayLogs: state.todayLogs.filter(log => log.habit_id !== id),
            monthLogs: state.monthLogs.filter(log => log.habit_id !== id),
            selectedHabitId:
              state.selectedHabitId === id ? null : state.selectedHabitId,
          }),
          undefined,
          'deleteHabit/optimistic'
        )

        try {
          await commands.deleteHabit(id)
        } catch (error) {
          logger.error(`Failed to delete habit: ${String(error)}`)
          set(
            {
              habits: snapshotHabits,
              todayLogs: snapshotToday,
              monthLogs: snapshotMonth,
            },
            undefined,
            'deleteHabit/rollback'
          )
          throw error
        }
      },

      setSelectedHabit: id =>
        set({ selectedHabitId: id }, undefined, 'setSelectedHabit'),

      setActiveTab: tab => set({ activeTab: tab }, undefined, 'setActiveTab'),
    }),
    { name: 'habits-store' }
  )
)

export function selectTodayHabits(
  habits: Habit[],
  dateISO = getLocalISODate()
): Habit[] {
  return habits.filter(habit =>
    shouldDoOnDate(habit.frequency, habit.frequency_days ?? null, dateISO)
  )
}

export function selectTodayDoneSet(todayLogs: HabitLog[]): Set<string> {
  return new Set(todayLogs.map(log => log.habit_id))
}

export function selectSortedTodayHabits(
  habits: Habit[],
  todayLogs: HabitLog[]
): Habit[] {
  const dueToday = selectTodayHabits(habits)
  const doneSet = selectTodayDoneSet(todayLogs)
  return dueToday.sort((a, b) => {
    const aDone = doneSet.has(a.id)
    const bDone = doneSet.has(b.id)
    if (aDone === bDone) return a.sort_order - b.sort_order
    return aDone ? 1 : -1
  })
}

export function selectStreakByHabit(
  logs: HabitLog[],
  habitId: string,
  todayISO = getLocalISODate()
): number {
  const dates = logs
    .filter(log => log.habit_id === habitId)
    .map(log => log.completed_date)
  return calculateStreakFromDates(dates, todayISO)
}

export function selectLastNDates(days: number, endDate = new Date()): string[] {
  return buildDateRange(days, endDate)
}

export function selectHabitCompletionDates(
  logs: HabitLog[],
  habitId: string
): string[] {
  return logs
    .filter(log => log.habit_id === habitId)
    .map(log => log.completed_date)
}

export function selectTodayProgress(
  habits: Habit[],
  todayLogs: HabitLog[]
): { done: number; total: number; ratio: number } {
  const dueToday = selectTodayHabits(habits)
  const doneSet = selectTodayDoneSet(todayLogs)
  const done = dueToday.filter(habit => doneSet.has(habit.id)).length
  const total = dueToday.length
  return { done, total, ratio: total > 0 ? done / total : 0 }
}

export interface HabitStats {
  topCurrentHabit: { habitId: string; name: string; streak: number } | null
  bestHistoricalByHabit: {
    habitId: string
    name: string
    streak: number
  }[]
  monthRate: { percentage: number; completedDays: number; totalDays: number }
  topWeekday: number | null
}

export function selectHabitStats(
  habits: Habit[],
  monthLogs: HabitLog[],
  days = 30,
  todayISO = getLocalISODate()
): HabitStats {
  const perHabitCurrent = habits.map(habit => {
    const dates = selectHabitCompletionDates(monthLogs, habit.id)
    return {
      habitId: habit.id,
      name: habit.name,
      current: calculateStreakFromDates(dates, todayISO),
      best: bestHistoricalStreak(dates),
    }
  })

  const topCurrent =
    perHabitCurrent.length === 0
      ? null
      : ([...perHabitCurrent].sort((a, b) => b.current - a.current)[0] ?? null)

  const totalSlots = habits.length * days
  const completionCount = monthLogs.length
  const uniqueDates = new Set(monthLogs.map(log => log.completed_date))
  const topWeekday = topCompletionWeekday([...uniqueDates])

  return {
    topCurrentHabit: topCurrent
      ? {
          habitId: topCurrent.habitId,
          name: topCurrent.name,
          streak: topCurrent.current,
        }
      : null,
    bestHistoricalByHabit: perHabitCurrent
      .map(item => ({
        habitId: item.habitId,
        name: item.name,
        streak: item.best,
      }))
      .sort((a, b) => b.streak - a.streak),
    monthRate: {
      percentage: completionRate(completionCount, totalSlots),
      completedDays: uniqueDates.size,
      totalDays: days,
    },
    topWeekday,
  }
}

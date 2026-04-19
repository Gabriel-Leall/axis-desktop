import { useEffect, useMemo, useState } from 'react'
import { Plus, CheckCircle2 } from 'lucide-react'
import { WidgetCard } from '../WidgetCard'
import {
  selectHabitCompletionDates,
  selectSortedTodayHabits,
  selectStreakByHabit,
  selectTodayProgress,
  useHabitsStore,
  type HabitInput,
} from '@/store/habits-store'
import { HeatMap } from '@/components/habits/HeatMap'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'motion/react'
import { Skeleton } from '@/components/ui/skeleton'
import { listItemVariants } from '@/lib/motion-tokens'

interface HabitWidgetProps {
  onNavigateToHabits?: (selectedHabitId?: string) => void
}

function progressTone(ratio: number): string {
  if (ratio >= 0.8) return 'text-emerald-500 dark:text-emerald-400'
  if (ratio >= 0.4) return 'text-amber-500 dark:text-amber-400'
  return 'text-rose-500 dark:text-rose-400'
}

function quickHabitInput(name: string): HabitInput {
  return {
    name,
    color: '#22c55e',
    frequency: 'daily',
  }
}

export function HabitWidget({ onNavigateToHabits }: HabitWidgetProps) {
  const [quickName, setQuickName] = useState('')

  const habits = useHabitsStore(state => state.habits)
  const todayLogs = useHabitsStore(state => state.todayLogs)
  const monthLogs = useHabitsStore(state => state.monthLogs)
  const isLoading = useHabitsStore(state => state.isLoading)

  const loadHabits = useHabitsStore(state => state.loadHabits)
  const loadTodayLogs = useHabitsStore(state => state.loadTodayLogs)
  const loadMonthLogs = useHabitsStore(state => state.loadMonthLogs)
  const addHabit = useHabitsStore(state => state.addHabit)
  const toggleHabit = useHabitsStore(state => state.toggleHabit)
  const setSelectedHabit = useHabitsStore(state => state.setSelectedHabit)

  useEffect(() => {
    void Promise.all([loadHabits(), loadTodayLogs(), loadMonthLogs()])
  }, [loadHabits, loadMonthLogs, loadTodayLogs])

  const todayHabits = useMemo(
    () => selectSortedTodayHabits(habits, todayLogs),
    [habits, todayLogs]
  )
  const visibleHabits = todayHabits.slice(0, 6)
  const progress = selectTodayProgress(habits, todayLogs)

  const handleQuickAdd = async () => {
    const name = quickName.trim()
    if (!name) return
    await addHabit(quickHabitInput(name))
    setQuickName('')
  }

  return (
    <WidgetCard title="Habits" icon={CheckCircle2}>
      <div className="flex h-full flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Today
          </span>
          <div className="flex items-center gap-2">
            <span
              className={cn('font-mono text-xs', progressTone(progress.ratio))}
            >
              {progress.done} / {progress.total || 0}
            </span>
            <button
              type="button"
              onClick={handleQuickAdd}
              aria-label="Quick add habit"
              className="rounded border border-border p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Plus className="size-3" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-md border border-border/60 px-2 py-1">
          <input
            value={quickName}
            onChange={event => setQuickName(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                void handleQuickAdd()
              }
            }}
            placeholder="New habit..."
            className="w-full bg-transparent text-xs outline-none"
            aria-label="Habit name"
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-1 overflow-x-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            {isLoading ? (
              <motion.div
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-1"
              >
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-2 rounded-md border border-border/70 px-2 py-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <Skeleton className="size-4 rounded-full" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-3 w-6 ml-auto" />
                    </div>
                    <Skeleton className="h-2 w-full mt-1" />
                  </div>
                ))}
              </motion.div>
            ) : visibleHabits.length === 0 ? (
              <motion.div
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex h-full flex-col items-center justify-center rounded-md border border-dashed border-border/70 px-3 text-center gap-1.5 py-4"
              >
                <CheckCircle2
                  className="size-5 text-muted-foreground/30"
                  strokeWidth={1.5}
                />
                <span className="text-xs text-muted-foreground/50">
                  No habits yet. Add your first one.
                </span>
              </motion.div>
            ) : (
              <div className="space-y-1">
                {visibleHabits.map((habit, i) => {
                  const doneToday = todayLogs.some(
                    log => log.habit_id === habit.id
                  )
                  const streak = selectStreakByHabit(monthLogs, habit.id)
                  const logDates = selectHabitCompletionDates(
                    monthLogs,
                    habit.id
                  )
                  return (
                    <motion.div
                      key={habit.id}
                      layout
                      variants={listItemVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      custom={i}
                      className={cn(
                        'rounded-md border border-border/70 px-2 py-1.5 transition-colors',
                        doneToday && 'opacity-70',
                        'hover:bg-accent/30'
                      )}
                      style={{ borderInlineStart: `3px solid ${habit.color}` }}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={
                            doneToday
                              ? 'Mark habit as not done'
                              : 'Mark habit as done'
                          }
                          onClick={() => void toggleHabit(habit.id)}
                          className={cn(
                            'size-4 rounded-full border transition-colors flex items-center justify-center',
                            doneToday
                              ? 'border-transparent'
                              : 'border-muted-foreground/60 hover:border-primary'
                          )}
                          style={{
                            backgroundColor: doneToday
                              ? habit.color
                              : 'transparent',
                          }}
                        />

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedHabit(habit.id)
                            onNavigateToHabits?.(habit.id)
                          }}
                          className={cn(
                            'flex-1 truncate text-left text-[12px] text-foreground transition-all',
                            doneToday && 'line-through'
                          )}
                        >
                          {habit.name}
                        </button>

                        <span className="font-mono text-[11px] text-muted-foreground">
                          {streak}d
                        </span>
                      </div>

                      <div className="mt-1">
                        <HeatMap
                          logs={logDates}
                          days={7}
                          color={habit.color}
                          size="sm"
                        />
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </AnimatePresence>
        </div>

        <button
          type="button"
          onClick={() => onNavigateToHabits?.()}
          className="self-end text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Open habits
        </button>
      </div>
    </WidgetCard>
  )
}

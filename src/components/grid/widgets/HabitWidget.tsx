import { useEffect, useMemo } from 'react'
import { Flame, CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { WidgetCard } from '../WidgetCard'
import {
  selectSortedTodayHabits,
  selectStreakByHabit,
  selectTodayProgress,
  useHabitsStore,
} from '@/store/habits-store'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'motion/react'
import { Skeleton } from '@/components/ui/skeleton'
import { listItemVariants } from '@/lib/motion-tokens'

interface HabitWidgetProps {
  onNavigateToHabits?: (selectedHabitId?: string) => void
}

export function HabitWidget({ onNavigateToHabits }: HabitWidgetProps) {
  const { t } = useTranslation()

  const habits = useHabitsStore(state => state.habits)
  const todayLogs = useHabitsStore(state => state.todayLogs)
  const monthLogs = useHabitsStore(state => state.monthLogs)
  const isLoading = useHabitsStore(state => state.isLoading)

  const loadHabits = useHabitsStore(state => state.loadHabits)
  const loadTodayLogs = useHabitsStore(state => state.loadTodayLogs)
  const loadMonthLogs = useHabitsStore(state => state.loadMonthLogs)
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

  return (
    <WidgetCard title={t('widgets.habits.title')} icon={CheckCircle2}>
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-center justify-between border-b-2 border-foreground pb-2">
          <span className="text-xs font-bold uppercase tracking-widest text-accent">
            {t('widgets.habits.activeCount', {
              done: progress.done,
              total: progress.total || 0,
            })}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden pr-1">
          <AnimatePresence mode="popLayout" initial={false}>
            {isLoading ? (
              <motion.div
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between border border-border bg-background p-3 shadow-sm"
                  >
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="size-12 rounded-full" />
                  </div>
                ))}
              </motion.div>
            ) : visibleHabits.length === 0 ? (
              <motion.div
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex h-full flex-col items-center justify-center gap-1.5 rounded-none border border-dashed border-border/70 py-4 text-center"
              >
                <Flame
                  className="size-5 text-muted-foreground/30"
                  strokeWidth={1.5}
                />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/50">
                  {t('widgets.habits.empty')}
                </span>
              </motion.div>
            ) : (
              <div className="flex flex-col gap-4">
                {visibleHabits.map((habit, i) => {
                  const doneToday = todayLogs.some(
                    log => log.habit_id === habit.id
                  )
                  const streak = selectStreakByHabit(monthLogs, habit.id)
                  return (
                    <motion.div
                      key={habit.id}
                      layout
                      variants={listItemVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      custom={i}
                      className="w-full"
                    >
                      <div
                        className={cn(
                          'group/pill relative flex items-center justify-between overflow-hidden rounded-md border p-3 shadow-md transition-colors',
                          doneToday
                            ? 'border-foreground bg-foreground shadow-lg'
                            : 'border-border bg-background shadow-md'
                        )}
                      >
                        {/* Habit Name */}
                        <div className="flex min-w-0 flex-col pr-4">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedHabit(habit.id)
                              onNavigateToHabits?.(habit.id)
                            }}
                            className={cn(
                              'truncate text-left text-base font-bold uppercase tracking-wide transition-colors',
                              doneToday
                                ? 'text-chart-1'
                                : 'text-foreground hover:text-accent'
                            )}
                          >
                            {habit.name}
                          </button>
                          <span
                            className={cn(
                              'text-[10px] font-bold uppercase tracking-wider',
                              doneToday
                                ? 'text-chart-1/80'
                                : 'text-muted-foreground'
                            )}
                          >
                            {t('widgets.habits.streak', { count: streak })}
                          </span>
                        </div>

                        {/* Action Button */}
                        <div className="relative flex shrink-0 justify-end">
                          <div
                            className={cn(
                              'pointer-events-none absolute -top-10 right-2 z-10 text-xl font-bold text-chart-1 drop-shadow-md transition-all duration-300',
                              !doneToday &&
                                'translate-y-4 opacity-0 group-hover/btn:-translate-y-2 group-hover/btn:opacity-100'
                            )}
                          >
                            {doneToday ? '' : '+1'}
                          </div>
                          <button
                            type="button"
                            aria-label={
                              doneToday
                                ? t('widgets.habits.markUndoneAria')
                                : t('widgets.habits.markDoneAria')
                            }
                            onClick={() => void toggleHabit(habit.id)}
                            className={cn(
                              'group/btn z-0 flex h-12 w-12 items-center justify-center rounded-full border-[3px] transition-colors duration-200',
                              doneToday
                                ? 'border-chart-1 bg-chart-1 text-background'
                                : 'border-muted bg-background text-muted-foreground hover:border-chart-1 hover:bg-chart-1 hover:text-primary-foreground'
                            )}
                          >
                            <Flame
                              className="size-7 transition-all duration-300"
                              strokeWidth={doneToday ? 3 : 2}
                              fill={doneToday ? 'currentColor' : 'none'}
                            />
                          </button>
                        </div>
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
          className="self-end text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
        >
          {t('widgets.habits.viewAll')}
        </button>
      </div>
    </WidgetCard>
  )
}

import { useEffect, useState } from 'react'
import { Archive, Check, Flame, Plus, Trash2 } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { HeatMap } from '@/components/habits/HeatMap'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { HabitFrequency } from '@/lib/habits-domain'
import { cn } from '@/lib/utils'
import {
  selectHabitCompletionDates,
  selectLastNDates,
  selectHabitStats,
  selectSortedTodayHabits,
  selectStreakByHabit,
  selectTodayDoneSet,
  selectTodayProgress,
  useHabitsStore,
  type Habit,
  type HabitInput,
  type HabitLog,
} from '@/store/habits-store'

const HABIT_COLORS = [
  '#0ea5e9',
  '#22c55e',
  '#f59e0b',
  '#f97316',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#e11d48',
]

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const FREQUENCY_LABELS: Record<HabitFrequency, string> = {
  daily: 'Daily',
  weekdays: 'Weekdays',
  weekends: 'Weekends',
  custom: 'Custom',
}

const DISPLAY_FONT_FAMILY =
  '"Aptos Display", "Segoe UI Variable Display", "Trebuchet MS", "Gill Sans MT", sans-serif'
const BODY_FONT_FAMILY =
  '"Aptos", "Segoe UI Variable Text", "Segoe UI", "Candara", sans-serif'

interface HabitPageProps {
  initialSelectedHabitId?: string
}

interface HabitFormState {
  name: string
  color: string
  icon: string
  frequency: HabitFrequency
  frequencyDays: number[]
}

function parseFrequencyDays(frequencyDays?: string): number[] {
  if (!frequencyDays) return [1, 2, 3, 4, 5]

  try {
    const parsed = JSON.parse(frequencyDays)
    if (!Array.isArray(parsed)) return [1, 2, 3, 4, 5]

    const normalized = parsed
      .filter(
        (value): value is number =>
          typeof value === 'number' && value >= 0 && value <= 6
      )
      .sort((a, b) => a - b)

    return normalized.length > 0 ? [...new Set(normalized)] : [1, 2, 3, 4, 5]
  } catch {
    return [1, 2, 3, 4, 5]
  }
}

function defaultFormState(): HabitFormState {
  return {
    name: '',
    color: HABIT_COLORS[0] ?? '#0ea5e9',
    icon: '',
    frequency: 'daily',
    frequencyDays: [1, 2, 3, 4, 5],
  }
}

function formFromHabit(habit: Habit): HabitFormState {
  return {
    name: habit.name,
    color: habit.color,
    icon: habit.icon ?? '',
    frequency: habit.frequency,
    frequencyDays: parseFrequencyDays(habit.frequency_days),
  }
}

function toHabitInput(form: HabitFormState): HabitInput {
  return {
    name: form.name.trim(),
    color: form.color,
    icon: form.icon.trim() || undefined,
    frequency: form.frequency,
    frequency_days:
      form.frequency === 'custom'
        ? JSON.stringify(form.frequencyDays)
        : undefined,
  }
}

function formatCustomDays(days: number[]): string {
  const normalized = [...new Set(days)].sort((a, b) => a - b)
  if (normalized.length === 0) return 'No days selected'
  if (normalized.length === 7) return 'Every day'
  return normalized.map(day => WEEKDAY_LABELS[day] ?? '?').join(' ')
}

function formatHabitFrequency(habit: Habit): string {
  if (habit.frequency !== 'custom') return FREQUENCY_LABELS[habit.frequency]
  return formatCustomDays(parseFrequencyDays(habit.frequency_days))
}

function weekdayName(index: number): string {
  return WEEKDAY_LABELS[index] ?? 'N/A'
}

function weekdayDistribution(logs: HabitLog[]): number[] {
  const distribution = [0, 0, 0, 0, 0, 0, 0]

  for (const log of logs) {
    const date = new Date(`${log.completed_date}T12:00:00`)
    if (Number.isNaN(date.getTime())) continue
    const day = date.getDay()
    distribution[day] = (distribution[day] ?? 0) + 1
  }

  return distribution
}

function todayLabel(): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date())
}

function SegmentedTab({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-colors',
        active
          ? 'bg-foreground text-background'
          : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground'
      )}
    >
      {label}
    </button>
  )
}

export function HabitPage({ initialSelectedHabitId }: HabitPageProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null)
  const [form, setForm] = useState<HabitFormState>(defaultFormState())
  const reduceMotion = useReducedMotion()

  const habits = useHabitsStore(state => state.habits)
  const todayLogs = useHabitsStore(state => state.todayLogs)
  const monthLogs = useHabitsStore(state => state.monthLogs)
  const activeTab = useHabitsStore(state => state.activeTab)
  const selectedHabitId = useHabitsStore(state => state.selectedHabitId)
  const isLoading = useHabitsStore(state => state.isLoading)

  const loadHabits = useHabitsStore(state => state.loadHabits)
  const loadTodayLogs = useHabitsStore(state => state.loadTodayLogs)
  const loadMonthLogs = useHabitsStore(state => state.loadMonthLogs)
  const setSelectedHabit = useHabitsStore(state => state.setSelectedHabit)
  const setActiveTab = useHabitsStore(state => state.setActiveTab)
  const addHabit = useHabitsStore(state => state.addHabit)
  const updateHabit = useHabitsStore(state => state.updateHabit)
  const toggleHabit = useHabitsStore(state => state.toggleHabit)
  const archiveHabit = useHabitsStore(state => state.archiveHabit)
  const deleteHabit = useHabitsStore(state => state.deleteHabit)

  useEffect(() => {
    void Promise.all([loadHabits(), loadTodayLogs(), loadMonthLogs()])
  }, [loadHabits, loadMonthLogs, loadTodayLogs])

  useEffect(() => {
    if (initialSelectedHabitId) {
      setSelectedHabit(initialSelectedHabitId)
    }
  }, [initialSelectedHabitId, setSelectedHabit])

  const todayHabits = selectSortedTodayHabits(habits, todayLogs)
  const todayDoneSet = selectTodayDoneSet(todayLogs)
  const progress = selectTodayProgress(habits, todayLogs)
  const stats = selectHabitStats(habits, monthLogs)

  const progressPercent = Math.round(progress.ratio * 100)

  const focusedHabit =
    habits.find(habit => habit.id === selectedHabitId) ??
    todayHabits[0] ??
    habits[0] ??
    null

  const focusCompletionDates = focusedHabit
    ? selectHabitCompletionDates(monthLogs, focusedHabit.id)
    : []
  const focusCompletionSet = new Set(focusCompletionDates)
  const focusMatrixDates = selectLastNDates(30)
  const focusStreak = focusedHabit
    ? selectStreakByHabit(monthLogs, focusedHabit.id)
    : 0

  const weekdayCounts = weekdayDistribution(monthLogs)
  const weekdayPeak = Math.max(1, ...weekdayCounts)

  const canSubmit =
    form.name.trim().length > 0 &&
    (form.frequency !== 'custom' || form.frequencyDays.length > 0)

  const transition = {
    duration: reduceMotion ? 0 : 0.32,
    ease: [0.22, 1, 0.36, 1],
  } as const

  const openCreate = () => {
    setEditingHabitId(null)
    setForm(defaultFormState())
    setModalOpen(true)
  }

  const openEdit = (habit: Habit) => {
    setSelectedHabit(habit.id)
    setEditingHabitId(habit.id)
    setForm(formFromHabit(habit))
    setModalOpen(true)
  }

  const submitForm = async () => {
    if (!canSubmit) return

    const payload = toHabitInput(form)
    if (editingHabitId) {
      await updateHabit(editingHabitId, payload)
    } else {
      await addHabit(payload)
    }

    setModalOpen(false)
  }

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden bg-background text-foreground"
      style={{ fontFamily: BODY_FONT_FAMILY }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 5% 0%, color-mix(in oklab, var(--accent) 16%, transparent), transparent 58%), radial-gradient(90% 70% at 100% 100%, color-mix(in oklab, var(--primary) 14%, transparent), transparent 60%)',
        }}
      />

      <header className="relative border-b border-border/70 px-5 pb-5 pt-6 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1
              className="text-2xl font-semibold leading-tight md:text-[2rem]"
              style={{ fontFamily: DISPLAY_FONT_FAMILY }}
            >
              Disciplined Momentum
            </h1>
            <p className="text-sm text-muted-foreground">{todayLabel()}</p>
          </div>

          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" />
            New Habit
          </Button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <section className="rounded-2xl border border-border/70 bg-card/70 px-4 py-3 backdrop-blur-[1px]">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Daily Completion
              </p>
              <p className="text-sm font-medium">
                {progress.done} of {progress.total} due habits finished
              </p>
            </div>

            <div className="mt-2 h-4 overflow-hidden rounded-full bg-muted/70">
              <motion.div
                className="h-full rounded-full bg-foreground/85"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={transition}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-card/70 px-4 py-3 backdrop-blur-[1px]">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Monthly Signal
              </p>
              <p className="font-medium">
                {stats.monthRate.percentage}% consistency
              </p>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Completed activity on {stats.monthRate.completedDays} of{' '}
              {stats.monthRate.totalDays} tracked days.
            </p>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted/70">
              <motion.div
                className="h-full rounded-full bg-foreground/80"
                initial={{ width: 0 }}
                animate={{ width: `${stats.monthRate.percentage}%` }}
                transition={transition}
              />
            </div>
          </section>
        </div>
      </header>

      <div className="relative border-b border-border/70 px-5 py-3 md:px-8">
        <div className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/70 p-1">
          <SegmentedTab
            active={activeTab === 'today'}
            label="Today"
            onClick={() => setActiveTab('today')}
          />
          <SegmentedTab
            active={activeTab === 'overview'}
            label="Overview"
            onClick={() => setActiveTab('overview')}
          />
          <SegmentedTab
            active={activeTab === 'stats'}
            label="Stats"
            onClick={() => setActiveTab('stats')}
          />
        </div>
      </div>

      <div className="relative flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-6">
        <AnimatePresence mode="wait">
          {activeTab === 'today' ? (
            <motion.section
              key="today"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
              transition={transition}
              className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,1fr)]"
            >
              <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 backdrop-blur-[1px]">
                <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Execution Queue
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {todayHabits.length} due today
                  </p>
                </div>

                {isLoading ? (
                  <div className="space-y-3 px-4 py-4">
                    <div className="h-14 animate-pulse rounded-xl bg-muted/60" />
                    <div className="h-14 animate-pulse rounded-xl bg-muted/50" />
                    <div className="h-14 animate-pulse rounded-xl bg-muted/40" />
                  </div>
                ) : todayHabits.length === 0 ? (
                  <div className="space-y-3 px-4 py-8 text-center">
                    <p className="text-sm font-medium">
                      No habits scheduled today.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Add a habit to start building your daily cadence.
                    </p>
                    <div>
                      <Button size="sm" variant="outline" onClick={openCreate}>
                        <Plus className="size-3.5" />
                        Create Habit
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {todayHabits.map((habit, index) => {
                      const doneToday = todayDoneSet.has(habit.id)
                      const streak = selectStreakByHabit(monthLogs, habit.id)
                      const completionDates = selectHabitCompletionDates(
                        monthLogs,
                        habit.id
                      )

                      return (
                        <motion.article
                          key={habit.id}
                          initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            ...transition,
                            delay: reduceMotion ? 0 : index * 0.04,
                          }}
                          className="grid gap-3 px-4 py-4 transition-colors hover:bg-accent/15 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center"
                          style={{
                            backgroundColor: doneToday
                              ? 'color-mix(in oklab, var(--card) 86%, transparent)'
                              : `color-mix(in oklab, ${habit.color} 12%, var(--card))`,
                          }}
                        >
                          <button
                            type="button"
                            aria-label={
                              doneToday
                                ? `Mark ${habit.name} as not done`
                                : `Mark ${habit.name} as done`
                            }
                            onClick={() => void toggleHabit(habit.id)}
                            className={cn(
                              'mt-0.5 flex size-8 items-center justify-center self-start rounded-full border transition-all',
                              doneToday
                                ? 'border-transparent text-white'
                                : 'border-muted-foreground/45 text-transparent hover:border-foreground/60'
                            )}
                            style={{
                              backgroundColor: doneToday
                                ? habit.color
                                : 'transparent',
                            }}
                          >
                            <Check className="size-3.5" strokeWidth={3} />
                          </button>

                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedHabit(habit.id)}
                                className={cn(
                                  'min-w-0 truncate text-start text-sm font-semibold',
                                  doneToday &&
                                    'text-muted-foreground line-through'
                                )}
                              >
                                {habit.icon ? `${habit.icon} ` : ''}
                                {habit.name}
                              </button>

                              <span className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                                {formatHabitFrequency(habit)}
                              </span>

                              <div className="ml-1 shrink-0">
                                <HeatMap
                                  logs={completionDates}
                                  days={7}
                                  color={habit.color}
                                  size="md"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="md:justify-self-end">
                            <div className="flex items-center gap-3">
                              <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
                                <Flame className="size-3.5" />
                                {streak} day run
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(habit)}
                              >
                                Edit
                              </Button>
                            </div>
                          </div>
                        </motion.article>
                      )
                    })}
                  </div>
                )}
              </section>

              <aside className="space-y-4">
                <section className="rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur-[1px]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        Hábito em foco
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Selecione um hábito na lista para ver consistência e
                        ajustar frequência.
                      </p>
                    </div>
                    {focusedHabit ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(focusedHabit)}
                      >
                        Manage
                      </Button>
                    ) : null}
                  </div>

                  {focusedHabit ? (
                    <div className="mt-3 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold">
                            {focusedHabit.icon ? `${focusedHabit.icon} ` : ''}
                            {focusedHabit.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatHabitFrequency(focusedHabit)}
                          </p>
                        </div>
                        <select
                          value={selectedHabitId ?? focusedHabit.id}
                          onChange={event =>
                            setSelectedHabit(event.target.value || null)
                          }
                          className="h-8 max-w-[190px] rounded-md border border-border bg-background px-2 text-xs"
                          aria-label="Trocar hábito em foco"
                        >
                          {habits.map(habit => (
                            <option key={habit.id} value={habit.id}>
                              {habit.icon ? `${habit.icon} ` : ''}
                              {habit.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-10 gap-1.5">
                        {focusMatrixDates.map(dateISO => {
                          const completed = focusCompletionSet.has(dateISO)
                          return (
                            <div
                              key={dateISO}
                              title={`${dateISO} - ${completed ? 'Completed' : 'Missed'}`}
                              className="size-3 rounded-[4px] border border-border/60"
                              style={{
                                backgroundColor: completed
                                  ? focusedHabit.color
                                  : 'color-mix(in oklab, var(--muted) 72%, transparent)',
                                opacity: completed ? 0.9 : 0.6,
                              }}
                            />
                          )
                        })}
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Current streak: {focusStreak} day
                        {focusStreak === 1 ? '' : 's'}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Nenhum hábito selecionado. Clique em um item da lista para
                      abrir os detalhes aqui.
                    </p>
                  )}
                </section>

                <section className="rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur-[1px]">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Resumo rápido
                  </p>
                  <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                    <p>
                      Top current streak:{' '}
                      {stats.topCurrentHabit
                        ? `${stats.topCurrentHabit.name} (${stats.topCurrentHabit.streak}d)`
                        : 'No data yet'}
                    </p>
                    <p>
                      Most consistent weekday:{' '}
                      {stats.topWeekday === null
                        ? 'No data yet'
                        : weekdayName(stats.topWeekday)}
                    </p>
                  </div>
                </section>
              </aside>
            </motion.section>
          ) : activeTab === 'overview' ? (
            <motion.section
              key="overview"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
              transition={transition}
              className="space-y-4"
            >
              {habits.length === 0 ? (
                <section className="rounded-2xl border border-border/70 bg-card/80 px-4 py-8 text-center backdrop-blur-[1px]">
                  <p className="text-sm font-medium">
                    No habits in your system yet.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Create one habit to unlock this overview.
                  </p>
                </section>
              ) : (
                <div
                  className="grid gap-4"
                  style={{
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  }}
                >
                  {habits.map(habit => {
                    const completionDates = selectHabitCompletionDates(
                      monthLogs,
                      habit.id
                    )
                    const streak = selectStreakByHabit(monthLogs, habit.id)
                    const doneToday = todayDoneSet.has(habit.id)

                    return (
                      <article
                        key={habit.id}
                        className="rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur-[1px] transition-colors hover:bg-accent/12"
                        style={{
                          borderColor: `color-mix(in oklab, ${habit.color} 46%, var(--border))`,
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => openEdit(habit)}
                              className="truncate text-start text-sm font-semibold"
                            >
                              {habit.icon ? `${habit.icon} ` : ''}
                              {habit.name}
                            </button>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatHabitFrequency(habit)}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {streak}d run
                          </span>
                        </div>

                        <div className="mt-3">
                          <HeatMap
                            logs={completionDates}
                            days={30}
                            color={habit.color}
                            size="md"
                          />
                        </div>

                        <p className="mt-3 text-xs text-muted-foreground">
                          {doneToday ? 'Completed today' : 'Pending today'}
                        </p>
                      </article>
                    )
                  })}
                </div>
              )}
            </motion.section>
          ) : (
            <motion.section
              key="stats"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
              transition={transition}
              className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"
            >
              <section className="rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur-[1px]">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Weekday Pressure Map
                </p>

                <div className="mt-3 space-y-2">
                  {WEEKDAY_LABELS.map((label, day) => {
                    const value = weekdayCounts[day] ?? 0
                    const width = `${Math.round((value / weekdayPeak) * 100)}%`
                    return (
                      <div
                        key={label}
                        className="grid grid-cols-[32px_minmax(0,1fr)_30px] items-center gap-2 text-xs"
                      >
                        <span className="text-muted-foreground">{label}</span>
                        <div className="h-2 overflow-hidden rounded-full bg-muted/60">
                          <div
                            className="h-full rounded-full bg-foreground/80 transition-all duration-300"
                            style={{ width }}
                          />
                        </div>
                        <span className="text-end text-muted-foreground">
                          {value}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </section>

              <section className="rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur-[1px]">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Historical Board
                </p>

                {stats.bestHistoricalByHabit.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    No streak data yet.
                  </p>
                ) : (
                  <ol className="mt-3 space-y-2">
                    {stats.bestHistoricalByHabit
                      .slice(0, 5)
                      .map((item, index) => (
                        <li
                          key={item.habitId}
                          className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2 text-sm"
                        >
                          <span>
                            {index + 1}. {item.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {item.streak} days
                          </span>
                        </li>
                      ))}
                  </ol>
                )}

                <p className="mt-4 text-xs text-muted-foreground">
                  Completion window: {stats.monthRate.completedDays} active days
                  out of {stats.monthRate.totalDays}.
                </p>
              </section>
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>
              {editingHabitId ? 'Edit Habit' : 'Create New Habit'}
            </DialogTitle>
            <DialogDescription>
              Define cadence, visual tag, and execution days.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-5"
            onSubmit={event => {
              event.preventDefault()
              void submitForm()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="habit-name">Habit Name</Label>
              <Input
                id="habit-name"
                value={form.name}
                onChange={event =>
                  setForm(current => ({ ...current, name: event.target.value }))
                }
                placeholder="Evening walk"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="habit-icon">Icon (emoji)</Label>
              <Input
                id="habit-icon"
                maxLength={2}
                value={form.icon}
                onChange={event =>
                  setForm(current => ({ ...current, icon: event.target.value }))
                }
                placeholder="🚶"
              />
            </div>

            <div className="space-y-2">
              <Label>Frequency</Label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(FREQUENCY_LABELS) as HabitFrequency[]).map(
                  frequency => (
                    <button
                      key={frequency}
                      type="button"
                      onClick={() =>
                        setForm(current => ({
                          ...current,
                          frequency,
                          frequencyDays:
                            frequency === 'weekdays'
                              ? [1, 2, 3, 4, 5]
                              : frequency === 'weekends'
                                ? [0, 6]
                                : current.frequencyDays.length === 0
                                  ? [1, 2, 3, 4, 5]
                                  : current.frequencyDays,
                        }))
                      }
                      className={cn(
                        'rounded-xl border px-3 py-2 text-xs font-medium transition-colors',
                        form.frequency === frequency
                          ? 'border-foreground bg-accent/70'
                          : 'border-border hover:bg-accent/30'
                      )}
                    >
                      {FREQUENCY_LABELS[frequency]}
                    </button>
                  )
                )}
              </div>
            </div>

            {form.frequency === 'custom' && (
              <div className="space-y-2">
                <Label>Custom Days</Label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAY_LABELS.map((label, day) => {
                    const active = form.frequencyDays.includes(day)
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() =>
                          setForm(current => ({
                            ...current,
                            frequencyDays: active
                              ? current.frequencyDays.filter(
                                  value => value !== day
                                )
                              : [...current.frequencyDays, day].sort(
                                  (a, b) => a - b
                                ),
                          }))
                        }
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                          active
                            ? 'border-foreground bg-accent/70'
                            : 'border-border hover:bg-accent/30'
                        )}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
                {form.frequencyDays.length === 0 && (
                  <p className="text-xs text-destructive">
                    Pick at least one day.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {HABIT_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm(current => ({ ...current, color }))}
                    className={cn(
                      'size-7 rounded-full border transition-transform hover:scale-105',
                      form.color === color
                        ? 'border-foreground ring-2 ring-ring/50'
                        : 'border-transparent'
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
            </div>

            <DialogFooter className="justify-between sm:justify-between">
              {editingHabitId ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await archiveHabit(editingHabitId)
                      setModalOpen(false)
                    }}
                  >
                    <Archive className="size-3.5" />
                    Archive
                  </Button>

                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={async () => {
                      const confirmed = window.confirm(
                        'Delete this habit permanently? This will remove all logs.'
                      )
                      if (!confirmed) return
                      await deleteHabit(editingHabitId)
                      setModalOpen(false)
                    }}
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </Button>
                </div>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={!canSubmit}>
                  {editingHabitId ? 'Save Changes' : 'Create Habit'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="relative border-t border-border/70 px-5 py-2 text-[11px] text-muted-foreground md:px-8">
        {focusedHabit
          ? `Focus lock: ${focusedHabit.name}`
          : 'Focus lock: select a habit to track its signal.'}
      </div>
    </div>
  )
}

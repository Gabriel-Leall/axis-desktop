import { useEffect, useMemo, useState } from 'react'
import { Flame, Plus, Archive, Trash2 } from 'lucide-react'
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
import { HeatMap } from '@/components/habits/HeatMap'
import {
  selectHabitCompletionDates,
  selectHabitStats,
  selectSortedTodayHabits,
  selectStreakByHabit,
  selectTodayProgress,
  useHabitsStore,
  type Habit,
  type HabitInput,
} from '@/store/habits-store'
import { cn } from '@/lib/utils'
import type { HabitFrequency } from '@/lib/habits-domain'

const HABIT_COLORS = [
  '#22c55e',
  '#16a34a',
  '#3b82f6',
  '#06b6d4',
  '#8b5cf6',
  '#eab308',
  '#f97316',
  '#ef4444',
]

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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

function defaultFormState(): HabitFormState {
  return {
    name: '',
    color: HABIT_COLORS[0] ?? '#22c55e',
    icon: '',
    frequency: 'daily',
    frequencyDays: [1, 2, 3, 4, 5],
  }
}

function formFromHabit(habit: Habit): HabitFormState {
  let days = [1, 2, 3, 4, 5]
  if (habit.frequency_days) {
    try {
      const parsed = JSON.parse(habit.frequency_days)
      if (Array.isArray(parsed)) {
        days = parsed.filter(
          (value): value is number => typeof value === 'number'
        )
      }
    } catch {
      days = [1, 2, 3, 4, 5]
    }
  }

  return {
    name: habit.name,
    color: habit.color,
    icon: habit.icon ?? '',
    frequency: habit.frequency,
    frequencyDays: days,
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

function weekdayName(weekday: number): string {
  return WEEKDAY_LABELS[weekday] ?? 'N/A'
}

function TabButton({
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
        'rounded-md px-3 py-1.5 text-xs transition-colors',
        active
          ? 'bg-accent text-foreground'
          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
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

  const todayHabits = useMemo(
    () => selectSortedTodayHabits(habits, todayLogs),
    [habits, todayLogs]
  )
  const progress = selectTodayProgress(habits, todayLogs)
  const stats = selectHabitStats(habits, monthLogs)

  const selectedHabit =
    habits.find(habit => habit.id === selectedHabitId) ?? null

  const openCreate = () => {
    setEditingHabitId(null)
    setForm(defaultFormState())
    setModalOpen(true)
  }

  const openEdit = (habit: Habit) => {
    setEditingHabitId(habit.id)
    setForm(formFromHabit(habit))
    setModalOpen(true)
  }

  const submitForm = async () => {
    const payload = toHabitInput(form)
    if (!payload.name) return

    if (editingHabitId) {
      await updateHabit(editingHabitId, payload)
    } else {
      await addHabit(payload)
    }
    setModalOpen(false)
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">Habits</h1>
          <p className="text-xs text-muted-foreground">
            {progress.done} / {progress.total || 0} done today
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-3.5" />
          New Habit
        </Button>
      </div>

      <div className="flex items-center gap-1 border-b border-border px-6 py-2">
        <TabButton
          active={activeTab === 'today'}
          label="Today"
          onClick={() => setActiveTab('today')}
        />
        <TabButton
          active={activeTab === 'overview'}
          label="Overview"
          onClick={() => setActiveTab('overview')}
        />
        <TabButton
          active={activeTab === 'stats'}
          label="Stats"
          onClick={() => setActiveTab('stats')}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading habits...</p>
        ) : activeTab === 'today' ? (
          <div className="space-y-2">
            {todayHabits.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No habits due today.
              </p>
            ) : (
              todayHabits.map(habit => {
                const doneToday = todayLogs.some(
                  log => log.habit_id === habit.id
                )
                const streak = selectStreakByHabit(monthLogs, habit.id)
                const completionDates = selectHabitCompletionDates(
                  monthLogs,
                  habit.id
                )

                return (
                  <div
                    key={habit.id}
                    className={cn(
                      'rounded-lg border border-border bg-card p-3',
                      doneToday && 'opacity-75'
                    )}
                    style={{ borderInlineStart: `3px solid ${habit.color}` }}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void toggleHabit(habit.id)}
                        aria-label={
                          doneToday ? 'Mark as not done' : 'Mark as done'
                        }
                        className={cn(
                          'size-5 rounded-full border transition-colors',
                          doneToday
                            ? 'border-transparent'
                            : 'border-muted-foreground/60'
                        )}
                        style={{
                          backgroundColor: doneToday
                            ? habit.color
                            : 'transparent',
                        }}
                      />

                      <button
                        type="button"
                        className={cn(
                          'flex-1 text-left text-sm font-medium',
                          doneToday && 'line-through text-muted-foreground'
                        )}
                        onClick={() => {
                          setSelectedHabit(habit.id)
                          openEdit(habit)
                        }}
                      >
                        {habit.icon ? `${habit.icon} ` : ''}
                        {habit.name}
                      </button>

                      <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
                        <Flame className="size-3" />
                        {streak}
                      </span>
                    </div>

                    <div className="mt-2">
                      <HeatMap
                        logs={completionDates}
                        days={7}
                        color={habit.color}
                        size="md"
                      />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        ) : activeTab === 'overview' ? (
          <div className="space-y-3">
            {habits.map(habit => {
              const completionDates = selectHabitCompletionDates(
                monthLogs,
                habit.id
              )
              const streak = selectStreakByHabit(monthLogs, habit.id)
              return (
                <div
                  key={habit.id}
                  className="rounded-lg border border-border bg-card p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className="truncate text-sm font-medium"
                      onClick={() => openEdit(habit)}
                    >
                      {habit.icon ? `${habit.icon} ` : ''}
                      {habit.name}
                    </button>
                    <span className="font-mono text-xs text-muted-foreground">
                      {streak}d
                    </span>
                  </div>
                  <HeatMap
                    logs={completionDates}
                    days={30}
                    color={habit.color}
                    size="md"
                  />
                </div>
              )
            })}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">
                Current best streak
              </p>
              <p className="mt-1 text-sm font-medium">
                {stats.topCurrentHabit
                  ? `${stats.topCurrentHabit.name} - ${stats.topCurrentHabit.streak}d`
                  : 'No data yet'}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">
                Monthly completion rate
              </p>
              <p className="mt-1 text-sm font-medium">
                {stats.monthRate.percentage}% - {stats.monthRate.completedDays}{' '}
                of {stats.monthRate.totalDays} days
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">
                Best historical streaks
              </p>
              <div className="mt-1 space-y-1">
                {stats.bestHistoricalByHabit.length === 0 ? (
                  <p className="text-sm">No data yet</p>
                ) : (
                  stats.bestHistoricalByHabit.slice(0, 4).map(item => (
                    <p key={item.habitId} className="text-sm">
                      {item.name}: {item.streak}d
                    </p>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">
                Most consistent weekday
              </p>
              <p className="mt-1 text-sm font-medium">
                {stats.topWeekday === null
                  ? 'No data yet'
                  : weekdayName(stats.topWeekday)}
              </p>
            </div>
          </div>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingHabitId ? 'Edit Habit' : 'New Habit'}
            </DialogTitle>
            <DialogDescription>
              Configure your habit frequency, color, and icon.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="habit-name">Name</Label>
              <Input
                id="habit-name"
                value={form.name}
                onChange={event =>
                  setForm(current => ({ ...current, name: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {HABIT_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      'size-6 rounded-full border',
                      form.color === color
                        ? 'border-foreground ring-2 ring-ring/50'
                        : 'border-transparent'
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setForm(current => ({ ...current, color }))}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="habit-icon">Icon (optional emoji)</Label>
              <Input
                id="habit-icon"
                maxLength={2}
                value={form.icon}
                onChange={event =>
                  setForm(current => ({ ...current, icon: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Frequency</Label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    'daily',
                    'weekdays',
                    'weekends',
                    'custom',
                  ] as HabitFrequency[]
                ).map(frequency => (
                  <button
                    key={frequency}
                    type="button"
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-xs capitalize',
                      form.frequency === frequency
                        ? 'border-foreground bg-accent'
                        : 'border-border'
                    )}
                    onClick={() =>
                      setForm(current => ({ ...current, frequency }))
                    }
                  >
                    {frequency}
                  </button>
                ))}
              </div>
            </div>

            {form.frequency === 'custom' && (
              <div className="space-y-2">
                <Label>Days</Label>
                <div className="flex flex-wrap gap-1">
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
                          'rounded-md border px-2 py-1 text-[11px]',
                          active
                            ? 'border-foreground bg-accent'
                            : 'border-border'
                        )}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="justify-between sm:justify-between">
            {editingHabitId ? (
              <div className="flex items-center gap-2">
                <Button
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
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={() => void submitForm()}>
                {editingHabitId ? 'Save' : 'Create Habit'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedHabit && (
        <div className="border-t border-border px-6 py-2 text-xs text-muted-foreground">
          Focus: {selectedHabit.name}
        </div>
      )}
    </div>
  )
}

import { useEffect, useReducer, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  Archive,
  AlertCircle,
  Check,
  CircleDot,
  Flame,
  MoreHorizontal,
  PauseCircle,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  m,
  useReducedMotion,
} from 'motion/react'
import { HeatMap } from '@/components/habits/HeatMap'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { HabitFrequency } from '@/lib/habits-domain'
import { cn } from '@/lib/utils'
import {
  selectHabitCompletionDates,
  selectHabitLogStateMap,
  selectRecoverableDatesForHabit,
  selectHabitStats,
  selectSortedTodayHabits,
  selectStreakByHabit,
  selectTodayLogMap,
  selectTodayProgress,
  useHabitsStore,
  type Habit,
  type HabitInput,
  type HabitLog,
} from '@/store/habits-store'

// HABIT_COLORS: user-facing accent swatches — intentionally not design-system tokens
// because they are stored per-habit and displayed as absolute color swatches.
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

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

const FREQUENCY_KEYS: HabitFrequency[] = [
  'daily',
  'weekdays',
  'weekends',
  'custom',
]

const HABIT_COLOR_NAMES: Record<string, string> = {
  '#0ea5e9': 'blue',
  '#22c55e': 'green',
  '#f59e0b': 'amber',
  '#f97316': 'orange',
  '#ef4444': 'red',
  '#8b5cf6': 'violet',
  '#06b6d4': 'cyan',
  '#e11d48': 'rose',
}

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

interface HabitModalState {
  open: boolean
  editingHabitId: string | null
  form: HabitFormState
  error: string | null
  deleteConfirmOpen: boolean
}

type HabitModalAction =
  | { type: 'open-create' }
  | { type: 'open-edit'; habit: Habit }
  | { type: 'set-open'; open: boolean }
  | { type: 'set-delete-confirm-open'; open: boolean }
  | { type: 'set-error'; error: string | null }
  | { type: 'set-form'; form: HabitFormState }
  | { type: 'saved' }
  | { type: 'deleted' }

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

function defaultModalState(): HabitModalState {
  return {
    open: false,
    editingHabitId: null,
    form: defaultFormState(),
    error: null,
    deleteConfirmOpen: false,
  }
}

function habitModalReducer(
  state: HabitModalState,
  action: HabitModalAction
): HabitModalState {
  if (action.type === 'open-create') {
    return {
      open: true,
      editingHabitId: null,
      form: defaultFormState(),
      error: null,
      deleteConfirmOpen: false,
    }
  }

  if (action.type === 'open-edit') {
    return {
      open: true,
      editingHabitId: action.habit.id,
      form: formFromHabit(action.habit),
      error: null,
      deleteConfirmOpen: false,
    }
  }

  if (action.type === 'set-open') {
    return { ...state, open: action.open }
  }

  if (action.type === 'set-delete-confirm-open') {
    return { ...state, deleteConfirmOpen: action.open }
  }

  if (action.type === 'set-error') {
    return { ...state, error: action.error }
  }

  if (action.type === 'set-form') {
    return { ...state, form: action.form }
  }

  if (action.type === 'saved') {
    return { ...state, open: false }
  }

  return {
    ...state,
    open: false,
    deleteConfirmOpen: false,
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

function formatCustomDays(days: number[], t: TFunction): string {
  const normalized = Array.from(new Set(days)).toSorted((a, b) => a - b)
  if (normalized.length === 0) return t('habits.formatNodays')
  if (normalized.length === 7) return t('habits.formatEveryDay')
  return normalized
    .map(day => {
      const key = WEEKDAY_KEYS[day]
      return key ? t(`habits.weekday.${key}`) : '?'
    })
    .join(' ')
}

function formatHabitFrequency(habit: Habit, t: TFunction): string {
  if (habit.frequency !== 'custom') {
    return t(`habits.frequency.${habit.frequency}`)
  }
  return formatCustomDays(parseFrequencyDays(habit.frequency_days), t)
}

function weekdayName(index: number, t: TFunction): string {
  const key = WEEKDAY_KEYS[index]
  return key ? t(`habits.weekday.${key}`) : t('habits.quickSummary.noData')
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

function todayLabel(locale: string): string {
  return new Date().toLocaleDateString(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

function recoveryDateLabel(
  dateISO: string,
  locale: string,
  t: TFunction
): string {
  const target = new Date(`${dateISO}T12:00:00`)
  if (Number.isNaN(target.getTime())) return dateISO

  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000)

  if (diffDays === 0) return t('habits.recovery.today')
  if (diffDays === 1) return t('habits.recovery.yesterday')
  if (diffDays > 1 && diffDays < 7) {
    return t('habits.recovery.daysAgo', { count: diffDays })
  }

  return target.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
  })
}

function SegmentedTab({
  active,
  label,
  onClick,
  id,
  controls,
}: {
  active: boolean
  label: string
  onClick: () => void
  id: string
  controls: string
}) {
  return (
    <button
      id={id}
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={controls}
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

interface HabitFormSectionProps {
  form: HabitFormState
  t: TFunction
  onChange: (form: HabitFormState) => void
}

function HabitIdentityFields({ form, t, onChange }: HabitFormSectionProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="habit-name">{t('habits.modal.habitName')}</Label>
        <Input
          id="habit-name"
          value={form.name}
          onChange={event =>
            onChange({
              ...form,
              name: event.target.value,
            })
          }
          placeholder={t('habits.modal.namePlaceholder')}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="habit-icon">{t('habits.modal.iconLabel')}</Label>
        <Input
          id="habit-icon"
          maxLength={2}
          value={form.icon}
          onChange={event =>
            onChange({
              ...form,
              icon: event.target.value,
            })
          }
          placeholder={t('habits.modal.iconPlaceholder')}
        />
      </div>
    </>
  )
}

function HabitFrequencyField({ form, t, onChange }: HabitFormSectionProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="habit-frequency">
          {t('habits.modal.frequencyLabel')}
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {FREQUENCY_KEYS.map(frequency => (
            <button
              key={frequency}
              type="button"
              aria-pressed={form.frequency === frequency}
              onClick={() =>
                onChange({
                  ...form,
                  frequency,
                  frequencyDays:
                    frequency === 'weekdays'
                      ? [1, 2, 3, 4, 5]
                      : frequency === 'weekends'
                        ? [0, 6]
                        : form.frequencyDays.length === 0
                          ? [1, 2, 3, 4, 5]
                          : form.frequencyDays,
                })
              }
              className={cn(
                'rounded-xl border px-3 py-2 text-xs font-medium transition-colors',
                form.frequency === frequency
                  ? 'border-foreground bg-accent/70'
                  : 'border-border hover:bg-accent/30'
              )}
            >
              {t(`habits.frequency.${frequency}`)}
            </button>
          ))}
        </div>
      </div>

      {form.frequency === 'custom' && (
        <div className="space-y-2">
          <Label htmlFor="habit-custom-days">
            {t('habits.modal.customDaysLabel')}
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_KEYS.map((key, day) => {
              const active = form.frequencyDays.includes(day)
              const label = t(`habits.weekday.${key}`)
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    onChange({
                      ...form,
                      frequencyDays: active
                        ? form.frequencyDays.filter(value => value !== day)
                        : [...form.frequencyDays, day].toSorted(
                            (a, b) => a - b
                          ),
                    })
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
              {t('habits.modal.atLeastOneDay')}
            </p>
          )}
        </div>
      )}
    </>
  )
}

function HabitColorField({ form, t, onChange }: HabitFormSectionProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="habit-color">{t('habits.modal.colorLabel')}</Label>
      <div className="flex flex-wrap gap-2">
        {HABIT_COLORS.map(color => (
          <button
            key={color}
            type="button"
            aria-pressed={form.color === color}
            onClick={() => onChange({ ...form, color })}
            className={cn(
              'size-7 rounded-full border transition-transform hover:scale-105',
              form.color === color
                ? 'border-foreground ring-2 ring-ring/50'
                : 'border-transparent'
            )}
            style={{ backgroundColor: color }}
            aria-label={t('habits.modal.colorAria', {
              color: t(`habits.colors.${HABIT_COLOR_NAMES[color] ?? 'custom'}`),
            })}
          />
        ))}
      </div>
    </div>
  )
}

interface HabitEditorActionsProps {
  canSubmit: boolean
  deleteConfirmOpen: boolean
  editingHabitId: string | null
  t: TFunction
  onArchive: () => void
  onCancel: () => void
  onDelete: () => void
  onDeleteConfirmOpenChange: (open: boolean) => void
}

function HabitEditorActions({
  canSubmit,
  deleteConfirmOpen,
  editingHabitId,
  t,
  onArchive,
  onCancel,
  onDelete,
  onDeleteConfirmOpenChange,
}: HabitEditorActionsProps) {
  return (
    <DialogFooter className="justify-between sm:justify-between">
      {editingHabitId ? (
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onArchive}>
            <Archive className="size-3.5" />
            {t('habits.modal.archive')}
          </Button>

          <AlertDialog
            open={deleteConfirmOpen}
            onOpenChange={onDeleteConfirmOpenChange}
          >
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => onDeleteConfirmOpenChange(true)}
            >
              <Trash2 className="size-3.5" />
              {t('habits.modal.delete')}
            </Button>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t('habits.modal.deleteTitle')}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t('habits.modal.deleteConfirm')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>
                  {t('habits.modal.cancel')}
                </AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={event => {
                    event.preventDefault()
                    onDelete()
                  }}
                >
                  {t('habits.modal.delete')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : (
        <span />
      )}

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          {t('habits.modal.cancel')}
        </Button>
        <Button type="submit" size="sm" disabled={!canSubmit}>
          {editingHabitId
            ? t('habits.modal.saveChanges')
            : t('habits.modal.create')}
        </Button>
      </div>
    </DialogFooter>
  )
}

interface HabitEditorDialogProps {
  archiveHabit: (habitId: string) => Promise<unknown>
  canSubmit: boolean
  deleteHabit: (habitId: string) => Promise<unknown>
  modalState: HabitModalState
  t: TFunction
  onDispatch: (action: HabitModalAction) => void
  onSubmit: () => void
}

function HabitEditorDialog({
  archiveHabit,
  canSubmit,
  deleteHabit,
  modalState,
  t,
  onDispatch,
  onSubmit,
}: HabitEditorDialogProps) {
  const { deleteConfirmOpen, editingHabitId, error, form, open } = modalState

  const updateForm = (nextForm: HabitFormState) => {
    onDispatch({ type: 'set-form', form: nextForm })
  }

  const archiveEditingHabit = () => {
    if (!editingHabitId) return
    onDispatch({ type: 'set-error', error: null })
    archiveHabit(editingHabitId)
      .then(() => onDispatch({ type: 'saved' }))
      .catch(() =>
        onDispatch({
          type: 'set-error',
          error: t('habits.modal.archiveFailed'),
        })
      )
  }

  const deleteEditingHabit = () => {
    if (!editingHabitId) return
    onDispatch({ type: 'set-error', error: null })
    deleteHabit(editingHabitId)
      .then(() => onDispatch({ type: 'deleted' }))
      .catch(() => {
        onDispatch({ type: 'set-delete-confirm-open', open: false })
        onDispatch({
          type: 'set-error',
          error: t('habits.modal.deleteFailed'),
        })
      })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={nextOpen =>
        onDispatch({ type: 'set-open', open: nextOpen })
      }
    >
      <DialogContent className="sm:max-w-155">
        <DialogHeader>
          <DialogTitle>
            {editingHabitId
              ? t('habits.modal.editTitle')
              : t('habits.modal.createTitle')}
          </DialogTitle>
          <DialogDescription>{t('habits.modal.description')}</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-5"
          onSubmit={event => {
            event.preventDefault()
            onSubmit()
          }}
        >
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>{t('habits.error.title')}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <HabitIdentityFields form={form} t={t} onChange={updateForm} />
          <HabitFrequencyField form={form} t={t} onChange={updateForm} />
          <HabitColorField form={form} t={t} onChange={updateForm} />
          <HabitEditorActions
            canSubmit={canSubmit}
            deleteConfirmOpen={deleteConfirmOpen}
            editingHabitId={editingHabitId}
            t={t}
            onArchive={archiveEditingHabit}
            onCancel={() => onDispatch({ type: 'set-open', open: false })}
            onDelete={deleteEditingHabit}
            onDeleteConfirmOpenChange={nextOpen =>
              onDispatch({
                type: 'set-delete-confirm-open',
                open: nextOpen,
              })
            }
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}

type HabitStats = ReturnType<typeof selectHabitStats>
type HabitProgress = ReturnType<typeof selectTodayProgress>
type HabitTab = ReturnType<typeof useHabitsStore.getState>['activeTab']
type HabitLogMap = ReturnType<typeof selectTodayLogMap>
type HeatMapStateLabels = NonNullable<
  Parameters<typeof HeatMap>[0]['stateLabels']
>
interface HabitTransition {
  duration: number
  ease: readonly [number, number, number, number]
}
type SetHabitLogState = ReturnType<
  typeof useHabitsStore.getState
>['setHabitLogState']

interface HabitPanelContext {
  focusedHabit: Habit | null
  focusCompletionDates: string[]
  focusRecoverableDates: string[]
  focusStateMap: Record<string, HabitLog['state']>
  focusStreak: number
  habits: Habit[]
  heatMapStateLabels: HeatMapStateLabels
  isLoading: boolean
  locale: string
  monthLogs: HabitLog[]
  reduceMotion: boolean
  stats: HabitStats
  t: TFunction
  todayHabits: Habit[]
  todayLogMap: HabitLogMap
  transition: HabitTransition
  weekdayCounts: number[]
  weekdayPeak: number
  onCreateHabit: () => void
  onEditHabit: (habit: Habit) => void
  onSelectHabit: (habitId: string) => void
  onSetHabitLogState: SetHabitLogState
}

function HabitTodayPanel({ context }: { context: HabitPanelContext }) {
  const {
    focusedHabit,
    heatMapStateLabels,
    isLoading,
    locale,
    monthLogs,
    reduceMotion,
    t,
    todayHabits,
    todayLogMap,
    transition,
    onCreateHabit,
    onEditHabit,
    onSelectHabit,
    onSetHabitLogState,
  } = context

  return (
    <m.section
      id="habits-panel-today"
      role="tabpanel"
      aria-labelledby="habits-tab-today"
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
            {t('habits.executionQueue')}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('habits.dueToday', { count: todayHabits.length })}
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-4">
            <div className="h-14 animate-pulse rounded-xl bg-muted/60" />
            <div className="h-14 animate-pulse rounded-xl bg-muted/50" />
            <div className="h-14 animate-pulse rounded-xl bg-muted/40" />
          </div>
        ) : todayHabits.length === 0 ? (
          <div className="space-y-3 px-4 py-8 text-center">
            <p className="text-sm font-medium">{t('habits.empty.title')}</p>
            <p className="text-xs text-muted-foreground">
              {t('habits.empty.hint')}
            </p>
            <div>
              <Button size="sm" variant="outline" onClick={onCreateHabit}>
                <Plus className="size-3.5" />
                {t('habits.empty.createButton')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {todayHabits.map((habit, index) => {
              const todayLog = todayLogMap.get(habit.id) ?? null
              const todayState = todayLog?.state ?? null
              const coveredToday = !!todayLog
              const isFocused = focusedHabit?.id === habit.id
              const streak = selectStreakByHabit(monthLogs, habit.id)
              const completionDates = selectHabitCompletionDates(
                monthLogs,
                habit.id
              )
              const stateMap = selectHabitLogStateMap(monthLogs, habit.id)

              return (
                <m.article
                  key={habit.id}
                  initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    ...transition,
                    delay: reduceMotion ? 0 : index * 0.04,
                  }}
                  className={cn(
                    'grid gap-3 px-4 py-4 transition-colors hover:bg-accent/15 md:grid-cols-[auto_minmax(0,1fr)_minmax(150px,auto)] md:items-center',
                    isFocused && 'ring-1 ring-ring/45'
                  )}
                  style={{
                    backgroundColor: coveredToday
                      ? 'color-mix(in oklab, var(--card) 86%, transparent)'
                      : `color-mix(in oklab, ${habit.color} 12%, var(--card))`,
                  }}
                >
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      variant={todayState === 'done' ? 'default' : 'outline'}
                      size="sm"
                      aria-pressed={todayState === 'done'}
                      onClick={() =>
                        void onSetHabitLogState(
                          habit.id,
                          todayState === 'done' ? null : 'done'
                        )
                      }
                      aria-label={t('habits.actions.doneAria', {
                        name: habit.name,
                      })}
                    >
                      <Check className="size-3.5" />
                      {t('habits.actions.done')}
                    </Button>
                  </div>

                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectHabit(habit.id)}
                        className={cn(
                          'min-w-0 truncate text-start text-sm font-semibold',
                          todayState === 'done' &&
                            'text-muted-foreground line-through'
                        )}
                      >
                        {habit.icon ? `${habit.icon} ` : ''}
                        {habit.name}
                      </button>

                      <span className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {formatHabitFrequency(habit, t)}
                      </span>

                      <div className="ml-1 shrink-0">
                        <HeatMap
                          logs={completionDates}
                          statesByDate={stateMap}
                          days={7}
                          color={habit.color}
                          size="md"
                          locale={locale}
                          stateLabels={heatMapStateLabels}
                          ariaLabel={t('habits.heatmap.weekAria', {
                            name: habit.name,
                          })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="self-center md:justify-self-end">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                      <div className="flex min-w-28 flex-col items-end justify-center gap-2 text-right">
                        <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
                          <Flame className="size-3.5" />
                          {t('habits.streakRun', { count: streak })}
                        </span>
                        {todayState ? (
                          <span className="rounded-full border border-border/70 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                            {t(`habits.logState.${todayState}`)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {t('habits.openToday')}
                          </span>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t('habits.actions.moreAria', {
                              name: habit.name,
                            })}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              void onSetHabitLogState(
                                habit.id,
                                todayState === 'minimal' ? null : 'minimal'
                              )
                            }
                          >
                            <CircleDot className="size-3.5" />
                            {t('habits.actions.minimum')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              void onSetHabitLogState(
                                habit.id,
                                todayState === 'paused' ? null : 'paused'
                              )
                            }
                          >
                            <PauseCircle className="size-3.5" />
                            {t('habits.actions.pause')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onEditHabit(habit)}>
                            {t('habits.actions.edit')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </m.article>
              )
            })}
          </div>
        )}
      </section>

      <HabitFocusAside context={context} />
    </m.section>
  )
}

function HabitFocusAside({ context }: { context: HabitPanelContext }) {
  const {
    focusedHabit,
    focusCompletionDates,
    focusRecoverableDates,
    focusStateMap,
    focusStreak,
    habits,
    heatMapStateLabels,
    locale,
    stats,
    t,
    onEditHabit,
    onSelectHabit,
    onSetHabitLogState,
  } = context

  return (
    <aside className="space-y-4">
      <section className="rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur-[1px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {t('habits.focusHabit.heading')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('habits.focusHabit.hint')}
            </p>
          </div>
          {focusedHabit ? (
            <div className="flex items-center gap-2">
              {habits.length > 1 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      {t('habits.focusHabit.switch')}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {habits.map(habit => (
                      <DropdownMenuItem
                        key={habit.id}
                        onClick={() => onSelectHabit(habit.id)}
                      >
                        <span className="min-w-0 truncate">
                          {habit.icon ? `${habit.icon} ` : ''}
                          {habit.name}
                        </span>
                        {habit.id === focusedHabit.id ? (
                          <Check className="ml-auto size-3.5" />
                        ) : null}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEditHabit(focusedHabit)}
              >
                {t('habits.focusHabit.manage')}
              </Button>
            </div>
          ) : null}
        </div>

        {focusedHabit ? (
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-base font-semibold">
                {focusedHabit.icon ? `${focusedHabit.icon} ` : ''}
                {focusedHabit.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatHabitFrequency(focusedHabit, t)}
              </p>
            </div>

            <HeatMap
              logs={focusCompletionDates}
              statesByDate={focusStateMap}
              days={30}
              color={focusedHabit.color}
              size="md"
              locale={locale}
              stateLabels={heatMapStateLabels}
              ariaLabel={t('habits.heatmap.monthAria', {
                name: focusedHabit.name,
              })}
            />

            <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              {(
                ['done', 'minimal', 'paused', 'recovered', 'missed'] as const
              ).map(state => (
                <span key={state} className="inline-flex items-center gap-1">
                  <span
                    aria-hidden
                    className={cn(
                      'size-2 rounded-[3px] border border-border/70',
                      state === 'missed' && 'bg-muted/70',
                      state === 'paused' && 'opacity-60',
                      state === 'recovered' && 'ring-1 ring-ring/60'
                    )}
                    style={{
                      backgroundColor:
                        state === 'missed'
                          ? undefined
                          : state === 'minimal' || state === 'paused'
                            ? `color-mix(in oklab, ${focusedHabit.color} 36%, var(--muted))`
                            : state === 'recovered'
                              ? `color-mix(in oklab, ${focusedHabit.color} 55%, var(--accent))`
                              : focusedHabit.color,
                    }}
                  />
                  {heatMapStateLabels[state]}
                </span>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              {t('habits.focusHabit.currentStreak', { count: focusStreak })}
            </p>

            {focusRecoverableDates.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {t('habits.focusHabit.recoveryHeading')}
                </p>
                <div className="space-y-2">
                  {focusRecoverableDates.map(dateISO => (
                    <Button
                      key={dateISO}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() =>
                        void onSetHabitLogState(
                          focusedHabit.id,
                          'recovered',
                          dateISO
                        )
                      }
                      aria-label={t('habits.actions.recoverAria', {
                        name: focusedHabit.name,
                        date: dateISO,
                      })}
                    >
                      <RotateCcw className="size-3.5" />
                      <span>
                        {t('habits.actions.recover')}{' '}
                        {recoveryDateLabel(dateISO, locale, t)}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            {t('habits.focusHabit.noneSelected')}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur-[1px]">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {t('habits.quickSummary')}
        </p>
        <div className="mt-3 space-y-2 text-xs text-muted-foreground">
          <p>
            {t('habits.quickSummary.topStreak')}{' '}
            {stats.topCurrentHabit
              ? t('habits.quickSummary.topStreakValue', {
                  name: stats.topCurrentHabit.name,
                  count: stats.topCurrentHabit.streak,
                })
              : t('habits.quickSummary.noData')}
          </p>
          <p>
            {t('habits.quickSummary.topWeekday')}{' '}
            {stats.topWeekday === null
              ? t('habits.quickSummary.noData')
              : weekdayName(stats.topWeekday, t)}
          </p>
        </div>
      </section>
    </aside>
  )
}

function HabitOverviewPanel({ context }: { context: HabitPanelContext }) {
  const {
    habits,
    heatMapStateLabels,
    locale,
    monthLogs,
    t,
    todayLogMap,
    onEditHabit,
  } = context

  return (
    <m.section
      id="habits-panel-overview"
      role="tabpanel"
      aria-labelledby="habits-tab-overview"
      key="overview"
      initial={{ opacity: 0, y: context.reduceMotion ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: context.reduceMotion ? 0 : -6 }}
      transition={context.transition}
      className="space-y-4"
    >
      {habits.length === 0 ? (
        <section className="rounded-2xl border border-border/70 bg-card/80 px-4 py-8 text-center backdrop-blur-[1px]">
          <p className="text-sm font-medium">
            {t('habits.overview.empty.title')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('habits.overview.empty.hint')}
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
            const stateMap = selectHabitLogStateMap(monthLogs, habit.id)
            const streak = selectStreakByHabit(monthLogs, habit.id)
            const todayState = todayLogMap.get(habit.id)?.state ?? null

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
                      onClick={() => onEditHabit(habit)}
                      className="truncate text-start text-sm font-semibold"
                    >
                      {habit.icon ? `${habit.icon} ` : ''}
                      {habit.name}
                    </button>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatHabitFrequency(habit, t)}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t('habits.streakRun', { count: streak })}
                  </span>
                </div>

                <div className="mt-3">
                  <HeatMap
                    logs={completionDates}
                    statesByDate={stateMap}
                    days={30}
                    color={habit.color}
                    size="md"
                    locale={locale}
                    stateLabels={heatMapStateLabels}
                    ariaLabel={t('habits.heatmap.monthAria', {
                      name: habit.name,
                    })}
                  />
                </div>

                <p className="mt-3 text-xs text-muted-foreground">
                  {todayState
                    ? t(`habits.logState.${todayState}`)
                    : t('habits.openToday')}
                </p>
              </article>
            )
          })}
        </div>
      )}
    </m.section>
  )
}

function HabitStatsPanel({ context }: { context: HabitPanelContext }) {
  const { reduceMotion, stats, t, transition, weekdayCounts, weekdayPeak } =
    context

  return (
    <m.section
      id="habits-panel-stats"
      role="tabpanel"
      aria-labelledby="habits-tab-stats"
      key="stats"
      initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
      transition={transition}
      className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"
    >
      <section className="rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur-[1px]">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {t('habits.stats.weekdayPressureMap')}
        </p>

        <div className="mt-3 space-y-2">
          {WEEKDAY_KEYS.map((key, day) => {
            const label = t(`habits.weekday.${key}`)
            const value = weekdayCounts[day] ?? 0
            const width = `${Math.round((value / weekdayPeak) * 100)}%`
            return (
              <div
                key={key}
                className="grid grid-cols-[32px_minmax(0,1fr)_30px] items-center gap-2 text-xs"
              >
                <span className="text-muted-foreground">{label}</span>
                <div className="h-2 overflow-hidden rounded-full bg-muted/60">
                  <div
                    className="h-full rounded-full bg-foreground/80 transition-all duration-300"
                    style={{ width }}
                  />
                </div>
                <span className="text-end text-muted-foreground">{value}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur-[1px]">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {t('habits.stats.historicalBoard')}
        </p>

        {stats.bestHistoricalByHabit.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {t('habits.stats.noStreakData')}
          </p>
        ) : (
          <ol className="mt-3 space-y-2">
            {stats.bestHistoricalByHabit.slice(0, 5).map((item, index) => (
              <li
                key={item.habitId}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2 text-sm"
              >
                <span>
                  {index + 1}. {item.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t('habits.stats.days', {
                    count: item.streak,
                  })}
                </span>
              </li>
            ))}
          </ol>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          {t('habits.stats.completionWindow', {
            completed: stats.monthRate.completedDays,
            total: stats.monthRate.totalDays,
          })}
        </p>
      </section>
    </m.section>
  )
}

interface HabitPageHeaderProps {
  locale: string
  progress: HabitProgress
  progressPercent: number
  stats: HabitStats
  t: TFunction
  transition: HabitTransition
  onCreateHabit: () => void
}

function HabitPageHeader({
  locale,
  progress,
  progressPercent,
  stats,
  t,
  transition,
  onCreateHabit,
}: HabitPageHeaderProps) {
  return (
    <header className="relative border-b border-border/70 px-5 pb-5 pt-6 md:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold leading-tight md:text-[2rem]">
            {t('habits.pageTitle')}
          </h1>
          <p className="text-sm text-muted-foreground">{todayLabel(locale)}</p>
        </div>

        <Button size="sm" onClick={onCreateHabit}>
          <Plus className="size-4" />
          {t('habits.newHabit')}
        </Button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-border/70 bg-card/70 px-4 py-3 backdrop-blur-[1px]">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {t('habits.dailyCompletion')}
            </p>
            <p className="text-sm font-medium">
              {t('habits.dailyCompletionDetail', {
                done: progress.done,
                total: progress.total,
              })}
            </p>
          </div>

          <progress
            className="sr-only"
            aria-label={t('habits.dailyCompletion')}
            value={progressPercent}
            max={100}
          />
          <div
            aria-hidden
            className="mt-2 h-4 overflow-hidden rounded-full bg-muted/70"
          >
            <m.div
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
              {t('habits.monthlySignal')}
            </p>
            <p className="font-medium">
              {t('habits.monthlyConsistency', {
                percentage: stats.monthRate.percentage,
              })}
            </p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t('habits.monthlyDetail', {
              completed: stats.monthRate.completedDays,
              total: stats.monthRate.totalDays,
            })}
          </p>
          <progress
            className="sr-only"
            aria-label={t('habits.monthlySignal')}
            value={stats.monthRate.percentage}
            max={100}
          />
          <div
            aria-hidden
            className="mt-2 h-3 overflow-hidden rounded-full bg-muted/70"
          >
            <m.div
              className="h-full rounded-full bg-foreground/80"
              initial={{ width: 0 }}
              animate={{ width: `${stats.monthRate.percentage}%` }}
              transition={transition}
            />
          </div>
        </section>
      </div>
    </header>
  )
}

interface HabitTabListProps {
  activeTab: HabitTab
  t: TFunction
  onChange: (tab: HabitTab) => void
}

function HabitTabList({ activeTab, t, onChange }: HabitTabListProps) {
  return (
    <div className="relative border-b border-border/70 px-5 py-3 md:px-8">
      <div
        role="tablist"
        aria-label={t('habits.tabs.label')}
        className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/70 p-1"
      >
        <SegmentedTab
          id="habits-tab-today"
          controls="habits-panel-today"
          active={activeTab === 'today'}
          label={t('habits.tabs.today')}
          onClick={() => onChange('today')}
        />
        <SegmentedTab
          id="habits-tab-overview"
          controls="habits-panel-overview"
          active={activeTab === 'overview'}
          label={t('habits.tabs.overview')}
          onClick={() => onChange('overview')}
        />
        <SegmentedTab
          id="habits-tab-stats"
          controls="habits-panel-stats"
          active={activeTab === 'stats'}
          label={t('habits.tabs.stats')}
          onClick={() => onChange('stats')}
        />
      </div>
    </div>
  )
}

export function HabitPage({ initialSelectedHabitId }: HabitPageProps) {
  const { t, i18n } = useTranslation()
  const [modalState, dispatchModal] = useReducer(
    habitModalReducer,
    undefined,
    defaultModalState
  )
  const reduceMotion = useReducedMotion() ?? false
  const locale = i18n.resolvedLanguage ?? i18n.language ?? 'en-US'
  const { editingHabitId, form } = modalState
  const habits = useHabitsStore(state => state.habits)
  const todayLogs = useHabitsStore(state => state.todayLogs)
  const monthLogs = useHabitsStore(state => state.monthLogs)
  const activeTab = useHabitsStore(state => state.activeTab)
  const selectedHabitId = useHabitsStore(state => state.selectedHabitId)
  const isLoading = useHabitsStore(state => state.isLoading)
  const error = useHabitsStore(state => state.error)

  const loadHabits = useHabitsStore(state => state.loadHabits)
  const loadTodayLogs = useHabitsStore(state => state.loadTodayLogs)
  const loadMonthLogs = useHabitsStore(state => state.loadMonthLogs)
  const setSelectedHabit = useHabitsStore(state => state.setSelectedHabit)
  const setActiveTab = useHabitsStore(state => state.setActiveTab)
  const addHabit = useHabitsStore(state => state.addHabit)
  const updateHabit = useHabitsStore(state => state.updateHabit)
  const setHabitLogState = useHabitsStore(state => state.setHabitLogState)
  const archiveHabit = useHabitsStore(state => state.archiveHabit)
  const deleteHabit = useHabitsStore(state => state.deleteHabit)

  // Sync initial selection from navigation prop once on mount
  const didSyncInitialHabit = useRef(false)
  useEffect(() => {
    if (didSyncInitialHabit.current || !initialSelectedHabitId) return
    didSyncInitialHabit.current = true
    setSelectedHabit(initialSelectedHabitId)
  }, [initialSelectedHabitId, setSelectedHabit])

  useEffect(() => {
    void Promise.all([loadHabits(), loadTodayLogs(), loadMonthLogs()])
  }, [loadHabits, loadMonthLogs, loadTodayLogs])

  const todayHabits = selectSortedTodayHabits(habits, todayLogs)
  const todayLogMap = selectTodayLogMap(todayLogs)
  const progress = selectTodayProgress(habits, todayLogs)
  const stats = selectHabitStats(habits, monthLogs)

  const progressPercent = Math.round(progress.ratio * 100)
  const heatMapStateLabels = {
    done: t('habits.logState.done'),
    minimal: t('habits.logState.minimal'),
    paused: t('habits.logState.paused'),
    recovered: t('habits.logState.recovered'),
    missed: t('habits.logState.missed'),
  }

  const focusedHabit =
    habits.find(habit => habit.id === selectedHabitId) ??
    todayHabits[0] ??
    habits[0] ??
    null

  const focusCompletionDates = focusedHabit
    ? selectHabitCompletionDates(monthLogs, focusedHabit.id)
    : []
  const focusStateMap = focusedHabit
    ? selectHabitLogStateMap(monthLogs, focusedHabit.id)
    : {}
  const focusStreak = focusedHabit
    ? selectStreakByHabit(monthLogs, focusedHabit.id)
    : 0
  const focusRecoverableDates = focusedHabit
    ? selectRecoverableDatesForHabit(focusedHabit, monthLogs)
    : []

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
    dispatchModal({ type: 'open-create' })
  }

  const openEdit = (habit: Habit) => {
    setSelectedHabit(habit.id)
    dispatchModal({ type: 'open-edit', habit })
  }

  const submitForm = async () => {
    if (!canSubmit) return

    const payload = toHabitInput(form)
    dispatchModal({ type: 'set-error', error: null })
    try {
      if (editingHabitId) {
        await updateHabit(editingHabitId, payload)
      } else {
        await addHabit(payload)
      }

      dispatchModal({ type: 'saved' })
    } catch {
      dispatchModal({
        type: 'set-error',
        error: editingHabitId
          ? t('habits.modal.updateFailed')
          : t('habits.modal.createFailed'),
      })
    }
  }

  const panelContext: HabitPanelContext = {
    focusedHabit,
    focusCompletionDates,
    focusRecoverableDates,
    focusStateMap,
    focusStreak,
    habits,
    heatMapStateLabels,
    isLoading,
    locale,
    monthLogs,
    reduceMotion,
    stats,
    t,
    todayHabits,
    todayLogMap,
    transition,
    weekdayCounts,
    weekdayPeak,
    onCreateHabit: openCreate,
    onEditHabit: openEdit,
    onSelectHabit: setSelectedHabit,
    onSetHabitLogState: setHabitLogState,
  }

  return (
    <LazyMotion features={domAnimation}>
      <div className="relative flex h-full flex-col overflow-hidden bg-background text-foreground">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 90% at 5% 0%, color-mix(in oklab, var(--accent) 16%, transparent), transparent 58%), radial-gradient(90% 70% at 100% 100%, color-mix(in oklab, var(--primary) 14%, transparent), transparent 60%)',
          }}
        />

        <HabitPageHeader
          locale={locale}
          progress={progress}
          progressPercent={progressPercent}
          stats={stats}
          t={t}
          transition={transition}
          onCreateHabit={openCreate}
        />

        <HabitTabList activeTab={activeTab} t={t} onChange={setActiveTab} />

        <div className="relative flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-6">
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="size-4" />
              <AlertTitle>{t('habits.error.title')}</AlertTitle>
              <AlertDescription>
                {t('habits.error.description')}
              </AlertDescription>
            </Alert>
          ) : null}
          <AnimatePresence mode="wait">
            {activeTab === 'today' ? (
              <HabitTodayPanel context={panelContext} />
            ) : activeTab === 'overview' ? (
              <HabitOverviewPanel context={panelContext} />
            ) : (
              <HabitStatsPanel context={panelContext} />
            )}
          </AnimatePresence>
        </div>

        <HabitEditorDialog
          archiveHabit={archiveHabit}
          canSubmit={canSubmit}
          deleteHabit={deleteHabit}
          modalState={modalState}
          t={t}
          onDispatch={dispatchModal}
          onSubmit={() => {
            void submitForm()
          }}
        />

        <div className="relative border-t border-border/70 px-5 py-2 text-[11px] text-muted-foreground md:px-8">
          {focusedHabit
            ? t('habits.focusLock', { name: focusedHabit.name })
            : t('habits.focusLockNone')}
        </div>
      </div>
    </LazyMotion>
  )
}

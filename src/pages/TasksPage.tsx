import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Trash2,
  X,
  Check,
  Filter,
  AlertCircle,
} from 'lucide-react'
import {
  useTasksStore,
  selectFilteredTasks,
  getTodayISO,
} from '@/store/tasks-store'
import type { Task, Priority, Status } from '@/store/tasks-store'
import { cn } from '@/lib/utils'
import { Calendar, type RangeValue } from '@/components/calendar'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert ISO date string to Date object at midnight */
function isoToDate(isoDate: string | undefined): Date | undefined {
  if (!isoDate) return undefined
  const date = new Date(isoDate)
  date.setHours(0, 0, 0, 0)
  return date
}

/** Convert Date object to ISO date string (YYYY-MM-DD) */
function dateToIso(date: Date | null | undefined): string | undefined {
  if (!date) return undefined
  return date.toISOString().slice(0, 10)
}

function formatRelativeDate(isoDate: string): string {
  const today = getTodayISO()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowISO = tomorrow.toISOString().slice(0, 10)

  if (isoDate === today) return 'Today'
  if (isoDate === tomorrowISO) return 'Tomorrow'

  const date = new Date(isoDate)
  const now = new Date()
  const diffDays = Math.round(
    (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (diffDays < 0) return `${Math.abs(diffDays)}d ago`
  if (diffDays <= 7) return `In ${diffDays}d`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function groupTasks(tasks: Task[]): {
  today: Task[]
  upcoming: Task[]
  inbox: Task[]
  someday: Task[]
  completed: Task[]
} {
  const today = getTodayISO()
  const sevenDaysLater = new Date()
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)
  const sevenDaysISO = sevenDaysLater.toISOString().slice(0, 10)

  const completed: Task[] = []
  const todayList: Task[] = []
  const upcoming: Task[] = []
  const inbox: Task[] = []
  const someday: Task[] = []

  for (const task of tasks) {
    if (task.status === 'done') {
      completed.push(task)
      continue
    }
    if (!task.due_date) {
      inbox.push(task)
      continue
    }
    if (task.due_date <= today) {
      todayList.push(task)
      continue
    }
    if (task.due_date <= sevenDaysISO) {
      upcoming.push(task)
      continue
    }
    someday.push(task)
  }

  return { today: todayList, upcoming, inbox, someday, completed }
}

// ─── Priority Badge ───────────────────────────────────────────────────────────

function PriorityIndicator({
  priority,
  size = 'sm',
}: {
  priority: Priority
  size?: 'sm' | 'md'
}) {
  return (
    <span
      aria-label={`${priority} priority`}
      title={priority}
      className={cn(
        'inline-flex items-center',
        size === 'sm' ? 'text-[10px]' : 'text-xs'
      )}
    >
      <span
        className={cn(
          'inline-block rounded-sm',
          size === 'sm' ? 'size-1.5' : 'size-2',
          priority === 'high' && 'bg-red-500',
          priority === 'medium' && 'bg-yellow-400',
          priority === 'low' && 'bg-muted-foreground/30'
        )}
      />
    </span>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  label,
  count,
  collapsed,
  onToggle,
}: {
  label: string
  count: number
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="group flex w-full items-center gap-2 px-1 py-2 text-start transition-colors"
    >
      <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
        {label}
      </span>
      <span className="font-mono text-[10px] text-muted-foreground/40">
        {count}
      </span>
      <span className="ml-auto text-muted-foreground/30 transition-transform group-hover:text-muted-foreground/60">
        {collapsed ? (
          <ChevronRight className="size-3" />
        ) : (
          <ChevronDown className="size-3" />
        )}
      </span>
    </button>
  )
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  isSelected,
  onToggle,
  onSelect,
  onDelete,
}: {
  task: Task
  isSelected: boolean
  onToggle: () => void
  onSelect: () => void
  onDelete: () => void
}) {
  const isDone = task.status === 'done'
  const completedSubtasks = task.subtasks.filter(s => s.completed).length
  const totalSubtasks = task.subtasks.length

  return (
    <div
      className={cn(
        'group relative flex items-center gap-3 rounded-lg px-3 py-2 transition-all',
        isSelected ? 'bg-accent' : 'hover:bg-accent/50',
        isDone && 'opacity-50'
      )}
    >
      {/* Checkbox */}
      <button
        type="button"
        aria-label={isDone ? 'Mark as incomplete' : 'Mark as complete'}
        onClick={e => {
          e.stopPropagation()
          onToggle()
        }}
        className={cn(
          'flex size-4.5 shrink-0 items-center justify-center rounded-full border transition-all',
          isDone
            ? 'border-muted-foreground/30 bg-muted-foreground/15'
            : 'border-muted-foreground/40 hover:border-primary hover:bg-accent'
        )}
      >
        {isDone && (
          <Check
            className="size-2.5 text-muted-foreground/60"
            strokeWidth={3}
          />
        )}
      </button>

      {/* Priority indicator */}
      <PriorityIndicator priority={task.priority} />

      {/* Main content */}
      <button
        type="button"
        onClick={onSelect}
        className="flex flex-1 items-center gap-3 text-start"
      >
        <span
          className={cn(
            'flex-1 text-[13px] font-normal transition-all',
            isDone && 'line-through text-muted-foreground'
          )}
        >
          {task.title}
        </span>

        {/* Metadata */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Subtask progress */}
          {totalSubtasks > 0 && (
            <span className="font-mono text-[10px] text-muted-foreground/50">
              {completedSubtasks}/{totalSubtasks}
            </span>
          )}

          {/* Due date */}
          {task.due_date && !isDone && (
            <span
              className={cn(
                'text-[11px] text-muted-foreground/50',
                task.due_date < getTodayISO() && 'text-red-500/70'
              )}
            >
              {formatRelativeDate(task.due_date)}
            </span>
          )}
        </div>
      </button>

      {/* Hover actions */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          aria-label="Delete task"
          onClick={e => {
            e.stopPropagation()
            onDelete()
          }}
          className="flex size-6 items-center justify-center rounded text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-3" />
        </button>
      </div>
    </div>
  )
}

// ─── Task Section ─────────────────────────────────────────────────────────────

function TaskSection({
  label,
  tasks,
  sectionKey,
  selectedId,
  onSelect,
  onToggle,
  onDelete,
}: {
  label: string
  tasks: Task[]
  sectionKey: string
  selectedId: string | null
  onSelect: (id: string) => void
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}) {
  const toggleSectionCollapsed = useTasksStore(
    state => state.toggleSectionCollapsed
  )
  const sectionCollapsed = useTasksStore(
    state => state.sectionCollapsed[sectionKey] ?? false
  )

  if (tasks.length === 0) return null

  return (
    <div className="mb-1">
      <SectionHeader
        label={label}
        count={tasks.length}
        collapsed={sectionCollapsed}
        onToggle={() => toggleSectionCollapsed(sectionKey)}
      />
      {!sectionCollapsed && (
        <div className="flex flex-col gap-0.5">
          {tasks.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              isSelected={task.id === selectedId}
              onToggle={() => onToggle(task.id)}
              onSelect={() => onSelect(task.id)}
              onDelete={() => onDelete(task.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Task Detail Slide-over ────────────────────────────────────────────────────

function PriorityButton({
  value,
  active,
  onClick,
}: {
  value: Priority
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] transition-all',
        active
          ? 'border-current'
          : 'border-transparent bg-muted/50 text-muted-foreground hover:border-border',
        value === 'high' &&
          active &&
          'border-red-500/50 bg-red-500/10 text-red-500',
        value === 'medium' &&
          active &&
          'border-yellow-400/50 bg-yellow-400/10 text-yellow-400',
        value === 'low' &&
          active &&
          'border-muted-foreground/30 bg-muted text-muted-foreground'
      )}
    >
      <span
        className={cn(
          'inline-block size-1.5 rounded-full',
          value === 'high' && 'bg-red-500',
          value === 'medium' && 'bg-yellow-400',
          value === 'low' && 'bg-muted-foreground/40'
        )}
      />
      {value.charAt(0).toUpperCase() + value.slice(1)}
    </button>
  )
}

function TaskDetailPanel({
  task,
  onClose,
  onUpdate,
  onDelete,
}: {
  task: Task | null
  onClose: () => void
  onUpdate: (id: string, updates: Partial<Task>) => void
  onDelete: (id: string) => void
}) {
  const addSubtask = useTasksStore(state => state.addSubtask)
  const toggleSubtask = useTasksStore(state => state.toggleSubtask)
  const deleteSubtask = useTasksStore(state => state.deleteSubtask)

  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'medium')
  const [dueDate, setDueDate] = useState(task?.due_date ?? '')
  const [dateRange, setDateRange] = useState<RangeValue | null>(() => {
    if (task?.due_date) {
      const date = isoToDate(task.due_date)
      return date ? { start: date, end: null } : null
    }
    return null
  })
  const [newSubtask, setNewSubtask] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (task) titleRef.current?.focus()
  }, [task])

  // Sync dateRange with dueDate state
  useEffect(() => {
    if (dateRange?.start) {
      setDueDate(dateToIso(dateRange.start) || '')
    } else {
      setDueDate('')
    }
  }, [dateRange])

  // Keyboard: Escape to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  if (!task) return null

  const handleSave = () => {
    if (!title.trim()) return
    onUpdate(task.id, {
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      due_date: dueDate || undefined,
    })
  }

  const handleAddSubtask = () => {
    const trimmed = newSubtask.trim()
    if (!trimmed) return
    addSubtask(task.id, trimmed)
    setNewSubtask('')
  }

  return (
    <div
      className="flex h-full w-full max-w-sm flex-col border-l border-border bg-card"
      role="complementary"
      aria-label="Task detail"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Task
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Delete task"
            onClick={() => {
              onDelete(task.id)
              onClose()
            }}
            className="flex size-7 items-center justify-center rounded text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Close panel"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
        {/* Title */}
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={handleSave}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              handleSave()
              e.currentTarget.blur()
            }
          }}
          placeholder="Task name"
          aria-label="Task title"
          className="bg-transparent text-[15px] font-medium text-foreground placeholder:text-muted-foreground/40 outline-none"
        />

        {/* Description */}
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          onBlur={handleSave}
          placeholder="Add description..."
          aria-label="Task description"
          rows={3}
          className="resize-none bg-transparent text-[13px] text-foreground/80 placeholder:text-muted-foreground/30 outline-none"
        />

        {/* Priority */}
        <div>
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
            Priority
          </label>
          <div className="flex gap-2">
            {(['low', 'medium', 'high'] as Priority[]).map(p => (
              <PriorityButton
                key={p}
                value={p}
                active={priority === p}
                onClick={() => {
                  setPriority(p)
                  onUpdate(task.id, { priority: p })
                }}
              />
            ))}
          </div>
        </div>

        {/* Due date */}
        <div>
          <label className="mb-3 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
            Due date
          </label>
          <Calendar
            value={dateRange}
            onChange={newRange => {
              setDateRange(newRange)
              // Immediately update the task when a date is selected
              if (newRange?.start) {
                const isoDate = dateToIso(newRange.start)
                if (isoDate) onUpdate(task.id, { due_date: isoDate })
              } else {
                onUpdate(task.id, { due_date: undefined })
              }
            }}
            compact
            allowClear
            showTimeInput={false}
          />
        </div>

        {/* Subtasks */}
        <div>
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
            Subtasks
          </label>

          <div className="flex flex-col gap-1">
            {task.subtasks.map(subtask => (
              <div
                key={subtask.id}
                className="group flex items-center gap-2.5 rounded-md px-1.5 py-1 hover:bg-accent/50"
              >
                <button
                  type="button"
                  onClick={() => toggleSubtask(task.id, subtask.id)}
                  aria-label={
                    subtask.completed
                      ? 'Mark subtask incomplete'
                      : 'Mark subtask complete'
                  }
                  className={cn(
                    'flex size-3.5 shrink-0 items-center justify-center rounded-full border transition-all',
                    subtask.completed
                      ? 'border-muted-foreground/30 bg-muted-foreground/20'
                      : 'border-muted-foreground/40 hover:border-primary'
                  )}
                >
                  {subtask.completed && (
                    <span className="block size-1.5 rounded-full bg-muted-foreground/50" />
                  )}
                </button>
                <span
                  className={cn(
                    'flex-1 text-[12px]',
                    subtask.completed && 'line-through text-muted-foreground/50'
                  )}
                >
                  {subtask.title}
                </span>
                <button
                  type="button"
                  aria-label="Delete subtask"
                  onClick={() => deleteSubtask(task.id, subtask.id)}
                  className="shrink-0 text-muted-foreground/30 opacity-0 transition-all hover:text-destructive group-hover:opacity-100"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}

            {/* Add subtask */}
            <div className="flex items-center gap-2 rounded-md border border-dashed border-border/50 px-2 py-1 focus-within:border-border">
              <Plus className="size-3 text-muted-foreground/40" />
              <input
                type="text"
                value={newSubtask}
                onChange={e => setNewSubtask(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddSubtask()
                  if (e.key === 'Escape') setNewSubtask('')
                }}
                placeholder="Add subtask..."
                aria-label="Add subtask"
                className="flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground/30 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="shrink-0 border-t border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground/50">Status</span>
          {(
            [
              ['todo', 'To Do'],
              ['in_progress', 'In Progress'],
              ['done', 'Done'],
            ] as [Status, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onUpdate(task.id, { status: value })}
              className={cn(
                'rounded-md border px-2 py-0.5 text-[11px] transition-all',
                task.status === value
                  ? 'border-border bg-accent text-foreground'
                  : 'border-transparent text-muted-foreground/50 hover:border-border hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── New Task Modal / Quick-Create ────────────────────────────────────────────

function NewTaskModal({
  onAdd,
  onClose,
}: {
  onAdd: (
    title: string,
    options?: { priority: Priority; due_date?: string }
  ) => Promise<void>
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [dateRange, setDateRange] = useState<RangeValue | null>(() => {
    const today = isoToDate(getTodayISO())
    return today ? { start: today, end: null } : null
  })
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleSubmit = async () => {
    const trimmed = title.trim()
    if (!trimmed) return
    
    // Use start date as the due date
    const dueDateIso = dateRange?.start ? dateToIso(dateRange.start) : undefined
    
    await onAdd(trimmed, {
      priority,
      due_date: dueDateIso,
    })
    onClose()
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Create new task"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl">
        {/* Title */}
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSubmit()
          }}
          placeholder="Task name"
          aria-label="New task title"
          className="mb-4 w-full bg-transparent text-[16px] font-medium text-foreground placeholder:text-muted-foreground/40 outline-none"
        />

        {/* Priority + Date row */}
        <div className="mb-5 flex flex-col gap-4">
          <div className="flex items-center gap-1.5">
            {(['low', 'medium', 'high'] as Priority[]).map(p => (
              <PriorityButton
                key={p}
                value={p}
                active={priority === p}
                onClick={() => setPriority(p)}
              />
            ))}
          </div>

          {/* Calendar date picker */}
          <Calendar
            value={dateRange}
            onChange={setDateRange}
            compact
            allowClear
            showTimeInput={false}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="rounded-lg bg-foreground px-3 py-1.5 text-[13px] text-background transition-all hover:opacity-80 disabled:opacity-30"
          >
            Create task
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Filter Dropdown ─────────────────────────────────────────────────────────

function FilterDropdown({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const filters = useTasksStore(state => state.filters)
  const setFilter = useTasksStore(state => state.setFilter)

  if (!open) return null

  return (
    <div
      className="absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border border-border bg-card p-2 shadow-xl"
      role="menu"
    >
      <p className="mb-1 px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
        Priority
      </p>
      {(['high', 'medium', 'low'] as Priority[]).map(p => (
        <button
          key={p}
          role="menuitem"
          type="button"
          onClick={() =>
            setFilter({ priority: filters.priority === p ? null : p })
          }
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] transition-colors hover:bg-accent',
            filters.priority === p && 'bg-accent text-foreground'
          )}
        >
          <PriorityIndicator priority={p} />
          <span className="capitalize">{p}</span>
          {filters.priority === p && <Check className="ml-auto size-3" />}
        </button>
      ))}

      <div className="my-1.5 border-t border-border" />

      <p className="mb-1 px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
        Status
      </p>
      {(
        [
          ['todo', 'To Do'],
          ['in_progress', 'In Progress'],
          ['done', 'Done'],
        ] as [Status, string][]
      ).map(([value, label]) => (
        <button
          key={value}
          role="menuitem"
          type="button"
          onClick={() =>
            setFilter({ status: filters.status === value ? null : value })
          }
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] transition-colors hover:bg-accent',
            filters.status === value && 'bg-accent text-foreground'
          )}
        >
          <span>{label}</span>
          {filters.status === value && <Check className="ml-auto size-3" />}
        </button>
      ))}

      <div className="my-1.5 border-t border-border" />

      <button
        role="menuitem"
        type="button"
        onClick={() => {
          setFilter({ priority: null, status: null })
          onClose()
        }}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-accent"
      >
        Clear filters
      </button>
    </div>
  )
}

// ─── Tab Bar ─────────────────────────────────────────────────────────────────

type TabKey = 'all' | 'today' | 'upcoming' | 'completed'

function TabBar({
  active,
  onChange,
}: {
  active: TabKey
  onChange: (t: TabKey) => void
}) {
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'today', label: 'Today' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'completed', label: 'Completed' },
  ]

  return (
    <div className="flex gap-1">
      {tabs.map(t => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={cn(
            'rounded-md px-3 py-1 text-[12px] font-medium transition-all',
            active === t.key
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ─── Tasks Page ───────────────────────────────────────────────────────────────

interface TasksPageProps {
  initialSelectedTaskId?: string
}

export function TasksPage({ initialSelectedTaskId }: TasksPageProps) {
  const tasks = useTasksStore(state => state.tasks)
  const isLoading = useTasksStore(state => state.isLoading)
  const loadTasks = useTasksStore(state => state.loadTasks)
  const addTask = useTasksStore(state => state.addTask)
  const updateTask = useTasksStore(state => state.updateTask)
  const deleteTask = useTasksStore(state => state.deleteTask)
  const toggleComplete = useTasksStore(state => state.toggleComplete)
  const selectedTaskId = useTasksStore(state => state.selectedTaskId)
  const setSelectedTask = useTasksStore(state => state.setSelectedTask)
  const filters = useTasksStore(state => state.filters)
  const setFilter = useTasksStore(state => state.setFilter)

  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [searchVisible, setSearchVisible] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Initial load
  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  // Set initial selection from widget navigation
  useEffect(() => {
    if (initialSelectedTaskId) {
      setSelectedTask(initialSelectedTaskId)
    }
  }, [initialSelectedTaskId, setSelectedTask])

  // Keyboard shortcut: N to create
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput = ['INPUT', 'TEXTAREA'].includes(target.tagName)
      if (e.key === 'n' && !isInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setNewTaskOpen(true)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  // Close filter dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Focus search when shown
  useEffect(() => {
    if (searchVisible) searchRef.current?.focus()
  }, [searchVisible])

  // Filter tasks by active tab
  const baseFiltered = selectFilteredTasks(tasks, filters)

  const today = getTodayISO()
  const sevenDaysLater = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  })()

  const tabFiltered = baseFiltered.filter(task => {
    switch (activeTab) {
      case 'today':
        return (
          task.status !== 'done' && (task.due_date === today || !task.due_date)
        )
      case 'upcoming':
        return (
          task.status !== 'done' &&
          task.due_date &&
          task.due_date > today &&
          task.due_date <= sevenDaysLater
        )
      case 'completed':
        return task.status === 'done'
      default:
        return true
    }
  })

  const groups = groupTasks(tabFiltered)
  const selectedTask = tasks.find(t => t.id === selectedTaskId) ?? null

  const activeFilterCount =
    (filters.priority ? 1 : 0) + (filters.status ? 1 : 0)

  const handleAddTask = useCallback(
    async (
      title: string,
      options?: { priority: Priority; due_date?: string }
    ) => {
      await addTask(title, options)
    },
    [addTask]
  )

  return (
    <div className="flex h-full flex-col bg-background">
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-[18px] font-semibold text-foreground">Tasks</h1>
          <span className="font-mono text-[11px] text-muted-foreground/40">
            {tasks.filter(t => t.status !== 'done').length}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setNewTaskOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-[13px] text-background transition-all hover:opacity-80"
        >
          <Plus className="size-3.5" strokeWidth={2.5} />
          New Task
        </button>
      </div>

      {/* ── Filter Bar ─────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-6 py-2">
        <TabBar active={activeTab} onChange={setActiveTab} />

        <div className="ml-auto flex items-center gap-1.5">
          {/* Search */}
          {searchVisible ? (
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-accent/30 px-2 py-1 focus-within:border-border">
              <Search className="size-3 text-muted-foreground/50" />
              <input
                ref={searchRef}
                type="text"
                value={filters.search}
                onChange={e => setFilter({ search: e.target.value })}
                onKeyDown={e => {
                  if (e.key === 'Escape') {
                    setFilter({ search: '' })
                    setSearchVisible(false)
                  }
                }}
                placeholder="Search tasks..."
                aria-label="Search tasks"
                className="w-40 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground/40 outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  setFilter({ search: '' })
                  setSearchVisible(false)
                }}
                aria-label="Close search"
                className="text-muted-foreground/40 hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSearchVisible(true)}
              aria-label="Search"
              className="flex size-7 items-center justify-center rounded text-muted-foreground/40 transition-colors hover:bg-accent hover:text-foreground"
            >
              <Search className="size-3.5" />
            </button>
          )}

          {/* Filter */}
          <div ref={filterRef} className="relative">
            <button
              type="button"
              onClick={() => setFilterOpen(v => !v)}
              aria-label="Filter"
              className={cn(
                'flex items-center gap-1.5 rounded text-[12px] transition-colors',
                filterOpen || activeFilterCount > 0
                  ? 'bg-accent px-2 py-1 text-foreground'
                  : 'size-7 justify-center text-muted-foreground/40 hover:bg-accent hover:text-foreground'
              )}
            >
              <Filter className="size-3.5" />
              {activeFilterCount > 0 && (
                <span className="font-mono text-[10px]">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <FilterDropdown
              open={filterOpen}
              onClose={() => setFilterOpen(false)}
            />
          </div>
        </div>
      </div>

      {/* ── Task List + Detail ───────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Task List */}
        <div className="flex flex-1 flex-col overflow-y-auto px-4 py-3">
          {isLoading ? (
            // Skeleton loaders
            <div className="flex flex-col gap-2 px-3 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3"
                  style={{ opacity: 1 - i * 0.15 }}
                >
                  <div className="size-4 animate-pulse rounded-full bg-muted" />
                  <div
                    className="h-3.5 animate-pulse rounded bg-muted"
                    style={{ width: `${60 + (i % 3) * 15}%` }}
                  />
                </div>
              ))}
            </div>
          ) : tabFiltered.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-20 text-center">
              <AlertCircle
                className="size-7 text-muted-foreground/20"
                strokeWidth={1.5}
              />
              <p className="text-[13px] text-muted-foreground/50">
                {filters.search || activeFilterCount > 0
                  ? 'No tasks match your filters.'
                  : 'No tasks yet. Press N to create one.'}
              </p>
              {(filters.search || activeFilterCount > 0) && (
                <button
                  type="button"
                  onClick={() =>
                    setFilter({ priority: null, status: null, search: '' })
                  }
                  className="text-[12px] text-muted-foreground/40 underline-offset-2 transition-colors hover:text-foreground hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : activeTab === 'all' ||
            activeTab === 'today' ||
            activeTab === 'upcoming' ? (
            <>
              {activeTab === 'all' && (
                <>
                  <TaskSection
                    label="Today"
                    tasks={groups.today}
                    sectionKey="today"
                    selectedId={selectedTaskId}
                    onSelect={setSelectedTask}
                    onToggle={toggleComplete}
                    onDelete={id => {
                      if (selectedTaskId === id) setSelectedTask(null)
                      deleteTask(id)
                    }}
                  />
                  <TaskSection
                    label="Upcoming"
                    tasks={groups.upcoming}
                    sectionKey="upcoming"
                    selectedId={selectedTaskId}
                    onSelect={setSelectedTask}
                    onToggle={toggleComplete}
                    onDelete={id => {
                      if (selectedTaskId === id) setSelectedTask(null)
                      deleteTask(id)
                    }}
                  />
                  <TaskSection
                    label="Inbox"
                    tasks={groups.inbox}
                    sectionKey="inbox"
                    selectedId={selectedTaskId}
                    onSelect={setSelectedTask}
                    onToggle={toggleComplete}
                    onDelete={id => {
                      if (selectedTaskId === id) setSelectedTask(null)
                      deleteTask(id)
                    }}
                  />
                  <TaskSection
                    label="Someday"
                    tasks={groups.someday}
                    sectionKey="someday"
                    selectedId={selectedTaskId}
                    onSelect={setSelectedTask}
                    onToggle={toggleComplete}
                    onDelete={id => {
                      if (selectedTaskId === id) setSelectedTask(null)
                      deleteTask(id)
                    }}
                  />
                  {/* Completed section hidden by default */}
                  {groups.completed.length > 0 && (
                    <TaskSection
                      label="Completed"
                      tasks={groups.completed}
                      sectionKey="completed_all"
                      selectedId={selectedTaskId}
                      onSelect={setSelectedTask}
                      onToggle={toggleComplete}
                      onDelete={id => {
                        if (selectedTaskId === id) setSelectedTask(null)
                        deleteTask(id)
                      }}
                    />
                  )}
                </>
              )}
              {activeTab === 'today' &&
                tabFiltered.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    isSelected={task.id === selectedTaskId}
                    onToggle={() => toggleComplete(task.id)}
                    onSelect={() => setSelectedTask(task.id)}
                    onDelete={() => {
                      if (selectedTaskId === task.id) setSelectedTask(null)
                      deleteTask(task.id)
                    }}
                  />
                ))}
              {activeTab === 'upcoming' &&
                tabFiltered.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    isSelected={task.id === selectedTaskId}
                    onToggle={() => toggleComplete(task.id)}
                    onSelect={() => setSelectedTask(task.id)}
                    onDelete={() => {
                      if (selectedTaskId === task.id) setSelectedTask(null)
                      deleteTask(task.id)
                    }}
                  />
                ))}
            </>
          ) : (
            // Completed tab
            tabFiltered.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                isSelected={task.id === selectedTaskId}
                onToggle={() => toggleComplete(task.id)}
                onSelect={() => setSelectedTask(task.id)}
                onDelete={() => {
                  if (selectedTaskId === task.id) setSelectedTask(null)
                  deleteTask(task.id)
                }}
              />
            ))
          )}
        </div>

        {/* Detail panel (slide-over style) */}
        {selectedTask && (
          <TaskDetailPanel
            key={selectedTask.id}
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            onUpdate={(id, updates) => updateTask(id, updates)}
            onDelete={id => deleteTask(id)}
          />
        )}
      </div>

      {/* ── New Task Modal ────────────────────────────────────────────────── */}
      {newTaskOpen && (
        <NewTaskModal
          onAdd={handleAddTask}
          onClose={() => setNewTaskOpen(false)}
        />
      )}
    </div>
  )
}

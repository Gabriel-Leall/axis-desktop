import { useState, useEffect, useRef } from 'react'
import { CheckSquare, Plus, ChevronRight } from 'lucide-react'
import { WidgetCard } from '../WidgetCard'
import {
  useTasksStore,
  selectTodayTasks,
  getTodayISO,
} from '@/store/tasks-store'
import type { Task } from '@/store/tasks-store'
import { cn } from '@/lib/utils'

// ─── Priority Dot ──────────────────────────────────────────────────────────────

function PriorityDot({ priority }: { priority: Task['priority'] }) {
  return (
    <span
      aria-label={`${priority} priority`}
      className={cn(
        'inline-block size-1.5 shrink-0 rounded-full',
        priority === 'high' && 'bg-red-500',
        priority === 'medium' && 'bg-yellow-400',
        priority === 'low' && 'bg-muted-foreground/50'
      )}
    />
  )
}

// ─── Task Row ──────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  onToggle,
  onSelect,
}: {
  task: Task
  onToggle: () => void
  onSelect: () => void
}) {
  const isDone = task.status === 'done'

  return (
    <div className="group flex items-center gap-2 rounded-md px-2 py-[5px] transition-colors hover:bg-accent/50">
      {/* Checkbox */}
      <button
        type="button"
        aria-label={isDone ? 'Mark as incomplete' : 'Mark as complete'}
        onClick={e => {
          e.stopPropagation()
          onToggle()
        }}
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-full border transition-all',
          isDone
            ? 'border-muted-foreground/30 bg-muted-foreground/20'
            : 'border-muted-foreground/50 hover:border-primary'
        )}
      >
        {isDone && (
          <span className="block size-2 rounded-full bg-muted-foreground/50" />
        )}
      </button>

      {/* Title */}
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex-1 truncate text-start transition-all',
          isDone && 'line-through opacity-40'
        )}
        style={{ fontSize: '13px', fontWeight: 400 }}
      >
        {task.title}
      </button>

      {/* Priority */}
      <PriorityDot priority={task.priority} />
    </div>
  )
}

// ─── Quick Add Input ─────────────────────────────────────────────────────────

function QuickAddInput({ onAdd }: { onAdd: (title: string) => void }) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setValue('')
  }

  return (
    <div className="mt-1 flex items-center gap-1.5 rounded-md border border-dashed border-border/60 px-2 py-1 focus-within:border-border">
      <Plus className="size-3 shrink-0 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') handleSubmit()
          if (e.key === 'Escape') setValue('')
        }}
        placeholder="Add task..."
        aria-label="Quick add task"
        className="flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground/50 outline-none"
      />
    </div>
  )
}

// ─── Tasks Widget ─────────────────────────────────────────────────────────────

interface TasksWidgetProps {
  /** Called when "View all →" or a task title is clicked */
  onNavigateToTasks?: (selectedTaskId?: string) => void
}

export function TasksWidget({ onNavigateToTasks }: TasksWidgetProps) {
  const tasks = useTasksStore(state => state.tasks)
  const isLoading = useTasksStore(state => state.isLoading)
  const loadTasks = useTasksStore(state => state.loadTasks)
  const addTask = useTasksStore(state => state.addTask)
  const toggleComplete = useTasksStore(state => state.toggleComplete)
  const setSelectedTask = useTasksStore(state => state.setSelectedTask)

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  const todayTasks = selectTodayTasks(tasks)
  const visibleTasks = todayTasks.slice(0, 6)
  const pendingCount = todayTasks.filter(t => t.status !== 'done').length
  const totalCount = todayTasks.length

  const handleAddTask = async (title: string) => {
    await addTask(title, { due_date: getTodayISO(), priority: 'medium' })
  }

  const handleSelect = (taskId: string) => {
    setSelectedTask(taskId)
    onNavigateToTasks?.(taskId)
  }

  return (
    <WidgetCard title="Today" icon={CheckSquare}>
      <div className="flex h-full flex-col gap-0">
        {/* Stat row */}
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Tasks
          </span>
          {totalCount > 0 && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {pendingCount} / {totalCount}
            </span>
          )}
        </div>

        {/* Task list */}
        <div className="flex flex-1 flex-col gap-0 overflow-y-auto">
          {isLoading ? (
            // Skeleton
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="mx-2 my-1 h-4 animate-pulse rounded bg-muted"
              />
            ))
          ) : visibleTasks.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-4 text-center">
              <CheckSquare
                className="size-5 text-muted-foreground/30"
                strokeWidth={1.5}
              />
              <span className="text-[12px] text-muted-foreground/50">
                Nothing for today
              </span>
            </div>
          ) : (
            visibleTasks.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={() => toggleComplete(task.id)}
                onSelect={() => handleSelect(task.id)}
              />
            ))
          )}
        </div>

        {/* Quick-add */}
        <QuickAddInput onAdd={handleAddTask} />

        {/* Footer */}
        <button
          type="button"
          onClick={() => onNavigateToTasks?.()}
          className="mt-1.5 flex items-center gap-0.5 self-end text-[11px] text-muted-foreground/60 transition-colors hover:text-muted-foreground"
        >
          View all
          <ChevronRight className="size-3" />
        </button>
      </div>
    </WidgetCard>
  )
}

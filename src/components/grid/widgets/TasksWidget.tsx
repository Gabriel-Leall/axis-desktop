import { useEffect, useState } from 'react'
import { CheckSquare, ChevronRight, Plus } from 'lucide-react'
import { WidgetCard } from '../WidgetCard'
import {
  useTasksStore,
  selectTodayTasks,
  type Task,
} from '@/store/tasks-store'
import { cn } from '@/lib/utils'
import { getPriorityTagClass } from '@/lib/priority-tag-styles'

import { motion, AnimatePresence } from 'motion/react'
import { Skeleton } from '@/components/ui/skeleton'
import { listItemVariants } from '@/lib/motion-tokens'

function PriorityTag({ priority }: { priority: Task['priority'] }) {
  const label = priority === 'high' ? 'High' : priority === 'medium' ? 'Medium' : 'Low'

  return (
    <span
      className={cn('shrink-0 tracking-wide', getPriorityTagClass(priority))}
    >
      {label}
    </span>
  )
}

function QuickAddInput({ onAdd }: { onAdd: (title: string) => Promise<void> }) {
  const [value, setValue] = useState('')

  const handleSubmit = async () => {
    const trimmed = value.trim()
    if (!trimmed) return
    await onAdd(trimmed)
    setValue('')
  }

  return (
    <div className="mt-2 flex items-center gap-1.5 rounded-md border border-dashed border-border/60 px-2 py-1.5 focus-within:border-border">
      <Plus className="size-3 shrink-0 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            void handleSubmit()
          }
          if (e.key === 'Escape') setValue('')
        }}
        placeholder="Add task..."
        aria-label="Quick add task"
        className="flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground/50 outline-none"
      />
    </div>
  )
}

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
    <motion.div
      layout
      variants={listItemVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={onSelect}
      className="group flex cursor-pointer items-center gap-3 border-b border-neutral-200 py-2.5 last:border-b-0 dark:border-neutral-800"
    >
      <motion.button
        type="button"
        aria-label={isDone ? 'Mark as incomplete' : 'Mark as complete'}
        onClick={e => {
          e.stopPropagation()
          onToggle()
        }}
        whileTap={{ scale: 0.92 }}
        animate={{ scale: isDone ? [1, 1.08, 1] : 1 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          'relative flex size-5 shrink-0 items-center justify-center rounded border transition-colors',
          isDone
            ? 'border-orange-500 bg-orange-500'
            : 'border-neutral-600 group-hover:border-neutral-400'
        )}
      >
        <AnimatePresence>
          {isDone && (
            <motion.span
              className="pointer-events-none absolute inset-0 rounded border border-orange-400"
              initial={{ opacity: 0.6, scale: 1 }}
              animate={{ opacity: 0, scale: 1.7 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            />
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait" initial={false}>
          {isDone && (
            <motion.span
              key="check"
              initial={{ scale: 0.2, opacity: 0, rotate: -14 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.2, opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <CheckSquare className="size-3 text-white" strokeWidth={2.5} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <span
        className={cn(
          'flex-1 truncate font-sans text-sm',
          isDone
            ? 'text-neutral-400 line-through dark:text-neutral-500'
            : 'text-neutral-800 dark:text-neutral-200'
        )}
      >
        {task.title}
      </span>

      <PriorityTag priority={task.priority} />
    </motion.div>
  )
}

interface TasksWidgetProps {
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
    void loadTasks()
  }, [loadTasks])

  const todayTasks = selectTodayTasks(tasks)
  const fallbackTasks = tasks.filter(t => t.status !== 'done')
  const visibleTasks = (todayTasks.length > 0 ? todayTasks : fallbackTasks).slice(0, 4)
  const totalCount = todayTasks.length
  const pendingCount = todayTasks.filter(t => t.status !== 'done').length

  const handleAddTask = async (title: string) => {
    await addTask(title, { priority: 'medium' })
  }

  const handleSelect = (taskId: string) => {
    setSelectedTask(taskId)
    onNavigateToTasks?.(taskId)
  }

  return (
    <WidgetCard title="Today" icon={CheckSquare}>
      <div className="flex h-full flex-col">
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

        <div className="flex flex-1 flex-col overflow-y-auto">
          {isLoading ? (
            <motion.div
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2 px-1 py-1"
            >
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="size-4 shrink-0 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </motion.div>
          ) : visibleTasks.length === 0 ? (
            <motion.div
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-1 flex-col items-center justify-center gap-1.5 py-4 text-center"
            >
              <CheckSquare
                className="size-5 text-muted-foreground/30"
                strokeWidth={1.5}
              />
              <span className="text-[12px] text-muted-foreground/50">
                Nothing for today
              </span>
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout" initial={false}>
              {visibleTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onToggle={() => toggleComplete(task.id)}
                  onSelect={() => handleSelect(task.id)}
                />
              ))}
            </AnimatePresence>
          )}
        </div>

        <QuickAddInput onAdd={handleAddTask} />

        <button
          type="button"
          onClick={() => onNavigateToTasks?.()}
          className="mt-auto flex items-center gap-0.5 self-end text-[11px] text-muted-foreground/60 transition-colors hover:text-muted-foreground"
        >
          View all
          <ChevronRight className="size-3" />
        </button>
      </div>
    </WidgetCard>
  )
}

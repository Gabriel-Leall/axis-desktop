import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import {
  loadAllTasks,
  createTask as dbCreateTask,
  replaceTask as dbReplaceTask,
  deleteTask as dbDeleteTask,
  createSubtask as dbCreateSubtask,
  toggleSubtask as dbToggleSubtask,
  deleteSubtask as dbDeleteSubtask,
} from '@/services/tasks-db'
import { logger } from '@/lib/logger'

// ─── Domain Types ──────────────────────────────────────────────────────────────

export type Priority = 'low' | 'medium' | 'high'
export type Status = 'todo' | 'in_progress' | 'done'

export interface Subtask {
  id: string
  task_id: string
  title: string
  completed: boolean
  sort_order: number
  created_at: string
}

export interface Task {
  id: string
  title: string
  description?: string
  priority: Priority
  status: Status
  due_date?: string    // ISO date string (YYYY-MM-DD) or undefined for inbox
  completed_at?: string
  created_at: string
  updated_at: string
  sort_order: number
  subtasks: Subtask[]
}

export interface TaskFilters {
  priority: Priority | null
  status: Status | null
  search: string
}

// ─── Store Shape ───────────────────────────────────────────────────────────────

interface TasksState {
  tasks: Task[]
  selectedTaskId: string | null
  filters: TaskFilters
  sectionCollapsed: Record<string, boolean>
  isLoading: boolean

  // Actions
  loadTasks: () => Promise<void>
  addTask: (
    title: string,
    options?: Partial<Pick<Task, 'priority' | 'due_date' | 'description'>>
  ) => Promise<Task>
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  toggleComplete: (id: string) => Promise<void>
  addSubtask: (taskId: string, title: string) => Promise<void>
  toggleSubtask: (taskId: string, subtaskId: string) => Promise<void>
  deleteSubtask: (taskId: string, subtaskId: string) => Promise<void>
  setFilter: (filter: Partial<TaskFilters>) => void
  setSelectedTask: (id: string | null) => void
  toggleSectionCollapsed: (section: string) => void
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function utcNow(): string {
  return new Date().toISOString()
}

/** Returns today's date in YYYY-MM-DD format using local time (not UTC) */
function todayISO(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function generateId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useTasksStore = create<TasksState>()(
  devtools(
    (set, get) => ({
      tasks: [],
      selectedTaskId: null,
      filters: { priority: null, status: null, search: '' },
      sectionCollapsed: {},
      isLoading: false,

      // ── Load ─────────────────────────────────────────────────────────────────
      loadTasks: async () => {
        set({ isLoading: true }, undefined, 'loadTasks/start')
        try {
          const tasks = await loadAllTasks()
          set({ tasks, isLoading: false }, undefined, 'loadTasks/done')
        } catch (error) {
          logger.error(`Failed to load tasks: ${String(error)}`)
          set({ isLoading: false }, undefined, 'loadTasks/error')
        }
      },

      // ── Add ──────────────────────────────────────────────────────────────────
      addTask: async (title, options = {}) => {
        const now = utcNow()
        const newTask: Task = {
          id: generateId(),
          title: title.trim(),
          description: options.description,
          priority: options.priority ?? 'medium',
          status: 'todo',
          due_date: options.due_date ?? todayISO(),
          created_at: now,
          updated_at: now,
          sort_order: get().tasks.length,
          subtasks: [],
        }

        // Optimistic update
        set(
          state => ({ tasks: [newTask, ...state.tasks] }),
          undefined,
          'addTask'
        )

        try {
          await dbCreateTask(newTask)
        } catch (error) {
          // Rollback — remove the optimistic task
          // console.error is intentional here: surfaces the full error in Tauri DevTools
          console.error('[tasks-store] addTask FAILED — SQLite error:', error)
          logger.error(`addTask failed, rolling back: ${String(error)}`)
          set(
            state => ({ tasks: state.tasks.filter(t => t.id !== newTask.id) }),
            undefined,
            'addTask/rollback'
          )
          throw error
        }

        return newTask
      },

      // ── Update ───────────────────────────────────────────────────────────────
      updateTask: async (id, updates) => {
        const now = utcNow()
        const updatesWithTimestamp = { ...updates, updated_at: now }

        // Optimistic update
        set(
          state => ({
            tasks: state.tasks.map(t =>
              t.id === id ? { ...t, ...updatesWithTimestamp } : t
            ),
          }),
          undefined,
          'updateTask'
        )

        const updated = get().tasks.find(t => t.id === id)
        if (!updated) return

        try {
          await dbReplaceTask(updated)
        } catch (error) {
          logger.error(`Failed to persist task update: ${String(error)}`)
          // Reload from DB to reconcile
          await get().loadTasks()
          throw error
        }
      },

      // ── Delete ───────────────────────────────────────────────────────────────
      deleteTask: async id => {
        const snapshot = get().tasks
        set(
          state => ({ tasks: state.tasks.filter(t => t.id !== id) }),
          undefined,
          'deleteTask'
        )

        try {
          await dbDeleteTask(id)
        } catch (error) {
          set({ tasks: snapshot }, undefined, 'deleteTask/rollback')
          throw error
        }
      },

      // ── Toggle Complete ───────────────────────────────────────────────────────
      toggleComplete: async id => {
        const task = get().tasks.find(t => t.id === id)
        if (!task) return

        const now = utcNow()
        const isDone = task.status === 'done'
        const updates: Partial<Task> = {
          status: isDone ? 'todo' : 'done',
          completed_at: isDone ? undefined : now,
          updated_at: now,
        }

        set(
          state => ({
            tasks: state.tasks.map(t =>
              t.id === id ? { ...t, ...updates } : t
            ),
          }),
          undefined,
          'toggleComplete'
        )

        const updated = get().tasks.find(t => t.id === id)
        if (!updated) return

        try {
          await dbReplaceTask(updated)
        } catch (error) {
          logger.error(`Failed to toggle task: ${String(error)}`)
          await get().loadTasks()
        }
      },

      // ── Subtasks ──────────────────────────────────────────────────────────────
      addSubtask: async (taskId, title) => {
        const now = utcNow()
        const parentTask = get().tasks.find(t => t.id === taskId)
        if (!parentTask) return

        const newSubtask: Subtask = {
          id: generateId(),
          task_id: taskId,
          title: title.trim(),
          completed: false,
          sort_order: parentTask.subtasks.length,
          created_at: now,
        }

        set(
          state => ({
            tasks: state.tasks.map(t =>
              t.id === taskId
                ? { ...t, subtasks: [...t.subtasks, newSubtask] }
                : t
            ),
          }),
          undefined,
          'addSubtask'
        )

        await dbCreateSubtask(newSubtask)
      },

      toggleSubtask: async (taskId, subtaskId) => {
        const task = get().tasks.find(t => t.id === taskId)
        const subtask = task?.subtasks.find(s => s.id === subtaskId)
        if (!subtask) return

        const newCompleted = !subtask.completed

        set(
          state => ({
            tasks: state.tasks.map(t =>
              t.id === taskId
                ? {
                    ...t,
                    subtasks: t.subtasks.map(s =>
                      s.id === subtaskId ? { ...s, completed: newCompleted } : s
                    ),
                  }
                : t
            ),
          }),
          undefined,
          'toggleSubtask'
        )

        await dbToggleSubtask(subtaskId, newCompleted)
      },

      deleteSubtask: async (taskId, subtaskId) => {
        set(
          state => ({
            tasks: state.tasks.map(t =>
              t.id === taskId
                ? {
                    ...t,
                    subtasks: t.subtasks.filter(s => s.id !== subtaskId),
                  }
                : t
            ),
          }),
          undefined,
          'deleteSubtask'
        )

        await dbDeleteSubtask(subtaskId)
      },

      // ── Filters ───────────────────────────────────────────────────────────────
      setFilter: filter =>
        set(
          state => ({ filters: { ...state.filters, ...filter } }),
          undefined,
          'setFilter'
        ),

      // ── Selection ─────────────────────────────────────────────────────────────
      setSelectedTask: id =>
        set({ selectedTaskId: id }, undefined, 'setSelectedTask'),

      // ── Sections ──────────────────────────────────────────────────────────────
      toggleSectionCollapsed: section =>
        set(
          state => ({
            sectionCollapsed: {
              ...state.sectionCollapsed,
              [section]: !state.sectionCollapsed[section],
            },
          }),
          undefined,
          'toggleSectionCollapsed'
        ),
    }),
    { name: 'tasks-store' }
  )
)

// ─── Selectors ─────────────────────────────────────────────────────────────────

/** Returns today's date in YYYY-MM-DD using local time (not UTC) */
export function getTodayISO(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Filters tasks matching current store filters */
export function selectFilteredTasks(tasks: Task[], filters: TaskFilters): Task[] {
  return tasks.filter(task => {
    if (filters.priority && task.priority !== filters.priority) return false
    if (filters.status && task.status !== filters.status) return false
    if (
      filters.search &&
      !task.title.toLowerCase().includes(filters.search.toLowerCase())
    )
      return false
    return true
  })
}

/** Returns today's pending tasks (for widget) */
export function selectTodayTasks(tasks: Task[]): Task[] {
  const today = getTodayISO()
  return tasks.filter(
    t => t.status !== 'done' && (t.due_date === today || !t.due_date)
  )
}

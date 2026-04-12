/**
 * Tasks persistence via tauri-plugin-sql (SQLite).
 *
 * Creates and manages the tasks.db SQLite database.
 * All dates are stored as UTC ISO strings in the database.
 */

import Database from '@tauri-apps/plugin-sql'
import { logger } from '@/lib/logger'
import type { Task, Subtask } from '@/store/tasks-store'

const DB_NAME = 'sqlite:tasks.db'

let dbInstance: Database | null = null

/**
 * Gets or creates the database connection, ensuring the schema exists.
 */
async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance

  const db = await Database.load(DB_NAME)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'todo',
      due_date TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS subtasks (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `)

  // Index for common queries
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)`
  )
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`
  )
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id)`
  )

  dbInstance = db
  return db
}

// Raw DB row types
interface TaskRow {
  id: string
  title: string
  description: string | null
  priority: string
  status: string
  due_date: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  sort_order: number
}

interface SubtaskRow {
  id: string
  task_id: string
  title: string
  completed: number
  sort_order: number
  created_at: string
}

function rowToTask(row: TaskRow): Omit<Task, 'subtasks'> {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    priority: row.priority as Task['priority'],
    status: row.status as Task['status'],
    due_date: row.due_date ?? undefined,
    completed_at: row.completed_at ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
    sort_order: row.sort_order,
  }
}

function rowToSubtask(row: SubtaskRow): Subtask {
  return {
    id: row.id,
    task_id: row.task_id,
    title: row.title,
    completed: row.completed === 1,
    sort_order: row.sort_order,
    created_at: row.created_at,
  }
}

/**
 * Loads all tasks with their subtasks from SQLite.
 */
export async function loadAllTasks(): Promise<Task[]> {
  try {
    const db = await getDb()

    const taskRows = await db.select<TaskRow[]>(
      `SELECT * FROM tasks ORDER BY sort_order ASC, created_at DESC`
    )

    const subtaskRows = await db.select<SubtaskRow[]>(
      `SELECT * FROM subtasks ORDER BY sort_order ASC, created_at ASC`
    )

    // Group subtasks by task_id
    const subtasksByTaskId = new Map<string, Subtask[]>()
    for (const row of subtaskRows) {
      const subtask = rowToSubtask(row)
      const existing = subtasksByTaskId.get(subtask.task_id) ?? []
      existing.push(subtask)
      subtasksByTaskId.set(subtask.task_id, existing)
    }

    return taskRows.map(row => ({
      ...rowToTask(row),
      subtasks: subtasksByTaskId.get(row.id) ?? [],
    }))
  } catch (error) {
    logger.error(`Failed to load tasks: ${String(error)}`)
    return []
  }
}

/**
 * Creates a new task in SQLite.
 */
export async function createTask(task: Task): Promise<void> {
  logger.debug(
    `createTask called — id=${task.id} title="${task.title}" due=${task.due_date ?? 'none'}`
  )
  try {
    const db = await getDb()
    logger.debug('createTask: db acquired, executing INSERT')
    await db.execute(
      `INSERT INTO tasks (id, title, description, priority, status, due_date, completed_at, created_at, updated_at, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        task.id,
        task.title,
        task.description ?? null,
        task.priority,
        task.status,
        task.due_date ?? null,
        task.completed_at ?? null,
        task.created_at,
        task.updated_at,
        task.sort_order,
      ]
    )
    logger.debug(`createTask: INSERT successful — id=${task.id}`)
  } catch (error) {
    // Log full error details so we can diagnose exactly what SQLite is rejecting
    const msg = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? (error.stack ?? '') : ''
    logger.error(`createTask FAILED — ${msg}\n${stack}`)
    throw error
  }
}

/**
 * Updates an existing task in SQLite.
 */
export async function updateTask(
  id: string,
  updates: Partial<Omit<Task, 'id' | 'subtasks' | 'created_at'>>
): Promise<void> {
  try {
    const db = await getDb()
    const now = new Date().toISOString()

    await db.execute(
      `UPDATE tasks SET
        title = COALESCE($1, title),
        description = $2,
        priority = COALESCE($3, priority),
        status = COALESCE($4, status),
        due_date = $5,
        completed_at = $6,
        updated_at = $7,
        sort_order = COALESCE($8, sort_order)
       WHERE id = $9`,
      [
        updates.title ?? null,
        updates.description !== undefined
          ? (updates.description ?? null)
          : null,
        updates.priority ?? null,
        updates.status ?? null,
        updates.due_date !== undefined ? (updates.due_date ?? null) : null,
        updates.completed_at !== undefined
          ? (updates.completed_at ?? null)
          : null,
        updates.updated_at ?? now,
        updates.sort_order !== undefined ? updates.sort_order : null,
        id,
      ]
    )
    logger.debug(`Task updated: ${id}`)
  } catch (error) {
    logger.error(`Failed to update task: ${String(error)}`)
    throw error
  }
}

/**
 * Hard-updates a task row with explicit values.
 */
export async function replaceTask(task: Task): Promise<void> {
  try {
    const db = await getDb()
    await db.execute(
      `UPDATE tasks SET
        title = $1,
        description = $2,
        priority = $3,
        status = $4,
        due_date = $5,
        completed_at = $6,
        updated_at = $7,
        sort_order = $8
       WHERE id = $9`,
      [
        task.title,
        task.description ?? null,
        task.priority,
        task.status,
        task.due_date ?? null,
        task.completed_at ?? null,
        task.updated_at,
        task.sort_order,
        task.id,
      ]
    )
  } catch (error) {
    logger.error(`Failed to replace task: ${String(error)}`)
    throw error
  }
}

/**
 * Deletes a task (subtasks cascade via FK).
 */
export async function deleteTask(id: string): Promise<void> {
  try {
    const db = await getDb()
    await db.execute(`DELETE FROM tasks WHERE id = $1`, [id])
    logger.debug(`Task deleted: ${id}`)
  } catch (error) {
    logger.error(`Failed to delete task: ${String(error)}`)
    throw error
  }
}

/**
 * Creates a subtask.
 */
export async function createSubtask(subtask: Subtask): Promise<void> {
  try {
    const db = await getDb()
    await db.execute(
      `INSERT INTO subtasks (id, task_id, title, completed, sort_order, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        subtask.id,
        subtask.task_id,
        subtask.title,
        subtask.completed ? 1 : 0,
        subtask.sort_order,
        subtask.created_at,
      ]
    )
  } catch (error) {
    logger.error(`Failed to create subtask: ${String(error)}`)
    throw error
  }
}

/**
 * Toggles a subtask's completed status.
 */
export async function toggleSubtask(
  id: string,
  completed: boolean
): Promise<void> {
  try {
    const db = await getDb()
    await db.execute(`UPDATE subtasks SET completed = $1 WHERE id = $2`, [
      completed ? 1 : 0,
      id,
    ])
  } catch (error) {
    logger.error(`Failed to toggle subtask: ${String(error)}`)
    throw error
  }
}

/**
 * Deletes a subtask.
 */
export async function deleteSubtask(id: string): Promise<void> {
  try {
    const db = await getDb()
    await db.execute(`DELETE FROM subtasks WHERE id = $1`, [id])
  } catch (error) {
    logger.error(`Failed to delete subtask: ${String(error)}`)
    throw error
  }
}

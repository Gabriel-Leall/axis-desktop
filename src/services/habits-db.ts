import Database from '@tauri-apps/plugin-sql'
import { logger } from '@/lib/logger'

const DB_NAME = 'sqlite:tasks.db'

let dbInstance: Database | null = null

export interface HabitRecord {
  id: string
  name: string
  color: string
  icon: string | null
  frequency: 'daily' | 'weekdays' | 'weekends' | 'custom'
  frequency_days: string | null
  active: number
  sort_order: number
  created_at: string
  updated_at: string
}

export interface HabitLogRecord {
  id: string
  habit_id: string
  completed_date: string
  completed_at: string
}

async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance

  const db = await Database.load(DB_NAME)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6366f1',
      icon TEXT,
      frequency TEXT NOT NULL DEFAULT 'daily',
      frequency_days TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS habit_logs (
      id TEXT PRIMARY KEY,
      habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
      completed_date TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      UNIQUE(habit_id, completed_date)
    )
  `)

  await db.execute(
    'CREATE INDEX IF NOT EXISTS idx_habits_active_sort ON habits(active, sort_order)'
  )
  await db.execute(
    'CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_date ON habit_logs(habit_id, completed_date)'
  )
  await db.execute(
    'CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON habit_logs(completed_date)'
  )

  dbInstance = db
  return db
}

export async function loadActiveHabits(): Promise<HabitRecord[]> {
  try {
    const db = await getDb()
    return db.select<HabitRecord[]>(
      `SELECT * FROM habits
       WHERE active = 1
       ORDER BY sort_order ASC, created_at ASC`
    )
  } catch (error) {
    logger.error(`Failed to load habits: ${String(error)}`)
    return []
  }
}

export async function createHabit(habit: HabitRecord): Promise<void> {
  const db = await getDb()
  await db.execute(
    `INSERT INTO habits
      (id, name, color, icon, frequency, frequency_days, active, sort_order, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      habit.id,
      habit.name,
      habit.color,
      habit.icon,
      habit.frequency,
      habit.frequency_days,
      habit.active,
      habit.sort_order,
      habit.created_at,
      habit.updated_at,
    ]
  )
}

export async function updateHabit(
  id: string,
  updates: Partial<
    Pick<
      HabitRecord,
      | 'name'
      | 'color'
      | 'icon'
      | 'frequency'
      | 'frequency_days'
      | 'sort_order'
      | 'updated_at'
    >
  >
): Promise<void> {
  const db = await getDb()
  await db.execute(
    `UPDATE habits SET
      name = COALESCE($1, name),
      color = COALESCE($2, color),
      icon = $3,
      frequency = COALESCE($4, frequency),
      frequency_days = $5,
      sort_order = COALESCE($6, sort_order),
      updated_at = COALESCE($7, updated_at)
     WHERE id = $8`,
    [
      updates.name ?? null,
      updates.color ?? null,
      updates.icon !== undefined ? updates.icon : null,
      updates.frequency ?? null,
      updates.frequency_days !== undefined ? updates.frequency_days : null,
      updates.sort_order ?? null,
      updates.updated_at ?? null,
      id,
    ]
  )
}

export async function archiveHabit(
  id: string,
  updatedAt: string
): Promise<void> {
  const db = await getDb()
  await db.execute(
    'UPDATE habits SET active = 0, updated_at = $1 WHERE id = $2',
    [updatedAt, id]
  )
}

export async function deleteHabit(id: string): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM habits WHERE id = $1', [id])
}

export async function loadLogsByDate(
  dateISO: string
): Promise<HabitLogRecord[]> {
  try {
    const db = await getDb()
    return db.select<HabitLogRecord[]>(
      'SELECT * FROM habit_logs WHERE completed_date = $1 ORDER BY completed_at ASC',
      [dateISO]
    )
  } catch (error) {
    logger.error(`Failed to load logs by date: ${String(error)}`)
    return []
  }
}

export async function loadLogsSinceDate(
  minDateISO: string
): Promise<HabitLogRecord[]> {
  try {
    const db = await getDb()
    return db.select<HabitLogRecord[]>(
      `SELECT * FROM habit_logs
       WHERE completed_date >= $1
       ORDER BY completed_date ASC, completed_at ASC`,
      [minDateISO]
    )
  } catch (error) {
    logger.error(`Failed to load logs since date: ${String(error)}`)
    return []
  }
}

export async function upsertHabitLog(log: HabitLogRecord): Promise<void> {
  const db = await getDb()
  await db.execute(
    `INSERT OR REPLACE INTO habit_logs
      (id, habit_id, completed_date, completed_at)
     VALUES ($1, $2, $3, $4)`,
    [log.id, log.habit_id, log.completed_date, log.completed_at]
  )
}

export async function deleteHabitLog(
  habitId: string,
  dateISO: string
): Promise<void> {
  const db = await getDb()
  await db.execute(
    'DELETE FROM habit_logs WHERE habit_id = $1 AND completed_date = $2',
    [habitId, dateISO]
  )
}

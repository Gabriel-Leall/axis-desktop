/**
 * Pomodoro persistence via tauri-plugin-sql (SQLite).
 *
 * Reuses the same database file as tasks (tasks.db) so joins are possible.
 * Tables are created lazily on first getDb() call.
 * All dates stored as UTC ISO strings.
 */

import Database from '@tauri-apps/plugin-sql'
import { logger } from '@/lib/logger'
import type { PomodoroSession, PomodoroSettings } from '@/store/pomodoro-types'

const DB_NAME = 'sqlite:tasks.db'

let dbInstance: Database | null = null

async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance

  const db = await Database.load(DB_NAME)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS pomodoro_sessions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      created_at TEXT NOT NULL
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS pomodoro_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      focus_duration INTEGER NOT NULL DEFAULT 25,
      short_break_duration INTEGER NOT NULL DEFAULT 5,
      long_break_duration INTEGER NOT NULL DEFAULT 15,
      pomos_until_long_break INTEGER NOT NULL DEFAULT 4,
      auto_start_breaks INTEGER NOT NULL DEFAULT 0,
      auto_start_focus INTEGER NOT NULL DEFAULT 0,
      sound_notifications INTEGER NOT NULL DEFAULT 1
    )
  `)

  // Ensure singleton settings row always exists
  await db.execute(`INSERT OR IGNORE INTO pomodoro_settings (id) VALUES (1)`)

  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_started_at
     ON pomodoro_sessions(started_at)`
  )

  dbInstance = db
  return db
}

// ─── Row types ─────────────────────────────────────────────────────────────────

interface SessionRow {
  id: string
  type: string
  duration_seconds: number
  completed: number
  task_id: string | null
  started_at: string
  ended_at: string | null
  created_at: string
}

interface SettingsRow {
  id: number
  focus_duration: number
  short_break_duration: number
  long_break_duration: number
  pomos_until_long_break: number
  auto_start_breaks: number
  auto_start_focus: number
  sound_notifications: number
}

// ─── Mappers ───────────────────────────────────────────────────────────────────

function rowToSession(row: SessionRow): PomodoroSession {
  return {
    id: row.id,
    type: row.type as PomodoroSession['type'],
    duration_seconds: row.duration_seconds,
    completed: row.completed === 1,
    task_id: row.task_id ?? null,
    started_at: row.started_at,
    ended_at: row.ended_at ?? undefined,
    created_at: row.created_at,
  }
}

function rowToSettings(row: SettingsRow): PomodoroSettings {
  return {
    focus_duration: row.focus_duration,
    short_break_duration: row.short_break_duration,
    long_break_duration: row.long_break_duration,
    pomos_until_long_break: row.pomos_until_long_break,
    auto_start_breaks: row.auto_start_breaks === 1,
    auto_start_focus: row.auto_start_focus === 1,
    sound_notifications: row.sound_notifications === 1,
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS: PomodoroSettings = {
  focus_duration: 25,
  short_break_duration: 5,
  long_break_duration: 15,
  pomos_until_long_break: 4,
  auto_start_breaks: false,
  auto_start_focus: false,
  sound_notifications: true,
}

/**
 * Loads pomodoro settings from SQLite.
 * The INSERT OR IGNORE in getDb() ensures the row always exists.
 */
export async function loadPomodoroSettings(): Promise<PomodoroSettings> {
  try {
    const db = await getDb()
    const rows = await db.select<SettingsRow[]>(
      `SELECT * FROM pomodoro_settings WHERE id = 1`
    )
    if (rows.length === 0 || !rows[0]) return DEFAULT_SETTINGS
    return rowToSettings(rows[0])
  } catch (error) {
    logger.error(`Failed to load pomodoro settings: ${String(error)}`)
    return DEFAULT_SETTINGS
  }
}

/**
 * Persists pomodoro settings to SQLite.
 */
export async function savePomodoroSettings(
  settings: PomodoroSettings
): Promise<void> {
  try {
    const db = await getDb()
    await db.execute(
      `UPDATE pomodoro_settings SET
        focus_duration = $1,
        short_break_duration = $2,
        long_break_duration = $3,
        pomos_until_long_break = $4,
        auto_start_breaks = $5,
        auto_start_focus = $6,
        sound_notifications = $7
       WHERE id = 1`,
      [
        settings.focus_duration,
        settings.short_break_duration,
        settings.long_break_duration,
        settings.pomos_until_long_break,
        settings.auto_start_breaks ? 1 : 0,
        settings.auto_start_focus ? 1 : 0,
        settings.sound_notifications ? 1 : 0,
      ]
    )
    logger.debug('Pomodoro settings saved')
  } catch (error) {
    logger.error(`Failed to save pomodoro settings: ${String(error)}`)
    throw error
  }
}

/**
 * Saves a completed or aborted session to SQLite.
 */
export async function savePomodoroSession(
  session: PomodoroSession
): Promise<void> {
  try {
    const db = await getDb()
    await db.execute(
      `INSERT INTO pomodoro_sessions
         (id, type, duration_seconds, completed, task_id, started_at, ended_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        session.id,
        session.type,
        session.duration_seconds,
        session.completed ? 1 : 0,
        session.task_id ?? null,
        session.started_at,
        session.ended_at ?? null,
        session.created_at,
      ]
    )
    logger.debug(`Pomodoro session saved: ${session.id}`)
  } catch (error) {
    logger.error(`Failed to save pomodoro session: ${String(error)}`)
    throw error
  }
}

/**
 * Loads all sessions started today (local time).
 */
export async function loadTodaySessions(): Promise<PomodoroSession[]> {
  try {
    const db = await getDb()
    // Calculate today's start in UTC by converting local midnight
    const now = new Date()
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).toISOString()

    const rows = await db.select<SessionRow[]>(
      `SELECT * FROM pomodoro_sessions
       WHERE started_at >= $1
       ORDER BY started_at ASC`,
      [todayStart]
    )
    return rows.map(rowToSession)
  } catch (error) {
    logger.error(`Failed to load today's sessions: ${String(error)}`)
    return []
  }
}

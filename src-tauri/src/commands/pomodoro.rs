//! Pomodoro domain commands.
//!
//! All pomodoro session and settings persistence goes through these commands.
//! SQL stays in Rust — the frontend only receives typed structs.

use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::{Pool, Row, Sqlite};
use tauri::State;

// ─── Structs ──────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Type, Clone)]
pub struct PomodoroSession {
    pub id: String,
    pub session_type: String, // "focus" | "short_break" | "long_break"
    pub duration_seconds: i32,
    pub completed: bool,
    pub task_id: Option<String>,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Type, Clone)]
pub struct PomodoroSettings {
    pub focus_duration: i32,
    pub short_break_duration: i32,
    pub long_break_duration: i32,
    pub pomos_until_long_break: i32,
    pub auto_start_breaks: bool,
    pub auto_start_focus: bool,
    pub sound_notifications: bool,
}

impl Default for PomodoroSettings {
    fn default() -> Self {
        Self {
            focus_duration: 25,
            short_break_duration: 5,
            long_break_duration: 15,
            pomos_until_long_break: 4,
            auto_start_breaks: false,
            auto_start_focus: false,
            sound_notifications: true,
        }
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn row_to_session(row: &sqlx::sqlite::SqliteRow) -> PomodoroSession {
    let completed: i64 = row.get("completed");
    PomodoroSession {
        id: row.get("id"),
        session_type: row.get("session_type"),
        duration_seconds: row.get("duration_seconds"),
        completed: completed != 0,
        task_id: row.get("task_id"),
        started_at: row.get("started_at"),
        ended_at: row.get("ended_at"),
        created_at: row.get("created_at"),
    }
}

fn row_to_settings(row: &sqlx::sqlite::SqliteRow) -> PomodoroSettings {
    let auto_start_breaks: i64 = row.get("auto_start_breaks");
    let auto_start_focus: i64 = row.get("auto_start_focus");
    let sound_notifications: i64 = row.get("sound_notifications");
    PomodoroSettings {
        focus_duration: row.get("focus_duration"),
        short_break_duration: row.get("short_break_duration"),
        long_break_duration: row.get("long_break_duration"),
        pomos_until_long_break: row.get("pomos_until_long_break"),
        auto_start_breaks: auto_start_breaks != 0,
        auto_start_focus: auto_start_focus != 0,
        sound_notifications: sound_notifications != 0,
    }
}

// ─── Commands ─────────────────────────────────────────────────────────────────

/// Saves a pomodoro session (completed or aborted).
#[tauri::command]
#[specta::specta]
pub async fn save_pomodoro_session(
    pool: State<'_, Pool<Sqlite>>,
    session: PomodoroSession,
) -> Result<(), String> {
    let completed_int: i64 = if session.completed { 1 } else { 0 };
    sqlx::query(
        "INSERT OR REPLACE INTO pomodoro_sessions
         (id, session_type, duration_seconds, completed, task_id, started_at, ended_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&session.id)
    .bind(&session.session_type)
    .bind(session.duration_seconds)
    .bind(completed_int)
    .bind(&session.task_id)
    .bind(&session.started_at)
    .bind(&session.ended_at)
    .bind(&session.created_at)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to save session: {e}"))?;

    log::debug!("Pomodoro session saved: {}", session.id);
    Ok(())
}

/// Returns all sessions started on or after `today_start` (UTC ISO timestamp).
#[tauri::command]
#[specta::specta]
pub async fn get_today_sessions(
    pool: State<'_, Pool<Sqlite>>,
    today_start: String,
) -> Result<Vec<PomodoroSession>, String> {
    let rows = sqlx::query(
        "SELECT id, session_type, duration_seconds, completed, task_id,
                started_at, ended_at, created_at
         FROM pomodoro_sessions
         WHERE started_at >= ?
         ORDER BY started_at ASC",
    )
    .bind(today_start)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Failed to query sessions: {e}"))?;

    Ok(rows.iter().map(row_to_session).collect())
}

/// Loads persisted pomodoro settings. Returns defaults if not yet saved.
#[tauri::command]
#[specta::specta]
pub async fn get_pomodoro_settings(
    pool: State<'_, Pool<Sqlite>>,
) -> Result<PomodoroSettings, String> {
    let row = sqlx::query(
        "SELECT focus_duration, short_break_duration, long_break_duration,
                pomos_until_long_break, auto_start_breaks, auto_start_focus, sound_notifications
         FROM pomodoro_settings WHERE id = 1",
    )
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| format!("Failed to query settings: {e}"))?;

    Ok(row.as_ref().map(row_to_settings).unwrap_or_default())
}

/// Persists pomodoro settings (upsert on the singleton row id=1).
#[tauri::command]
#[specta::specta]
pub async fn save_pomodoro_settings(
    pool: State<'_, Pool<Sqlite>>,
    settings: PomodoroSettings,
) -> Result<(), String> {
    let auto_start_breaks_int: i64 = if settings.auto_start_breaks { 1 } else { 0 };
    let auto_start_focus_int: i64 = if settings.auto_start_focus { 1 } else { 0 };
    let sound_notifications_int: i64 = if settings.sound_notifications { 1 } else { 0 };

    sqlx::query(
        "INSERT INTO pomodoro_settings
         (id, focus_duration, short_break_duration, long_break_duration,
          pomos_until_long_break, auto_start_breaks, auto_start_focus, sound_notifications)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           focus_duration         = excluded.focus_duration,
           short_break_duration   = excluded.short_break_duration,
           long_break_duration    = excluded.long_break_duration,
           pomos_until_long_break = excluded.pomos_until_long_break,
           auto_start_breaks      = excluded.auto_start_breaks,
           auto_start_focus       = excluded.auto_start_focus,
           sound_notifications    = excluded.sound_notifications",
    )
    .bind(settings.focus_duration)
    .bind(settings.short_break_duration)
    .bind(settings.long_break_duration)
    .bind(settings.pomos_until_long_break)
    .bind(auto_start_breaks_int)
    .bind(auto_start_focus_int)
    .bind(sound_notifications_int)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to save settings: {e}"))?;

    log::debug!("Pomodoro settings saved");
    Ok(())
}

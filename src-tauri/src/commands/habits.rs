//! Habits domain commands.
//!
//! All habit and habit log persistence goes through these commands.
//! SQL stays in Rust — the frontend only receives typed structs.

use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::{Pool, Row, Sqlite};
use tauri::State;

// ─── Structs ──────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Type, Clone)]
pub struct Habit {
    pub id: String,
    pub name: String,
    pub color: String,
    pub icon: Option<String>,
    pub frequency: String, // "daily" | "weekdays" | "weekends" | "custom"
    pub frequency_days: Option<String>, // JSON array e.g. "[1,2,3,4,5]"
    pub active: bool,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Type, Clone)]
pub struct HabitLog {
    pub id: String,
    pub habit_id: String,
    pub completed_date: String, // "YYYY-MM-DD"
    pub completed_at: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct CreateHabitInput {
    pub id: String,
    pub name: String,
    pub color: String,
    pub icon: Option<String>,
    pub frequency: String,
    pub frequency_days: Option<String>,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct UpdateHabitInput {
    pub id: String,
    pub name: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub frequency: Option<String>,
    pub frequency_days: Option<String>,
    pub sort_order: Option<i32>,
    pub updated_at: String,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn row_to_habit(row: &sqlx::sqlite::SqliteRow) -> Habit {
    let active: i64 = row.get("active");
    Habit {
        id: row.get("id"),
        name: row.get("name"),
        color: row.get("color"),
        icon: row.get("icon"),
        frequency: row.get("frequency"),
        frequency_days: row.get("frequency_days"),
        active: active != 0,
        sort_order: row.get("sort_order"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

fn row_to_log(row: &sqlx::sqlite::SqliteRow) -> HabitLog {
    HabitLog {
        id: row.get("id"),
        habit_id: row.get("habit_id"),
        completed_date: row.get("completed_date"),
        completed_at: row.get("completed_at"),
    }
}

// ─── Commands ─────────────────────────────────────────────────────────────────

/// Returns all active habits ordered by sort_order.
#[tauri::command]
#[specta::specta]
pub async fn get_habits(pool: State<'_, Pool<Sqlite>>) -> Result<Vec<Habit>, String> {
    let rows = sqlx::query(
        "SELECT id, name, color, icon, frequency, frequency_days, active, sort_order,
                created_at, updated_at
         FROM habits
         WHERE active = 1
         ORDER BY sort_order ASC, created_at ASC",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Failed to query habits: {e}"))?;

    Ok(rows.iter().map(row_to_habit).collect())
}

/// Creates a new habit.
#[tauri::command]
#[specta::specta]
pub async fn create_habit(
    pool: State<'_, Pool<Sqlite>>,
    input: CreateHabitInput,
) -> Result<Habit, String> {
    sqlx::query(
        "INSERT INTO habits
         (id, name, color, icon, frequency, frequency_days, active, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)",
    )
    .bind(&input.id)
    .bind(&input.name)
    .bind(&input.color)
    .bind(&input.icon)
    .bind(&input.frequency)
    .bind(&input.frequency_days)
    .bind(input.sort_order)
    .bind(&input.created_at)
    .bind(&input.updated_at)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to create habit: {e}"))?;

    log::debug!("Habit created: {}", input.id);

    Ok(Habit {
        id: input.id,
        name: input.name,
        color: input.color,
        icon: input.icon,
        frequency: input.frequency,
        frequency_days: input.frequency_days,
        active: true,
        sort_order: input.sort_order,
        created_at: input.created_at,
        updated_at: input.updated_at,
    })
}

/// Updates an existing habit's fields. Returns the updated habit.
#[tauri::command]
#[specta::specta]
pub async fn update_habit(
    pool: State<'_, Pool<Sqlite>>,
    input: UpdateHabitInput,
) -> Result<Habit, String> {
    sqlx::query(
        "UPDATE habits SET
         name           = COALESCE(?, name),
         color          = COALESCE(?, color),
         icon           = ?,
         frequency      = COALESCE(?, frequency),
         frequency_days = ?,
         sort_order     = COALESCE(?, sort_order),
         updated_at     = ?
         WHERE id = ?",
    )
    .bind(&input.name)
    .bind(&input.color)
    .bind(&input.icon)
    .bind(&input.frequency)
    .bind(&input.frequency_days)
    .bind(input.sort_order)
    .bind(&input.updated_at)
    .bind(&input.id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to update habit: {e}"))?;

    let row = sqlx::query(
        "SELECT id, name, color, icon, frequency, frequency_days, active, sort_order,
                created_at, updated_at
         FROM habits WHERE id = ?",
    )
    .bind(&input.id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Habit not found after update: {e}"))?;

    Ok(row_to_habit(&row))
}

/// Archives a habit (sets active = false). Logs are preserved.
#[tauri::command]
#[specta::specta]
pub async fn archive_habit(
    pool: State<'_, Pool<Sqlite>>,
    id: String,
    updated_at: String,
) -> Result<(), String> {
    sqlx::query("UPDATE habits SET active = 0, updated_at = ? WHERE id = ?")
        .bind(&updated_at)
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to archive habit: {e}"))?;

    log::debug!("Habit archived: {id}");
    Ok(())
}

/// Permanently deletes a habit and its logs (ON DELETE CASCADE).
#[tauri::command]
#[specta::specta]
pub async fn delete_habit(pool: State<'_, Pool<Sqlite>>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM habits WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to delete habit: {e}"))?;

    log::debug!("Habit deleted: {id}");
    Ok(())
}

/// Toggles a habit log for the given date.
/// Inserts if no log exists; deletes if it already exists.
/// Returns `true` if the habit is now completed, `false` if uncompleted.
#[tauri::command]
#[specta::specta]
pub async fn toggle_habit_log(
    pool: State<'_, Pool<Sqlite>>,
    habit_id: String,
    date: String,
    log_id: String,
    completed_at: String,
) -> Result<bool, String> {
    let existing =
        sqlx::query("SELECT id FROM habit_logs WHERE habit_id = ? AND completed_date = ?")
            .bind(&habit_id)
            .bind(&date)
            .fetch_optional(pool.inner())
            .await
            .map_err(|e| format!("Failed to check habit log: {e}"))?;

    if existing.is_none() {
        sqlx::query(
            "INSERT INTO habit_logs (id, habit_id, completed_date, completed_at)
             VALUES (?, ?, ?, ?)",
        )
        .bind(&log_id)
        .bind(&habit_id)
        .bind(&date)
        .bind(&completed_at)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to insert habit log: {e}"))?;

        log::debug!("Habit log inserted for {habit_id}");
        Ok(true)
    } else {
        sqlx::query("DELETE FROM habit_logs WHERE habit_id = ? AND completed_date = ?")
            .bind(&habit_id)
            .bind(&date)
            .execute(pool.inner())
            .await
            .map_err(|e| format!("Failed to delete habit log: {e}"))?;

        log::debug!("Habit log removed for {habit_id}");
        Ok(false)
    }
}

/// Returns all habit logs within a date range (inclusive), used for heat maps.
#[tauri::command]
#[specta::specta]
pub async fn get_habit_logs_range(
    pool: State<'_, Pool<Sqlite>>,
    start_date: String,
    end_date: String,
) -> Result<Vec<HabitLog>, String> {
    let rows = sqlx::query(
        "SELECT id, habit_id, completed_date, completed_at
         FROM habit_logs
         WHERE completed_date >= ? AND completed_date <= ?
         ORDER BY completed_date ASC, completed_at ASC",
    )
    .bind(start_date)
    .bind(end_date)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Failed to query habit logs: {e}"))?;

    Ok(rows.iter().map(row_to_log).collect())
}

/// Returns all habit logs for a specific date.
#[tauri::command]
#[specta::specta]
pub async fn get_habit_logs_for_date(
    pool: State<'_, Pool<Sqlite>>,
    date: String,
) -> Result<Vec<HabitLog>, String> {
    let rows = sqlx::query(
        "SELECT id, habit_id, completed_date, completed_at
         FROM habit_logs
         WHERE completed_date = ?
         ORDER BY completed_at ASC",
    )
    .bind(date)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Failed to query habit logs: {e}"))?;

    Ok(rows.iter().map(row_to_log).collect())
}

//! Calendar domain commands.
//!
//! All calendar event persistence goes through these commands.
//! SQL stays in Rust — the frontend only receives typed structs.

use regex::Regex;
use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::{Pool, Row, Sqlite};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Type, Clone)]
pub struct CalendarEvent {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub start_date: String, // YYYY-MM-DD for all-day, RFC3339 for timed
    pub end_date: String,   // YYYY-MM-DD for all-day (exclusive), RFC3339 for timed
    pub all_day: bool,
    pub color: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct CreateEventInput {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub start_date: String,
    pub end_date: String,
    pub all_day: bool,
    pub color: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct UpdateEventInput {
    pub id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub all_day: Option<bool>,
    pub color: Option<String>,
    pub updated_at: String,
}

fn row_to_event(row: &sqlx::sqlite::SqliteRow) -> CalendarEvent {
    let all_day_int: i64 = row.get("all_day");
    CalendarEvent {
        id: row.get("id"),
        title: row.get("title"),
        description: row.get("description"),
        start_date: row.get("start_date"),
        end_date: row.get("end_date"),
        all_day: all_day_int != 0,
        color: row.get("color"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

fn validate_all_day_date(date: &str, field: &str) -> Result<(), String> {
    let re = Regex::new(r"^\d{4}-\d{2}-\d{2}$").unwrap();
    if !re.is_match(date) {
        return Err(format!("{field} must be YYYY-MM-DD for all-day events",));
    }
    Ok(())
}

fn validate_rfc3339(date: &str, field: &str) -> Result<(), String> {
    let re = Regex::new(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$")
        .unwrap();
    if !re.is_match(date) {
        return Err(format!("{field} must be valid RFC3339",));
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn get_events_range(
    pool: State<'_, Pool<Sqlite>>,
    start: String,
    end: String,
) -> Result<Vec<CalendarEvent>, String> {
    if start.len() != 10 || end.len() != 10 {
        return Err("Start and end must be YYYY-MM-DD".to_string());
    }

    let rows = sqlx::query(
        "SELECT id, title, description, start_date, end_date, all_day, color, created_at, updated_at
         FROM calendar_events
         WHERE date(start_date) <= date(?) AND date(end_date) >= date(?)
         ORDER BY start_date ASC",
    )
    .bind(&end)
    .bind(&start)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Failed to query events: {e}"))?;

    Ok(rows.iter().map(row_to_event).collect())
}

#[tauri::command]
#[specta::specta]
pub async fn create_event(
    pool: State<'_, Pool<Sqlite>>,
    input: CreateEventInput,
) -> Result<CalendarEvent, String> {
    if input.title.trim().is_empty() {
        return Err("Title cannot be empty".to_string());
    }

    if input.all_day {
        validate_all_day_date(&input.start_date, "start_date")?;
        validate_all_day_date(&input.end_date, "end_date")?;
    } else {
        validate_rfc3339(&input.start_date, "start_date")?;
        validate_rfc3339(&input.end_date, "end_date")?;
    }

    if input.all_day {
        if input.end_date <= input.start_date {
            return Err("End date must be after start date for all-day events".to_string());
        }
    } else {
        if input.end_date <= input.start_date {
            return Err("End datetime must be after start datetime".to_string());
        }
    }

    sqlx::query(
        "INSERT INTO calendar_events
         (id, title, description, start_date, end_date, all_day, color, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&input.id)
    .bind(&input.title)
    .bind(&input.description)
    .bind(&input.start_date)
    .bind(&input.end_date)
    .bind(if input.all_day { 1 } else { 0 })
    .bind(&input.color)
    .bind(&input.created_at)
    .bind(&input.updated_at)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to create event: {e}"))?;

    log::debug!("Calendar event created: {}", input.id);

    Ok(CalendarEvent {
        id: input.id,
        title: input.title,
        description: input.description,
        start_date: input.start_date,
        end_date: input.end_date,
        all_day: input.all_day,
        color: input.color,
        created_at: input.created_at,
        updated_at: input.updated_at,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn update_event(
    pool: State<'_, Pool<Sqlite>>,
    input: UpdateEventInput,
) -> Result<CalendarEvent, String> {
    let existing = sqlx::query(
        "SELECT id, title, description, start_date, end_date, all_day, color, created_at, updated_at
         FROM calendar_events WHERE id = ?",
    )
    .bind(&input.id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Event not found: {e}"))?;

    let all_day = input
        .all_day
        .unwrap_or(existing.get::<i64, _>("all_day") != 0);
    let start_date = input.start_date.unwrap_or(existing.get("start_date"));
    let end_date = input.end_date.unwrap_or(existing.get("end_date"));
    let title = input.title.unwrap_or(existing.get("title"));
    let description = input.description.or(existing.get("description"));
    let color = input.color.or(existing.get("color"));
    let created_at = existing.get::<String, _>("created_at");

    if title.trim().is_empty() {
        return Err("Title cannot be empty".to_string());
    }

    if all_day {
        validate_all_day_date(&start_date, "start_date")?;
        validate_all_day_date(&end_date, "end_date")?;
    } else {
        validate_rfc3339(&start_date, "start_date")?;
        validate_rfc3339(&end_date, "end_date")?;
    }

    if end_date <= start_date {
        return Err("End must be after start".to_string());
    }

    sqlx::query(
        "UPDATE calendar_events SET
         title = ?, description = ?, start_date = ?, end_date = ?,
         all_day = ?, color = ?, updated_at = ?
         WHERE id = ?",
    )
    .bind(&title)
    .bind(&description)
    .bind(&start_date)
    .bind(&end_date)
    .bind(if all_day { 1 } else { 0 })
    .bind(&color)
    .bind(&input.updated_at)
    .bind(&input.id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to update event: {e}"))?;

    Ok(CalendarEvent {
        id: input.id,
        title,
        description,
        start_date,
        end_date,
        all_day,
        color,
        created_at,
        updated_at: input.updated_at,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn delete_event(pool: State<'_, Pool<Sqlite>>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM calendar_events WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to delete event: {e}"))?;

    log::debug!("Calendar event deleted: {id}");
    Ok(())
}

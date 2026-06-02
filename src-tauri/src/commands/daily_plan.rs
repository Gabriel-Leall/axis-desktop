//! Daily plan persistence commands.
//!
//! The daily plan stores only the current day's focus and state.

use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::{Pool, Row, Sqlite};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Type, Clone)]
pub struct DailyPlan {
    pub id: String,
    pub plan_date: String,
    pub focus_task_id: Option<String>,
    pub status: String,
    pub focus_source: String,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct CreateDailyPlanInput {
    pub id: String,
    pub plan_date: String,
    pub focus_task_id: Option<String>,
    pub status: String,
    pub focus_source: String,
    pub created_at: String,
    pub updated_at: String,
}

fn row_to_daily_plan(row: &sqlx::sqlite::SqliteRow) -> DailyPlan {
    DailyPlan {
        id: row.get("id"),
        plan_date: row.get("plan_date"),
        focus_task_id: row.get("focus_task_id"),
        status: row.get("status"),
        focus_source: row.get("focus_source"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        completed_at: row.get("completed_at"),
    }
}

#[tauri::command]
#[specta::specta]
pub async fn get_daily_plan(
    pool: State<'_, Pool<Sqlite>>,
    date: String,
) -> Result<Option<DailyPlan>, String> {
    let row = sqlx::query(
        "SELECT id, plan_date, focus_task_id, status, focus_source, created_at, updated_at, completed_at
         FROM daily_plans
         WHERE plan_date = ?
         LIMIT 1",
    )
    .bind(date)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| format!("Failed to query daily plan: {e}"))?;

    Ok(row.as_ref().map(row_to_daily_plan))
}

#[tauri::command]
#[specta::specta]
pub async fn create_daily_plan(
    pool: State<'_, Pool<Sqlite>>,
    input: CreateDailyPlanInput,
) -> Result<DailyPlan, String> {
    sqlx::query(
        "INSERT INTO daily_plans
         (id, plan_date, focus_task_id, status, focus_source, created_at, updated_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL)",
    )
    .bind(&input.id)
    .bind(&input.plan_date)
    .bind(&input.focus_task_id)
    .bind(&input.status)
    .bind(&input.focus_source)
    .bind(&input.created_at)
    .bind(&input.updated_at)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to create daily plan: {e}"))?;

    Ok(DailyPlan {
        id: input.id,
        plan_date: input.plan_date,
        focus_task_id: input.focus_task_id,
        status: input.status,
        focus_source: input.focus_source,
        created_at: input.created_at,
        updated_at: input.updated_at,
        completed_at: None,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn update_daily_plan_focus(
    pool: State<'_, Pool<Sqlite>>,
    plan_id: String,
    task_id: Option<String>,
    focus_source: String,
    updated_at: String,
) -> Result<DailyPlan, String> {
    sqlx::query(
        "UPDATE daily_plans
         SET focus_task_id = ?, focus_source = ?, updated_at = ?
         WHERE id = ?",
    )
    .bind(&task_id)
    .bind(&focus_source)
    .bind(&updated_at)
    .bind(&plan_id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to update daily plan focus: {e}"))?;

    let row = sqlx::query(
        "SELECT id, plan_date, focus_task_id, status, focus_source, created_at, updated_at, completed_at
         FROM daily_plans
         WHERE id = ?",
    )
    .bind(plan_id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Failed to fetch updated daily plan: {e}"))?;

    Ok(row_to_daily_plan(&row))
}

#[tauri::command]
#[specta::specta]
pub async fn complete_daily_plan(
    pool: State<'_, Pool<Sqlite>>,
    plan_id: String,
    completed_at: String,
    updated_at: String,
) -> Result<DailyPlan, String> {
    sqlx::query(
        "UPDATE daily_plans
         SET status = 'wrapped_up', completed_at = ?, updated_at = ?
         WHERE id = ?",
    )
    .bind(&completed_at)
    .bind(&updated_at)
    .bind(&plan_id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to complete daily plan: {e}"))?;

    let row = sqlx::query(
        "SELECT id, plan_date, focus_task_id, status, focus_source, created_at, updated_at, completed_at
         FROM daily_plans
         WHERE id = ?",
    )
    .bind(plan_id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Failed to fetch completed daily plan: {e}"))?;

    Ok(row_to_daily_plan(&row))
}

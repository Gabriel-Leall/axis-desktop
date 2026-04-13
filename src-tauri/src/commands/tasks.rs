//! Tasks domain commands.
//!
//! All task persistence goes through these commands.
//! SQL stays in Rust — the frontend only receives typed structs.

use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::{Pool, Row, Sqlite};
use tauri::State;

// ─── Structs ──────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Type, Clone)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub priority: String, // "low" | "medium" | "high"
    pub status: String,   // "todo" | "in_progress" | "done"
    pub due_date: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub sort_order: i32,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct CreateTaskInput {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub priority: String,
    pub due_date: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub sort_order: i32,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct UpdateTaskInput {
    pub id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub priority: Option<String>,
    pub status: Option<String>,
    pub due_date: Option<String>,
    pub completed_at: Option<String>,
    pub updated_at: String,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Type, Clone)]
pub struct Subtask {
    pub id: String,
    pub task_id: String,
    pub title: String,
    pub completed: bool,
    pub sort_order: i32,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct CreateSubtaskInput {
    pub id: String,
    pub task_id: String,
    pub title: String,
    pub sort_order: i32,
    pub created_at: String,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn row_to_task(row: &sqlx::sqlite::SqliteRow) -> Task {
    Task {
        id: row.get("id"),
        title: row.get("title"),
        description: row.get("description"),
        priority: row.get("priority"),
        status: row.get("status"),
        due_date: row.get("due_date"),
        completed_at: row.get("completed_at"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        sort_order: row.get("sort_order"),
    }
}

fn row_to_subtask(row: &sqlx::sqlite::SqliteRow) -> Subtask {
    let completed: i64 = row.get("completed");
    Subtask {
        id: row.get("id"),
        task_id: row.get("task_id"),
        title: row.get("title"),
        completed: completed != 0,
        sort_order: row.get("sort_order"),
        created_at: row.get("created_at"),
    }
}

// ─── Commands ─────────────────────────────────────────────────────────────────

/// Returns all tasks ordered by sort_order.
#[tauri::command]
#[specta::specta]
pub async fn get_tasks(pool: State<'_, Pool<Sqlite>>) -> Result<Vec<Task>, String> {
    let rows = sqlx::query(
        "SELECT id, title, description, priority, status, due_date, completed_at,
                created_at, updated_at, sort_order
         FROM tasks
         ORDER BY sort_order ASC, created_at DESC",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Failed to query tasks: {e}"))?;

    Ok(rows.iter().map(row_to_task).collect())
}

/// Returns all subtasks for a given task.
#[tauri::command]
#[specta::specta]
pub async fn get_subtasks(
    pool: State<'_, Pool<Sqlite>>,
    task_id: String,
) -> Result<Vec<Subtask>, String> {
    let rows = sqlx::query(
        "SELECT id, task_id, title, completed, sort_order, created_at
         FROM subtasks
         WHERE task_id = ?
         ORDER BY sort_order ASC, created_at ASC",
    )
    .bind(task_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Failed to query subtasks: {e}"))?;

    Ok(rows.iter().map(row_to_subtask).collect())
}

/// Returns today's pending tasks (due today or no due date, status != done).
#[tauri::command]
#[specta::specta]
pub async fn get_tasks_today(
    pool: State<'_, Pool<Sqlite>>,
    today: String,
) -> Result<Vec<Task>, String> {
    let rows = sqlx::query(
        "SELECT id, title, description, priority, status, due_date, completed_at,
                created_at, updated_at, sort_order
         FROM tasks
         WHERE status != 'done' AND (due_date = ? OR due_date IS NULL)
         ORDER BY sort_order ASC, created_at DESC",
    )
    .bind(today)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Failed to query tasks: {e}"))?;

    Ok(rows.iter().map(row_to_task).collect())
}

/// Creates a new task and returns it.
#[tauri::command]
#[specta::specta]
pub async fn create_task(
    pool: State<'_, Pool<Sqlite>>,
    input: CreateTaskInput,
) -> Result<Task, String> {
    sqlx::query(
        "INSERT INTO tasks
         (id, title, description, priority, status, due_date, completed_at, created_at, updated_at, sort_order)
         VALUES (?, ?, ?, ?, 'todo', ?, NULL, ?, ?, ?)",
    )
    .bind(&input.id)
    .bind(&input.title)
    .bind(&input.description)
    .bind(&input.priority)
    .bind(&input.due_date)
    .bind(&input.created_at)
    .bind(&input.updated_at)
    .bind(input.sort_order)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to create task: {e}"))?;

    log::debug!("Task created: {}", input.id);

    Ok(Task {
        id: input.id,
        title: input.title,
        description: input.description,
        priority: input.priority,
        status: "todo".to_string(),
        due_date: input.due_date,
        completed_at: None,
        created_at: input.created_at,
        updated_at: input.updated_at,
        sort_order: input.sort_order,
    })
}

/// Updates an existing task. Returns the updated task.
#[tauri::command]
#[specta::specta]
pub async fn update_task(
    pool: State<'_, Pool<Sqlite>>,
    input: UpdateTaskInput,
) -> Result<Task, String> {
    sqlx::query(
        "UPDATE tasks SET
         title       = COALESCE(?, title),
         description = ?,
         priority    = COALESCE(?, priority),
         status      = COALESCE(?, status),
         due_date    = ?,
         completed_at = ?,
         updated_at  = ?,
         sort_order  = COALESCE(?, sort_order)
         WHERE id = ?",
    )
    .bind(&input.title)
    .bind(&input.description)
    .bind(&input.priority)
    .bind(&input.status)
    .bind(&input.due_date)
    .bind(&input.completed_at)
    .bind(&input.updated_at)
    .bind(input.sort_order)
    .bind(&input.id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to update task: {e}"))?;

    let row = sqlx::query(
        "SELECT id, title, description, priority, status, due_date, completed_at,
                created_at, updated_at, sort_order
         FROM tasks WHERE id = ?",
    )
    .bind(&input.id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Task not found after update: {e}"))?;

    Ok(row_to_task(&row))
}

/// Deletes a task (subtasks cascade via FK).
#[tauri::command]
#[specta::specta]
pub async fn delete_task(pool: State<'_, Pool<Sqlite>>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM tasks WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to delete task: {e}"))?;

    log::debug!("Task deleted: {id}");
    Ok(())
}

/// Toggles a task between done and todo. Returns the updated task.
#[tauri::command]
#[specta::specta]
pub async fn toggle_task_complete(
    pool: State<'_, Pool<Sqlite>>,
    id: String,
    completed_at: Option<String>,
    updated_at: String,
) -> Result<Task, String> {
    let new_status = if completed_at.is_some() {
        "done"
    } else {
        "todo"
    };

    sqlx::query("UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?")
        .bind(new_status)
        .bind(&completed_at)
        .bind(&updated_at)
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to toggle task: {e}"))?;

    let row = sqlx::query(
        "SELECT id, title, description, priority, status, due_date, completed_at,
                created_at, updated_at, sort_order
         FROM tasks WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Task not found after toggle: {e}"))?;

    Ok(row_to_task(&row))
}

// ─── Subtask commands ─────────────────────────────────────────────────────────

/// Creates a subtask.
#[tauri::command]
#[specta::specta]
pub async fn create_subtask(
    pool: State<'_, Pool<Sqlite>>,
    input: CreateSubtaskInput,
) -> Result<Subtask, String> {
    sqlx::query(
        "INSERT INTO subtasks (id, task_id, title, completed, sort_order, created_at)
         VALUES (?, ?, ?, 0, ?, ?)",
    )
    .bind(&input.id)
    .bind(&input.task_id)
    .bind(&input.title)
    .bind(input.sort_order)
    .bind(&input.created_at)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to create subtask: {e}"))?;

    Ok(Subtask {
        id: input.id,
        task_id: input.task_id,
        title: input.title,
        completed: false,
        sort_order: input.sort_order,
        created_at: input.created_at,
    })
}

/// Toggles a subtask's completed status.
#[tauri::command]
#[specta::specta]
pub async fn toggle_subtask(
    pool: State<'_, Pool<Sqlite>>,
    id: String,
    completed: bool,
) -> Result<(), String> {
    let completed_int: i64 = if completed { 1 } else { 0 };
    sqlx::query("UPDATE subtasks SET completed = ? WHERE id = ?")
        .bind(completed_int)
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to toggle subtask: {e}"))?;

    Ok(())
}

/// Deletes a subtask.
#[tauri::command]
#[specta::specta]
pub async fn delete_subtask(pool: State<'_, Pool<Sqlite>>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM subtasks WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to delete subtask: {e}"))?;

    Ok(())
}

//! Kanban domain commands.
//!
//! Board/column/card/subtask persistence for the local SQLite database.

use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::{Pool, Row, Sqlite};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Type, Clone)]
pub struct KanbanBoard {
    pub id: String,
    pub name: String,
    pub is_active: bool,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Type, Clone)]
pub struct KanbanColumn {
    pub id: String,
    pub board_id: String,
    pub name: String,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Type, Clone)]
pub struct KanbanCard {
    pub id: String,
    pub column_id: String,
    pub title: String,
    pub description: Option<String>,
    pub priority: String,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Type, Clone)]
pub struct KanbanSubtask {
    pub id: String,
    pub card_id: String,
    pub title: String,
    pub completed: bool,
    pub sort_order: i32,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct FullBoard {
    pub board: KanbanBoard,
    pub columns: Vec<KanbanColumnWithCards>,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct KanbanColumnWithCards {
    pub column: KanbanColumn,
    pub cards: Vec<KanbanCard>,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct CardOrderUpdate {
    pub id: String,
    pub column_id: String,
    pub sort_order: i32,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct ColumnOrderUpdate {
    pub id: String,
    pub sort_order: i32,
    pub updated_at: String,
}

fn row_to_board(row: &sqlx::sqlite::SqliteRow) -> KanbanBoard {
    let is_active: i64 = row.get("is_active");
    KanbanBoard {
        id: row.get("id"),
        name: row.get("name"),
        is_active: is_active != 0,
        sort_order: row.get("sort_order"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

fn row_to_column(row: &sqlx::sqlite::SqliteRow) -> KanbanColumn {
    KanbanColumn {
        id: row.get("id"),
        board_id: row.get("board_id"),
        name: row.get("name"),
        sort_order: row.get("sort_order"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

fn row_to_card(row: &sqlx::sqlite::SqliteRow) -> KanbanCard {
    KanbanCard {
        id: row.get("id"),
        column_id: row.get("column_id"),
        title: row.get("title"),
        description: row.get("description"),
        priority: row.get("priority"),
        sort_order: row.get("sort_order"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

fn row_to_subtask(row: &sqlx::sqlite::SqliteRow) -> KanbanSubtask {
    let completed: i64 = row.get("completed");
    KanbanSubtask {
        id: row.get("id"),
        card_id: row.get("card_id"),
        title: row.get("title"),
        completed: completed != 0,
        sort_order: row.get("sort_order"),
        created_at: row.get("created_at"),
    }
}

#[tauri::command]
#[specta::specta]
pub async fn get_boards(pool: State<'_, Pool<Sqlite>>) -> Result<Vec<KanbanBoard>, String> {
    let rows = sqlx::query(
        "SELECT id, name, is_active, sort_order, created_at, updated_at
         FROM kanban_boards
         ORDER BY is_active DESC, sort_order ASC, created_at ASC",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Failed to query kanban boards: {e}"))?;

    Ok(rows.iter().map(row_to_board).collect())
}

#[tauri::command]
#[specta::specta]
pub async fn create_board(
    pool: State<'_, Pool<Sqlite>>,
    id: String,
    name: String,
    created_at: String,
    updated_at: String,
) -> Result<KanbanBoard, String> {
    let next_sort_order: i32 = sqlx::query_scalar("SELECT COALESCE(MAX(sort_order), -1000) + 1000 FROM kanban_boards")
        .fetch_one(pool.inner())
        .await
        .map_err(|e| format!("Failed to calculate board sort order: {e}"))?;

    sqlx::query(
        "INSERT INTO kanban_boards (id, name, is_active, sort_order, created_at, updated_at)
         VALUES (?, ?, 0, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&name)
    .bind(next_sort_order)
    .bind(&created_at)
    .bind(&updated_at)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to create kanban board: {e}"))?;

    Ok(KanbanBoard {
        id,
        name,
        is_active: false,
        sort_order: next_sort_order,
        created_at,
        updated_at,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn update_board(
    pool: State<'_, Pool<Sqlite>>,
    id: String,
    name: String,
    updated_at: String,
) -> Result<KanbanBoard, String> {
    sqlx::query("UPDATE kanban_boards SET name = ?, updated_at = ? WHERE id = ?")
        .bind(&name)
        .bind(&updated_at)
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to update kanban board: {e}"))?;

    let row = sqlx::query(
        "SELECT id, name, is_active, sort_order, created_at, updated_at
         FROM kanban_boards WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Kanban board not found after update: {e}"))?;

    Ok(row_to_board(&row))
}

#[tauri::command]
#[specta::specta]
pub async fn set_active_board(
    pool: State<'_, Pool<Sqlite>>,
    id: String,
    updated_at: String,
) -> Result<(), String> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| format!("Failed to start transaction: {e}"))?;

    sqlx::query("UPDATE kanban_boards SET is_active = 0, updated_at = ?")
        .bind(&updated_at)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to clear active kanban board: {e}"))?;

    sqlx::query("UPDATE kanban_boards SET is_active = 1, updated_at = ? WHERE id = ?")
        .bind(&updated_at)
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to set active kanban board: {e}"))?;

    tx.commit()
        .await
        .map_err(|e| format!("Failed to commit transaction: {e}"))?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_board(pool: State<'_, Pool<Sqlite>>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM kanban_boards WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to delete kanban board: {e}"))?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn get_full_board(
    pool: State<'_, Pool<Sqlite>>,
    board_id: String,
) -> Result<FullBoard, String> {
    let board_row = sqlx::query(
        "SELECT id, name, is_active, sort_order, created_at, updated_at
         FROM kanban_boards WHERE id = ?",
    )
    .bind(&board_id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Failed to load kanban board: {e}"))?;

    let board = row_to_board(&board_row);

    let column_rows = sqlx::query(
        "SELECT id, board_id, name, sort_order, created_at, updated_at
         FROM kanban_columns
         WHERE board_id = ?
         ORDER BY sort_order ASC, created_at ASC",
    )
    .bind(&board_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Failed to load kanban columns: {e}"))?;

    let columns: Vec<KanbanColumn> = column_rows.iter().map(row_to_column).collect();

    let card_rows = sqlx::query(
        "SELECT c.id, c.column_id, c.title, c.description, c.priority, c.sort_order, c.created_at, c.updated_at
         FROM kanban_cards c
         INNER JOIN kanban_columns col ON col.id = c.column_id
         WHERE col.board_id = ?
         ORDER BY c.sort_order ASC, c.created_at ASC",
    )
    .bind(&board_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Failed to load kanban cards: {e}"))?;

    let cards: Vec<KanbanCard> = card_rows.iter().map(row_to_card).collect();

    let columns_with_cards = columns
        .into_iter()
        .map(|column| {
            let column_cards = cards
                .iter()
                .filter(|card| card.column_id == column.id)
                .cloned()
                .collect();

            KanbanColumnWithCards {
                column,
                cards: column_cards,
            }
        })
        .collect();

    Ok(FullBoard {
        board,
        columns: columns_with_cards,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn create_column(
    pool: State<'_, Pool<Sqlite>>,
    id: String,
    board_id: String,
    name: String,
    sort_order: i32,
    created_at: String,
    updated_at: String,
) -> Result<KanbanColumn, String> {
    sqlx::query(
        "INSERT INTO kanban_columns (id, board_id, name, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&board_id)
    .bind(&name)
    .bind(sort_order)
    .bind(&created_at)
    .bind(&updated_at)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to create kanban column: {e}"))?;

    Ok(KanbanColumn {
        id,
        board_id,
        name,
        sort_order,
        created_at,
        updated_at,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn update_column(
    pool: State<'_, Pool<Sqlite>>,
    id: String,
    name: String,
    sort_order: i32,
    updated_at: String,
) -> Result<KanbanColumn, String> {
    sqlx::query(
        "UPDATE kanban_columns
         SET name = ?, sort_order = ?, updated_at = ?
         WHERE id = ?",
    )
    .bind(&name)
    .bind(sort_order)
    .bind(&updated_at)
    .bind(&id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to update kanban column: {e}"))?;

    let row = sqlx::query(
        "SELECT id, board_id, name, sort_order, created_at, updated_at
         FROM kanban_columns WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Kanban column not found after update: {e}"))?;

    Ok(row_to_column(&row))
}

#[tauri::command]
#[specta::specta]
pub async fn delete_column(pool: State<'_, Pool<Sqlite>>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM kanban_columns WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to delete kanban column: {e}"))?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn create_card(
    pool: State<'_, Pool<Sqlite>>,
    id: String,
    column_id: String,
    title: String,
    priority: String,
    sort_order: i32,
    created_at: String,
    updated_at: String,
) -> Result<KanbanCard, String> {
    sqlx::query(
        "INSERT INTO kanban_cards
         (id, column_id, title, description, priority, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, NULL, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&column_id)
    .bind(&title)
    .bind(&priority)
    .bind(sort_order)
    .bind(&created_at)
    .bind(&updated_at)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to create kanban card: {e}"))?;

    Ok(KanbanCard {
        id,
        column_id,
        title,
        description: None,
        priority,
        sort_order,
        created_at,
        updated_at,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn update_card(
    pool: State<'_, Pool<Sqlite>>,
    id: String,
    title: String,
    description: Option<String>,
    priority: String,
    sort_order: i32,
    column_id: String,
    updated_at: String,
) -> Result<KanbanCard, String> {
    sqlx::query(
        "UPDATE kanban_cards
         SET title = ?, description = ?, priority = ?, sort_order = ?, column_id = ?, updated_at = ?
         WHERE id = ?",
    )
    .bind(&title)
    .bind(&description)
    .bind(&priority)
    .bind(sort_order)
    .bind(&column_id)
    .bind(&updated_at)
    .bind(&id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to update kanban card: {e}"))?;

    let row = sqlx::query(
        "SELECT id, column_id, title, description, priority, sort_order, created_at, updated_at
         FROM kanban_cards WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Kanban card not found after update: {e}"))?;

    Ok(row_to_card(&row))
}

#[tauri::command]
#[specta::specta]
pub async fn delete_card(pool: State<'_, Pool<Sqlite>>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM kanban_cards WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to delete kanban card: {e}"))?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn reorder_cards(
    pool: State<'_, Pool<Sqlite>>,
    updates: Vec<CardOrderUpdate>,
) -> Result<(), String> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| format!("Failed to start transaction: {e}"))?;

    for update in updates {
        sqlx::query(
            "UPDATE kanban_cards
             SET column_id = ?, sort_order = ?, updated_at = ?
             WHERE id = ?",
        )
        .bind(&update.column_id)
        .bind(update.sort_order)
        .bind(&update.updated_at)
        .bind(&update.id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to reorder kanban cards: {e}"))?;
    }

    tx.commit()
        .await
        .map_err(|e| format!("Failed to commit transaction: {e}"))?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn reorder_columns(
    pool: State<'_, Pool<Sqlite>>,
    updates: Vec<ColumnOrderUpdate>,
) -> Result<(), String> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| format!("Failed to start transaction: {e}"))?;

    for update in updates {
        sqlx::query(
            "UPDATE kanban_columns
             SET sort_order = ?, updated_at = ?
             WHERE id = ?",
        )
        .bind(update.sort_order)
        .bind(&update.updated_at)
        .bind(&update.id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to reorder kanban columns: {e}"))?;
    }

    tx.commit()
        .await
        .map_err(|e| format!("Failed to commit transaction: {e}"))?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn get_kanban_card_subtasks(
    pool: State<'_, Pool<Sqlite>>,
    card_id: String,
) -> Result<Vec<KanbanSubtask>, String> {
    let rows = sqlx::query(
        "SELECT id, card_id, title, completed, sort_order, created_at
         FROM kanban_subtasks
         WHERE card_id = ?
         ORDER BY sort_order ASC, created_at ASC",
    )
    .bind(&card_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Failed to query kanban subtasks: {e}"))?;

    Ok(rows.iter().map(row_to_subtask).collect())
}

#[tauri::command]
#[specta::specta]
pub async fn toggle_kanban_subtask(
    pool: State<'_, Pool<Sqlite>>,
    id: String,
    _updated_at: String,
) -> Result<bool, String> {
    sqlx::query(
        "UPDATE kanban_subtasks
         SET completed = CASE WHEN completed = 1 THEN 0 ELSE 1 END
         WHERE id = ?",
    )
    .bind(&id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to toggle kanban subtask: {e}"))?;

    let row = sqlx::query("SELECT completed FROM kanban_subtasks WHERE id = ?")
        .bind(&id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| format!("Kanban subtask not found after toggle: {e}"))?;

    let completed: i64 = row.get("completed");
    Ok(completed != 0)
}

#[tauri::command]
#[specta::specta]
pub async fn create_kanban_subtask(
    pool: State<'_, Pool<Sqlite>>,
    id: String,
    card_id: String,
    title: String,
    sort_order: i32,
    created_at: String,
) -> Result<KanbanSubtask, String> {
    sqlx::query(
        "INSERT INTO kanban_subtasks (id, card_id, title, completed, sort_order, created_at)
         VALUES (?, ?, ?, 0, ?, ?)",
    )
    .bind(&id)
    .bind(&card_id)
    .bind(&title)
    .bind(sort_order)
    .bind(&created_at)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to create kanban subtask: {e}"))?;

    Ok(KanbanSubtask {
        id,
        card_id,
        title,
        completed: false,
        sort_order,
        created_at,
    })
}

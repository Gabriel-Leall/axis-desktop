//! Notes domain commands.
//!
//! CRUD + search for the brain dump / notes feature.
//! SQL stays in Rust — the frontend only receives typed structs.

use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::{Pool, Row, Sqlite};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Type, Clone)]
pub struct Note {
    pub id: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
    pub word_count: i32,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct CreateNoteInput {
    pub id: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
    pub word_count: i32,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct UpdateNoteInput {
    pub id: String,
    pub content: String,
    pub updated_at: String,
    pub word_count: i32,
}

fn row_to_note(row: &sqlx::sqlite::SqliteRow) -> Note {
    Note {
        id: row.get("id"),
        content: row.get("content"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        word_count: row.get("word_count"),
    }
}

#[tauri::command]
#[specta::specta]
pub async fn get_notes(pool: State<'_, Pool<Sqlite>>) -> Result<Vec<Note>, String> {
    let rows = sqlx::query(
        "SELECT id, content, created_at, updated_at, word_count
         FROM notes
         ORDER BY updated_at DESC",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Failed to query notes: {e}"))?;

    Ok(rows.iter().map(row_to_note).collect())
}

#[tauri::command]
#[specta::specta]
pub async fn get_note(pool: State<'_, Pool<Sqlite>>, id: String) -> Result<Note, String> {
    let row = sqlx::query(
        "SELECT id, content, created_at, updated_at, word_count
         FROM notes WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Note not found: {e}"))?;

    Ok(row_to_note(&row))
}

#[tauri::command]
#[specta::specta]
pub async fn create_note(
    pool: State<'_, Pool<Sqlite>>,
    input: CreateNoteInput,
) -> Result<Note, String> {
    sqlx::query(
        "INSERT INTO notes (id, content, created_at, updated_at, word_count)
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&input.id)
    .bind(&input.content)
    .bind(&input.created_at)
    .bind(&input.updated_at)
    .bind(input.word_count)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to create note: {e}"))?;

    log::debug!("Note created: {}", input.id);

    Ok(Note {
        id: input.id,
        content: input.content,
        created_at: input.created_at,
        updated_at: input.updated_at,
        word_count: input.word_count,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn update_note(
    pool: State<'_, Pool<Sqlite>>,
    input: UpdateNoteInput,
) -> Result<Note, String> {
    let result =
        sqlx::query("UPDATE notes SET content = ?, updated_at = ?, word_count = ? WHERE id = ?")
            .bind(&input.content)
            .bind(&input.updated_at)
            .bind(input.word_count)
            .bind(&input.id)
            .execute(pool.inner())
            .await
            .map_err(|e| format!("Failed to update note: {e}"))?;

    if result.rows_affected() == 0 {
        return Err("Note not found".to_string());
    }

    let row = sqlx::query(
        "SELECT id, content, created_at, updated_at, word_count
         FROM notes WHERE id = ?",
    )
    .bind(&input.id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Note not found after update: {e}"))?;

    Ok(row_to_note(&row))
}

#[tauri::command]
#[specta::specta]
pub async fn delete_note(pool: State<'_, Pool<Sqlite>>, id: String) -> Result<(), String> {
    let result = sqlx::query("DELETE FROM notes WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to delete note: {e}"))?;

    if result.rows_affected() == 0 {
        return Err("Note not found".to_string());
    }

    log::debug!("Note deleted: {id}");
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn search_notes(
    pool: State<'_, Pool<Sqlite>>,
    query: String,
) -> Result<Vec<Note>, String> {
    let pattern = format!("%{query}%");
    let rows = sqlx::query(
        "SELECT id, content, created_at, updated_at, word_count
         FROM notes
         WHERE content LIKE ?
         ORDER BY updated_at DESC",
    )
    .bind(&pattern)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Failed to search notes: {e}"))?;

    Ok(rows.iter().map(row_to_note).collect())
}

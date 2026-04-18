use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use tauri::{command, State};

#[derive(Debug, Serialize, Deserialize, specta::Type)]
pub struct FocusTimeByDay {
    pub day: String,
    pub total_seconds: i32,
}

#[derive(Debug, Serialize, Deserialize, specta::Type)]
pub struct TaskCountByDay {
    pub day: String,
    pub created: i32,
    pub completed: i32,
}

#[derive(Debug, Serialize, Deserialize, specta::Type)]
pub struct PomodoroSummary {
    pub session_type: String, // "focus" | "short_break" | "long_break"
    pub sessions: i32,
    pub total_seconds: i32,
}

#[derive(Debug, Serialize, Deserialize, specta::Type)]
pub struct AnalyticsSummary {
    pub total_focus_seconds: i32,
    pub total_focus_seconds_prev: i32,
    pub tasks_created: i32,
    pub tasks_completed: i32,
    pub pomodoros_completed: i32,
    pub days_active: i32,
    pub top_productivity_day: Option<String>,
    pub best_habit_name: Option<String>,
    pub best_habit_streak: i32,
}

/// Fetches the summary numbers for the top dashboard cards.
#[command]
#[specta::specta]
pub async fn get_analytics_summary(
    pool: State<'_, SqlitePool>,
    start: String,
    end: String,
    prev_start: String,
    prev_end: String,
) -> Result<AnalyticsSummary, String> {
    let focus_curr = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COALESCE(SUM(duration_seconds), 0)
        FROM pomodoro_sessions
        WHERE session_type = 'focus'
          AND completed = 1
          AND started_at >= ?
          AND started_at < ?
        "#,
    )
    .bind(&start)
    .bind(&end)
    .fetch_one(&*pool)
    .await
    .unwrap_or(0) as i32;

    let focus_prev = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COALESCE(SUM(duration_seconds), 0)
        FROM pomodoro_sessions
        WHERE session_type = 'focus'
          AND completed = 1
          AND started_at >= ?
          AND started_at < ?
        "#,
    )
    .bind(&prev_start)
    .bind(&prev_end)
    .fetch_one(&*pool)
    .await
    .unwrap_or(0) as i32;

    let tasks_created = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)
        FROM tasks
        WHERE created_at >= ?
          AND created_at < ?
        "#,
    )
    .bind(&start)
    .bind(&end)
    .fetch_one(&*pool)
    .await
    .unwrap_or(0) as i32;

    let tasks_completed = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)
        FROM tasks
        WHERE completed_at IS NOT NULL
          AND completed_at >= ?
          AND completed_at < ?
        "#,
    )
    .bind(&start)
    .bind(&end)
    .fetch_one(&*pool)
    .await
    .unwrap_or(0) as i32;

    let pomodoros_completed = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)
        FROM pomodoro_sessions
        WHERE session_type = 'focus'
          AND completed = 1
          AND started_at >= ?
          AND started_at < ?
        "#,
    )
    .bind(&start)
    .bind(&end)
    .fetch_one(&*pool)
    .await
    .unwrap_or(0) as i32;

    let days_active = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(DISTINCT DATE(started_at))
        FROM pomodoro_sessions
        WHERE started_at >= ? AND started_at < ?
        "#,
    )
    .bind(&start)
    .bind(&end)
    .fetch_one(&*pool)
    .await
    .unwrap_or(0) as i32;

    let top_productivity_day = sqlx::query_scalar::<_, String>(
        r#"
        SELECT DATE(started_at) as day
        FROM pomodoro_sessions
        WHERE session_type = 'focus'
          AND completed = 1
          AND started_at >= ?
          AND started_at < ?
        GROUP BY day
        ORDER BY SUM(duration_seconds) DESC
        LIMIT 1
        "#,
    )
    .bind(&start)
    .bind(&end)
    .fetch_one(&*pool)
    .await
    .ok();

    // Calculate best habit streak (current)
    let best_streak: Option<(String, i32)> = sqlx::query(
        r#"
        WITH Dates AS (
            SELECT
                habit_id,
                completed_date
            FROM habit_logs
            GROUP BY habit_id, completed_date
        ),
        Grouper AS (
            SELECT
                habit_id,
                completed_date,
                julianday(completed_date) - row_number() OVER (PARTITION BY habit_id ORDER BY completed_date) as grp
            FROM Dates
        ),
        StreakCalc AS (
            SELECT
                habit_id,
                COUNT(*) as streak,
                MAX(completed_date) as last_date
            FROM Grouper
            GROUP BY habit_id, grp
        )
        SELECT h.name, s.streak
        FROM StreakCalc s
        JOIN habits h ON s.habit_id = h.id
        WHERE h.active = 1 AND s.last_date >= date('now', 'localtime', '-1 day')
        ORDER BY s.streak DESC
        LIMIT 1
        "#,
    )
    .fetch_optional(&*pool)
    .await
    .ok()
    .flatten()
    .map(|row| (row.get("name"), row.get("streak")));

    let (best_habit_name, best_habit_streak) = best_streak.unzip();

    Ok(AnalyticsSummary {
        total_focus_seconds: focus_curr,
        total_focus_seconds_prev: focus_prev,
        tasks_created,
        tasks_completed,
        pomodoros_completed,
        days_active,
        top_productivity_day,
        best_habit_name,
        best_habit_streak: best_habit_streak.unwrap_or(0),
    })
}

#[command]
#[specta::specta]
pub async fn get_focus_time_by_day(
    pool: State<'_, SqlitePool>,
    start: String,
    end: String,
) -> Result<Vec<FocusTimeByDay>, String> {
    let rows = sqlx::query(
        r#"
        SELECT
          DATE(started_at) as day,
          SUM(duration_seconds) as total_seconds
        FROM pomodoro_sessions
        WHERE session_type = 'focus'
          AND completed = 1
          AND started_at >= ?
          AND started_at < ?
        GROUP BY DATE(started_at)
        ORDER BY day
        "#,
    )
    .bind(&start)
    .bind(&end)
    .fetch_all(&*pool)
    .await
    .map_err(|e| format!("Failed to fetch focus time: {e}"))?;

    let result = rows
        .into_iter()
        .map(|row| FocusTimeByDay {
            day: row.get("day"),
            total_seconds: row.get::<i64, _>("total_seconds") as i32,
        })
        .collect();

    Ok(result)
}

#[command]
#[specta::specta]
pub async fn get_task_counts_by_day(
    pool: State<'_, SqlitePool>,
    start: String,
    end: String,
) -> Result<Vec<TaskCountByDay>, String> {
    // We do separate queries for created and completed, and then merge in Rust 
    // to handle full outer join simply.
    let created_rows = sqlx::query(
        r#"
        SELECT DATE(created_at) as day, COUNT(*) as count
        FROM tasks
        WHERE created_at >= ? AND created_at < ?
        GROUP BY DATE(created_at)
        "#,
    )
    .bind(&start)
    .bind(&end)
    .fetch_all(&*pool)
    .await
    .map_err(|e| format!("Failed to fetch created tasks: {e}"))?;

    let completed_rows = sqlx::query(
        r#"
        SELECT DATE(completed_at) as day, COUNT(*) as count
        FROM tasks
        WHERE completed_at IS NOT NULL
          AND completed_at >= ? AND completed_at < ?
        GROUP BY DATE(completed_at)
        "#,
    )
    .bind(&start)
    .bind(&end)
    .fetch_all(&*pool)
    .await
    .map_err(|e| format!("Failed to fetch completed tasks: {e}"))?;

    use std::collections::BTreeMap;
    let mut day_map: BTreeMap<String, TaskCountByDay> = BTreeMap::new();

    for row in created_rows {
        let day: String = row.get("day");
        let created: i64 = row.get("count");
        day_map.entry(day.clone()).or_insert(TaskCountByDay {
            day,
            created: 0,
            completed: 0,
        }).created = created as i32;
    }

    for row in completed_rows {
        let day: String = row.get("day");
        let completed: i64 = row.get("count");
        day_map.entry(day.clone()).or_insert(TaskCountByDay {
            day,
            created: 0,
            completed: 0,
        }).completed = completed as i32;
    }

    Ok(day_map.into_values().collect())
}

#[command]
#[specta::specta]
pub async fn get_pomodoro_summary(
    pool: State<'_, SqlitePool>,
    start: String,
    end: String,
) -> Result<Vec<PomodoroSummary>, String> {
    let rows = sqlx::query(
        r#"
        SELECT
          session_type,
          COUNT(*) as sessions,
          SUM(duration_seconds) as total_seconds
        FROM pomodoro_sessions
        WHERE completed = 1
          AND started_at >= ?
          AND started_at < ?
        GROUP BY session_type
        "#,
    )
    .bind(&start)
    .bind(&end)
    .fetch_all(&*pool)
    .await
    .map_err(|e| format!("Failed to fetch pomodoro summary: {e}"))?;

    let result = rows
        .into_iter()
        .map(|row| PomodoroSummary {
            session_type: row.get("session_type"),
            sessions: row.get::<i64, _>("sessions") as i32,
            total_seconds: row.get::<i64, _>("total_seconds") as i32,
        })
        .collect();

    Ok(result)
}

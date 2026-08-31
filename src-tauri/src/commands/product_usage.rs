//! Privacy-safe, local-only product usage measurement.
//!
//! This domain stores milestones and daily counters only. It must never accept
//! task content, note content, URLs, file paths, or external user identifiers.

use chrono::{DateTime, Duration, Local, NaiveDate, SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::{Pool, Row, Sqlite};
use tauri::State;

pub const PRODUCT_USAGE_MIGRATION_SQL: &str = "
    CREATE TABLE IF NOT EXISTS product_usage_milestones (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        measurement_started_at TEXT,
        first_focus_started_at TEXT,
        first_capture_saved_at TEXT,
        onboarding_completed_at TEXT,
        activated_at TEXT,
        activated_local_date TEXT
    );
    INSERT OR IGNORE INTO product_usage_milestones (id) VALUES (1);
    CREATE TABLE IF NOT EXISTS product_usage_daily (
        local_date TEXT PRIMARY KEY,
        app_open_count INTEGER NOT NULL DEFAULT 0,
        focus_started_count INTEGER NOT NULL DEFAULT 0,
        capture_saved_count INTEGER NOT NULL DEFAULT 0,
        daily_focus_set_count INTEGER NOT NULL DEFAULT 0,
        wrap_up_completed_count INTEGER NOT NULL DEFAULT 0,
        onboarding_completed_count INTEGER NOT NULL DEFAULT 0
    );
";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum ProductUsageEvent {
    AppOpened,
    FocusStarted,
    CaptureSaved,
    DailyFocusSet,
    WrapUpCompleted,
    OnboardingCompleted,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ProductUsageMilestones {
    pub measurement_started_at: Option<String>,
    pub first_focus_started_at: Option<String>,
    pub first_capture_saved_at: Option<String>,
    pub onboarding_completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ProductUsageDay {
    pub local_date: String,
    pub app_open_count: i32,
    pub focus_started_count: i32,
    pub capture_saved_count: i32,
    pub daily_focus_set_count: i32,
    pub wrap_up_completed_count: i32,
    pub onboarding_completed_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ProductActivationMetrics {
    pub activated: bool,
    pub activated_at: Option<String>,
    pub time_to_value_seconds: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ProductRetentionMetrics {
    pub d1_returned: Option<bool>,
    pub active_days_first_week: i32,
    pub first_week_retained: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ProductUsageDefinition {
    pub activation: String,
    pub first_week_retention: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ProductUsageSnapshot {
    pub schema_version: u32,
    pub generated_at: String,
    pub local_only: bool,
    pub definition: ProductUsageDefinition,
    pub milestones: ProductUsageMilestones,
    pub activation: ProductActivationMetrics,
    pub retention: ProductRetentionMetrics,
    pub daily_usage: Vec<ProductUsageDay>,
}

pub async fn create_product_usage_schema(pool: &Pool<Sqlite>) -> Result<(), String> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS product_usage_milestones (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            measurement_started_at TEXT,
            first_focus_started_at TEXT,
            first_capture_saved_at TEXT,
            onboarding_completed_at TEXT,
            activated_at TEXT,
            activated_local_date TEXT
        )",
    )
    .execute(pool)
    .await
    .map_err(|error| format!("Failed to create product usage milestones: {error}"))?;

    sqlx::query("INSERT OR IGNORE INTO product_usage_milestones (id) VALUES (1)")
        .execute(pool)
        .await
        .map_err(|error| format!("Failed to initialize product usage milestones: {error}"))?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS product_usage_daily (
            local_date TEXT PRIMARY KEY,
            app_open_count INTEGER NOT NULL DEFAULT 0,
            focus_started_count INTEGER NOT NULL DEFAULT 0,
            capture_saved_count INTEGER NOT NULL DEFAULT 0,
            daily_focus_set_count INTEGER NOT NULL DEFAULT 0,
            wrap_up_completed_count INTEGER NOT NULL DEFAULT 0,
            onboarding_completed_count INTEGER NOT NULL DEFAULT 0
        )",
    )
    .execute(pool)
    .await
    .map_err(|error| format!("Failed to create daily product usage: {error}"))?;

    Ok(())
}

fn validate_usage_time(occurred_at: &str, local_date: &str) -> Result<(), String> {
    DateTime::parse_from_rfc3339(occurred_at)
        .map_err(|_| "occurred_at must be a valid RFC 3339 timestamp".to_string())?;
    NaiveDate::parse_from_str(local_date, "%Y-%m-%d")
        .map_err(|_| "local_date must use YYYY-MM-DD".to_string())?;
    Ok(())
}

fn daily_increment_sql(event: ProductUsageEvent) -> &'static str {
    match event {
        ProductUsageEvent::AppOpened => {
            "UPDATE product_usage_daily SET app_open_count = app_open_count + 1 WHERE local_date = ?"
        }
        ProductUsageEvent::FocusStarted => {
            "UPDATE product_usage_daily SET focus_started_count = focus_started_count + 1 WHERE local_date = ?"
        }
        ProductUsageEvent::CaptureSaved => {
            "UPDATE product_usage_daily SET capture_saved_count = capture_saved_count + 1 WHERE local_date = ?"
        }
        ProductUsageEvent::DailyFocusSet => {
            "UPDATE product_usage_daily SET daily_focus_set_count = daily_focus_set_count + 1 WHERE local_date = ?"
        }
        ProductUsageEvent::WrapUpCompleted => {
            "UPDATE product_usage_daily SET wrap_up_completed_count = wrap_up_completed_count + 1 WHERE local_date = ?"
        }
        ProductUsageEvent::OnboardingCompleted => {
            "UPDATE product_usage_daily SET onboarding_completed_count = onboarding_completed_count + 1 WHERE local_date = ?"
        }
    }
}

pub async fn record_product_usage_event_in_pool(
    pool: &Pool<Sqlite>,
    event: ProductUsageEvent,
    occurred_at: &str,
    local_date: &str,
) -> Result<(), String> {
    validate_usage_time(occurred_at, local_date)?;

    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("Failed to begin product usage transaction: {error}"))?;

    sqlx::query(
        "INSERT OR IGNORE INTO product_usage_daily (
            local_date,
            app_open_count,
            focus_started_count,
            capture_saved_count,
            daily_focus_set_count,
            wrap_up_completed_count,
            onboarding_completed_count
        ) VALUES (?, 0, 0, 0, 0, 0, 0)",
    )
    .bind(local_date)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("Failed to initialize daily product usage: {error}"))?;

    sqlx::query(daily_increment_sql(event))
        .bind(local_date)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("Failed to increment daily product usage: {error}"))?;

    let milestone_sql = match event {
        ProductUsageEvent::AppOpened => Some(
            "UPDATE product_usage_milestones
             SET measurement_started_at = COALESCE(measurement_started_at, ?)
             WHERE id = 1",
        ),
        ProductUsageEvent::FocusStarted => Some(
            "UPDATE product_usage_milestones
             SET first_focus_started_at = COALESCE(first_focus_started_at, ?)
             WHERE id = 1",
        ),
        ProductUsageEvent::CaptureSaved => Some(
            "UPDATE product_usage_milestones
             SET first_capture_saved_at = COALESCE(first_capture_saved_at, ?)
             WHERE id = 1",
        ),
        ProductUsageEvent::OnboardingCompleted => Some(
            "UPDATE product_usage_milestones
             SET onboarding_completed_at = COALESCE(onboarding_completed_at, ?)
             WHERE id = 1",
        ),
        ProductUsageEvent::DailyFocusSet | ProductUsageEvent::WrapUpCompleted => None,
    };

    if let Some(sql) = milestone_sql {
        sqlx::query(sql)
            .bind(occurred_at)
            .execute(&mut *transaction)
            .await
            .map_err(|error| format!("Failed to record product usage milestone: {error}"))?;
    }

    sqlx::query(
        "UPDATE product_usage_milestones
         SET activated_at = ?, activated_local_date = ?
         WHERE id = 1
           AND activated_at IS NULL
           AND first_focus_started_at IS NOT NULL
           AND first_capture_saved_at IS NOT NULL",
    )
    .bind(occurred_at)
    .bind(local_date)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("Failed to calculate activation milestone: {error}"))?;

    transaction
        .commit()
        .await
        .map_err(|error| format!("Failed to commit product usage transaction: {error}"))?;

    Ok(())
}

fn time_to_value_seconds(started_at: Option<&str>, activated_at: Option<&str>) -> Option<i32> {
    let started_at = DateTime::parse_from_rfc3339(started_at?).ok()?;
    let activated_at = DateTime::parse_from_rfc3339(activated_at?).ok()?;
    let seconds = (activated_at - started_at).num_seconds().max(0);
    Some(i32::try_from(seconds).unwrap_or(i32::MAX))
}

fn row_count(row: &sqlx::sqlite::SqliteRow, column: &str) -> i32 {
    let value: i64 = row.get(column);
    i32::try_from(value).unwrap_or(i32::MAX)
}

pub async fn get_product_usage_snapshot_from_pool(
    pool: &Pool<Sqlite>,
    generated_at: &str,
    current_local_date: &str,
) -> Result<ProductUsageSnapshot, String> {
    validate_usage_time(generated_at, current_local_date)?;

    let milestone_row = sqlx::query(
        "SELECT measurement_started_at,
                first_focus_started_at,
                first_capture_saved_at,
                onboarding_completed_at,
                activated_at,
                activated_local_date
         FROM product_usage_milestones
         WHERE id = 1",
    )
    .fetch_one(pool)
    .await
    .map_err(|error| format!("Failed to load product usage milestones: {error}"))?;

    let measurement_started_at: Option<String> = milestone_row.get("measurement_started_at");
    let first_focus_started_at: Option<String> = milestone_row.get("first_focus_started_at");
    let first_capture_saved_at: Option<String> = milestone_row.get("first_capture_saved_at");
    let onboarding_completed_at: Option<String> = milestone_row.get("onboarding_completed_at");
    let activated_at: Option<String> = milestone_row.get("activated_at");
    let activated_local_date: Option<String> = milestone_row.get("activated_local_date");

    let rows = sqlx::query(
        "SELECT local_date,
                app_open_count,
                focus_started_count,
                capture_saved_count,
                daily_focus_set_count,
                wrap_up_completed_count,
                onboarding_completed_count
         FROM product_usage_daily
         ORDER BY local_date ASC",
    )
    .fetch_all(pool)
    .await
    .map_err(|error| format!("Failed to load daily product usage: {error}"))?;

    let daily_usage: Vec<ProductUsageDay> = rows
        .iter()
        .map(|row| ProductUsageDay {
            local_date: row.get("local_date"),
            app_open_count: row_count(row, "app_open_count"),
            focus_started_count: row_count(row, "focus_started_count"),
            capture_saved_count: row_count(row, "capture_saved_count"),
            daily_focus_set_count: row_count(row, "daily_focus_set_count"),
            wrap_up_completed_count: row_count(row, "wrap_up_completed_count"),
            onboarding_completed_count: row_count(row, "onboarding_completed_count"),
        })
        .collect();

    let current_date = NaiveDate::parse_from_str(current_local_date, "%Y-%m-%d")
        .map_err(|_| "current_local_date must use YYYY-MM-DD".to_string())?;

    let (d1_returned, active_days_first_week, first_week_retained) = if let Some(activation_date) =
        activated_local_date
            .as_deref()
            .and_then(|value| NaiveDate::parse_from_str(value, "%Y-%m-%d").ok())
    {
        let day_one = activation_date + Duration::days(1);
        let week_end = activation_date + Duration::days(6);
        let opened_on_day_one = daily_usage.iter().any(|day| {
            day.local_date == day_one.format("%Y-%m-%d").to_string() && day.app_open_count > 0
        });
        let active_days = daily_usage
            .iter()
            .filter(|day| {
                NaiveDate::parse_from_str(&day.local_date, "%Y-%m-%d").is_ok_and(|date| {
                    date >= activation_date && date <= week_end && day.app_open_count > 0
                })
            })
            .count() as i32;

        let d1 = (current_date >= day_one).then_some(opened_on_day_one);
        let week_retained = if active_days >= 3 {
            Some(true)
        } else if current_date > week_end {
            Some(false)
        } else {
            None
        };

        (d1, active_days, week_retained)
    } else {
        (None, 0, None)
    };

    let activation = ProductActivationMetrics {
        activated: activated_at.is_some(),
        time_to_value_seconds: time_to_value_seconds(
            measurement_started_at.as_deref(),
            activated_at.as_deref(),
        ),
        activated_at,
    };

    Ok(ProductUsageSnapshot {
        schema_version: 1,
        generated_at: generated_at.to_string(),
        local_only: true,
        definition: ProductUsageDefinition {
            activation: "first_focus_started_and_first_capture_saved".to_string(),
            first_week_retention: "three_active_days_in_first_seven_days".to_string(),
        },
        milestones: ProductUsageMilestones {
            measurement_started_at,
            first_focus_started_at,
            first_capture_saved_at,
            onboarding_completed_at,
        },
        activation,
        retention: ProductRetentionMetrics {
            d1_returned,
            active_days_first_week,
            first_week_retained,
        },
        daily_usage,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn record_product_usage_event(
    pool: State<'_, Pool<Sqlite>>,
    event: ProductUsageEvent,
    occurred_at: String,
    local_date: String,
) -> Result<(), String> {
    record_product_usage_event_in_pool(pool.inner(), event, &occurred_at, &local_date).await
}

#[tauri::command]
#[specta::specta]
pub async fn get_product_usage_snapshot(
    pool: State<'_, Pool<Sqlite>>,
) -> Result<ProductUsageSnapshot, String> {
    let generated_at = Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true);
    let current_local_date = Local::now().date_naive().format("%Y-%m-%d").to_string();
    get_product_usage_snapshot_from_pool(pool.inner(), &generated_at, &current_local_date).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    fn run_async_test(test: impl std::future::Future<Output = ()>) {
        tauri::async_runtime::block_on(test);
    }

    async fn test_pool() -> sqlx::Pool<sqlx::Sqlite> {
        SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("in-memory product usage database should open")
    }

    #[test]
    fn records_activation_only_after_focus_and_capture() {
        run_async_test(async {
            let pool = test_pool().await;
            create_product_usage_schema(&pool)
                .await
                .expect("schema should be created");

            record_product_usage_event_in_pool(
                &pool,
                ProductUsageEvent::AppOpened,
                "2026-08-06T12:00:00Z",
                "2026-08-06",
            )
            .await
            .expect("app open should be recorded");
            record_product_usage_event_in_pool(
                &pool,
                ProductUsageEvent::FocusStarted,
                "2026-08-06T12:02:00Z",
                "2026-08-06",
            )
            .await
            .expect("focus should be recorded");

            let before_capture =
                get_product_usage_snapshot_from_pool(&pool, "2026-08-06T12:03:00Z", "2026-08-06")
                    .await
                    .expect("snapshot should be calculated");

            assert!(!before_capture.activation.activated);
            assert_eq!(before_capture.activation.time_to_value_seconds, None);

            record_product_usage_event_in_pool(
                &pool,
                ProductUsageEvent::CaptureSaved,
                "2026-08-06T12:05:00Z",
                "2026-08-06",
            )
            .await
            .expect("capture should be recorded");

            let activated =
                get_product_usage_snapshot_from_pool(&pool, "2026-08-06T12:06:00Z", "2026-08-06")
                    .await
                    .expect("snapshot should be calculated");

            assert!(activated.activation.activated);
            assert_eq!(
                activated.activation.activated_at.as_deref(),
                Some("2026-08-06T12:05:00Z")
            );
            assert_eq!(activated.activation.time_to_value_seconds, Some(300));
        });
    }

    #[test]
    fn preserves_first_milestones_and_aggregates_daily_counts() {
        run_async_test(async {
            let pool = test_pool().await;
            create_product_usage_schema(&pool)
                .await
                .expect("schema should be created");

            for occurred_at in ["2026-08-06T09:00:00Z", "2026-08-06T10:00:00Z"] {
                record_product_usage_event_in_pool(
                    &pool,
                    ProductUsageEvent::FocusStarted,
                    occurred_at,
                    "2026-08-06",
                )
                .await
                .expect("focus should be recorded");
            }

            let snapshot =
                get_product_usage_snapshot_from_pool(&pool, "2026-08-06T12:00:00Z", "2026-08-06")
                    .await
                    .expect("snapshot should be calculated");

            assert_eq!(
                snapshot.milestones.first_focus_started_at.as_deref(),
                Some("2026-08-06T09:00:00Z")
            );
            assert_eq!(snapshot.daily_usage[0].focus_started_count, 2);
        });
    }

    #[test]
    fn calculates_day_one_and_first_week_retention_from_active_days() {
        run_async_test(async {
            let pool = test_pool().await;
            create_product_usage_schema(&pool)
                .await
                .expect("schema should be created");

            for (event, occurred_at, local_date) in [
                (
                    ProductUsageEvent::AppOpened,
                    "2026-08-01T09:00:00Z",
                    "2026-08-01",
                ),
                (
                    ProductUsageEvent::FocusStarted,
                    "2026-08-01T09:01:00Z",
                    "2026-08-01",
                ),
                (
                    ProductUsageEvent::CaptureSaved,
                    "2026-08-01T09:02:00Z",
                    "2026-08-01",
                ),
                (
                    ProductUsageEvent::AppOpened,
                    "2026-08-02T09:00:00Z",
                    "2026-08-02",
                ),
                (
                    ProductUsageEvent::AppOpened,
                    "2026-08-05T09:00:00Z",
                    "2026-08-05",
                ),
            ] {
                record_product_usage_event_in_pool(&pool, event, occurred_at, local_date)
                    .await
                    .expect("usage should be recorded");
            }

            let snapshot =
                get_product_usage_snapshot_from_pool(&pool, "2026-08-08T12:00:00Z", "2026-08-08")
                    .await
                    .expect("snapshot should be calculated");

            assert_eq!(snapshot.retention.d1_returned, Some(true));
            assert_eq!(snapshot.retention.active_days_first_week, 3);
            assert_eq!(snapshot.retention.first_week_retained, Some(true));
        });
    }

    #[test]
    fn rejects_invalid_dates_without_writing_usage() {
        run_async_test(async {
            let pool = test_pool().await;
            create_product_usage_schema(&pool)
                .await
                .expect("schema should be created");

            let result = record_product_usage_event_in_pool(
                &pool,
                ProductUsageEvent::AppOpened,
                "not-a-timestamp",
                "06/08/2026",
            )
            .await;

            assert!(result.is_err());
        });
    }

    #[test]
    fn schema_contains_no_user_content_columns() {
        run_async_test(async {
            let pool = test_pool().await;
            create_product_usage_schema(&pool)
                .await
                .expect("schema should be created");

            let column_names: Vec<String> = sqlx::query_scalar(
                "SELECT name FROM pragma_table_info('product_usage_daily') ORDER BY cid",
            )
            .fetch_all(&pool)
            .await
            .expect("schema columns should be readable");

            assert_eq!(
                column_names,
                vec![
                    "local_date",
                    "app_open_count",
                    "focus_started_count",
                    "capture_saved_count",
                    "daily_focus_set_count",
                    "wrap_up_completed_count",
                    "onboarding_completed_count",
                ]
            );
        });
    }
}

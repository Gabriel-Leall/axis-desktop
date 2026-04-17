//! Tauri application library entry point.
//!
//! This module serves as the main entry point for the Tauri application.
//! Command implementations are organized in the `commands` module,
//! and shared types are in the `types` module.

mod bindings;
mod commands;
mod types;
mod utils;

use sqlx::sqlite::SqlitePoolOptions;
use tauri::{Manager, RunEvent, WindowEvent};
use tauri_plugin_sql::{Migration, MigrationKind};

// Re-export only what's needed externally
pub use types::DEFAULT_QUICK_PANE_SHORTCUT;

/// Application entry point. Sets up all plugins and initializes the app.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = bindings::generate_bindings();

    // Export TypeScript bindings in debug builds
    #[cfg(debug_assertions)]
    bindings::export_ts_bindings();

    // Build with common plugins
    let mut app_builder = tauri::Builder::default();

    // Single instance plugin must be registered FIRST
    // When user tries to open a second instance, focus the existing window instead
    #[cfg(desktop)]
    {
        app_builder = app_builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
        }));
    }

    // Window state plugin - saves/restores window position and size
    // Note: quick-pane is denylisted because it's an NSPanel and calling is_maximized() on it crashes
    // See: https://github.com/tauri-apps/plugins-workspace/issues/1546
    #[cfg(desktop)]
    {
        app_builder = app_builder.plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(tauri_plugin_window_state::StateFlags::all())
                .with_denylist(&["quick-pane"])
                .build(),
        );
    }

    // Updater plugin for in-app updates
    #[cfg(desktop)]
    {
        app_builder = app_builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    // Autostart plugin - allows enabling launch at system startup.
    #[cfg(desktop)]
    {
        app_builder = app_builder.plugin(tauri_plugin_autostart::Builder::new().build());
    }

    app_builder = app_builder
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .plugin({
            #[allow(unused_mut)]
            let mut targets = vec![
                // Always log to stdout for development
                tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                // Log to system logs on macOS (appears in Console.app)
                #[cfg(target_os = "macos")]
                tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                    file_name: None,
                }),
            ];
            // Log to webview console — excluded on Linux where the WebKitGTK webview
            // doesn't exist during setup(), causing app.emit() to deadlock on the IPC socket.
            #[cfg(not(target_os = "linux"))]
            targets.push(tauri_plugin_log::Target::new(
                tauri_plugin_log::TargetKind::Webview,
            ));
            tauri_plugin_log::Builder::new()
                // Use Debug level in development, Info in production
                .level(if cfg!(debug_assertions) {
                    log::LevelFilter::Debug
                } else {
                    log::LevelFilter::Info
                })
                .targets(targets)
                .build()
        });

    // macOS: Add NSPanel plugin for native panel behavior
    #[cfg(target_os = "macos")]
    {
        app_builder = app_builder.plugin(tauri_nspanel::init());
    }

    app_builder
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin({
            let migrations = vec![
                Migration {
                    version: 1,
                    description: "create_tasks_and_subtasks",
                    sql: "
                        CREATE TABLE IF NOT EXISTS tasks (
                            id TEXT PRIMARY KEY,
                            title TEXT NOT NULL,
                            description TEXT,
                            priority TEXT NOT NULL DEFAULT 'medium',
                            status TEXT NOT NULL DEFAULT 'todo',
                            due_date TEXT,
                            completed_at TEXT,
                            created_at TEXT NOT NULL,
                            updated_at TEXT NOT NULL,
                            sort_order INTEGER DEFAULT 0
                        );
                        CREATE TABLE IF NOT EXISTS subtasks (
                            id TEXT PRIMARY KEY,
                            task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                            title TEXT NOT NULL,
                            completed INTEGER NOT NULL DEFAULT 0,
                            sort_order INTEGER DEFAULT 0,
                            created_at TEXT NOT NULL
                        );
                        CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
                        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
                        CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);
                    ",
                    kind: MigrationKind::Up,
                },
                Migration {
                    version: 2,
                    description: "create_pomodoro_tables",
                    sql: "
                        CREATE TABLE IF NOT EXISTS pomodoro_sessions (
                            id TEXT PRIMARY KEY,
                            session_type TEXT NOT NULL,
                            duration_seconds INTEGER NOT NULL,
                            completed INTEGER NOT NULL DEFAULT 0,
                            task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
                            started_at TEXT NOT NULL,
                            ended_at TEXT,
                            created_at TEXT NOT NULL
                        );
                        CREATE TABLE IF NOT EXISTS pomodoro_settings (
                            id INTEGER PRIMARY KEY DEFAULT 1,
                            focus_duration INTEGER NOT NULL DEFAULT 25,
                            short_break_duration INTEGER NOT NULL DEFAULT 5,
                            long_break_duration INTEGER NOT NULL DEFAULT 15,
                            pomos_until_long_break INTEGER NOT NULL DEFAULT 4,
                            auto_start_breaks INTEGER NOT NULL DEFAULT 0,
                            auto_start_focus INTEGER NOT NULL DEFAULT 0,
                            sound_notifications INTEGER NOT NULL DEFAULT 1
                        );
                        INSERT OR IGNORE INTO pomodoro_settings (id) VALUES (1);
                        CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_started_at
                            ON pomodoro_sessions(started_at);
                    ",
                    kind: MigrationKind::Up,
                },
                Migration {
                    version: 3,
                    description: "create_habits_tables",
                    sql: "
                        CREATE TABLE IF NOT EXISTS habits (
                            id TEXT PRIMARY KEY,
                            name TEXT NOT NULL,
                            color TEXT NOT NULL DEFAULT '#6366f1',
                            icon TEXT,
                            frequency TEXT NOT NULL DEFAULT 'daily',
                            frequency_days TEXT,
                            active INTEGER NOT NULL DEFAULT 1,
                            sort_order INTEGER DEFAULT 0,
                            created_at TEXT NOT NULL,
                            updated_at TEXT NOT NULL
                        );
                        CREATE TABLE IF NOT EXISTS habit_logs (
                            id TEXT PRIMARY KEY,
                            habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
                            completed_date TEXT NOT NULL,
                            completed_at TEXT NOT NULL,
                            UNIQUE(habit_id, completed_date)
                        );
                        CREATE INDEX IF NOT EXISTS idx_habits_active_sort
                            ON habits(active, sort_order);
                        CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_date
                            ON habit_logs(habit_id, completed_date);
                        CREATE INDEX IF NOT EXISTS idx_habit_logs_date
                            ON habit_logs(completed_date);
                    ",
                    kind: MigrationKind::Up,
                },
                Migration {
                    version: 4,
                    description: "rename_pomodoro_sessions_type_column",
                    sql: "
                        CREATE TABLE IF NOT EXISTS pomodoro_sessions_new (
                            id TEXT PRIMARY KEY,
                            session_type TEXT NOT NULL,
                            duration_seconds INTEGER NOT NULL,
                            completed INTEGER NOT NULL DEFAULT 0,
                            task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
                            started_at TEXT NOT NULL,
                            ended_at TEXT,
                            created_at TEXT NOT NULL
                        );
                        INSERT OR IGNORE INTO pomodoro_sessions_new
                            (id, session_type, duration_seconds, completed, task_id, started_at, ended_at, created_at)
                        SELECT id,
                            CASE
                                WHEN type IS NOT NULL THEN type
                                ELSE session_type
                            END,
                            duration_seconds, completed, task_id, started_at, ended_at, created_at
                        FROM pomodoro_sessions;
                        DROP TABLE pomodoro_sessions;
                        ALTER TABLE pomodoro_sessions_new RENAME TO pomodoro_sessions;
                        CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_started_at
                            ON pomodoro_sessions(started_at);
                    ",
                    kind: MigrationKind::Up,
                },
            ];
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:tasks.db", migrations)
                .build()
        })
        .setup(|app| {
            log::info!("Application starting up");
            log::debug!(
                "App handle initialized for package: {}",
                app.package_info().name
            );

            // ── SQLite pool for domain commands (tasks, pomodoro, habits) ────────
            // The tauri-plugin-sql plugin already runs migrations and creates the DB
            // file. We create a separate sqlx pool pointing to the same file so that
            // our typed Rust commands can query it directly without relying on the
            // plugin's private internal API.
            {
                let app_config_dir = app
                    .path()
                    .app_config_dir()
                    .expect("Failed to get app config directory");

                // Ensure directory exists (plugin may not have run yet at this point)
                std::fs::create_dir_all(&app_config_dir)
                    .expect("Failed to create app config directory");

                let db_path = app_config_dir.join("tasks.db");
                let db_url = format!(
                    "sqlite://{}",
                    db_path
                        .to_str()
                        .expect("Invalid DB path")
                );

                let pool = tauri::async_runtime::block_on(async {
                    SqlitePoolOptions::new()
                        .max_connections(5)
                        .connect(&db_url)
                        .await
                        .expect("Failed to connect to SQLite database")
                });

                // Run migrations for the domain tables
                tauri::async_runtime::block_on(async {
                    sqlx::query("PRAGMA journal_mode=WAL;")
                        .execute(&pool)
                        .await
                        .expect("Failed to enable WAL mode");

                    sqlx::query("PRAGMA foreign_keys=ON;")
                        .execute(&pool)
                        .await
                        .expect("Failed to enable foreign keys");

                    // Tasks
                    sqlx::query(
                        "CREATE TABLE IF NOT EXISTS tasks (
                            id TEXT PRIMARY KEY,
                            title TEXT NOT NULL,
                            description TEXT,
                            priority TEXT NOT NULL DEFAULT 'medium',
                            status TEXT NOT NULL DEFAULT 'todo',
                            due_date TEXT,
                            completed_at TEXT,
                            created_at TEXT NOT NULL,
                            updated_at TEXT NOT NULL,
                            sort_order INTEGER DEFAULT 0
                        )"
                    ).execute(&pool).await.expect("Failed to create tasks table");

                    sqlx::query(
                        "CREATE TABLE IF NOT EXISTS subtasks (
                            id TEXT PRIMARY KEY,
                            task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                            title TEXT NOT NULL,
                            completed INTEGER NOT NULL DEFAULT 0,
                            sort_order INTEGER DEFAULT 0,
                            created_at TEXT NOT NULL
                        )"
                    ).execute(&pool).await.expect("Failed to create subtasks table");

                    sqlx::query(
                        "CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)"
                    ).execute(&pool).await.expect("Failed to create tasks index");

                    sqlx::query(
                        "CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)"
                    ).execute(&pool).await.expect("Failed to create tasks status index");

                    sqlx::query(
                        "CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id)"
                    ).execute(&pool).await.expect("Failed to create subtasks index");

                    // Pomodoro
                    sqlx::query(
                        "CREATE TABLE IF NOT EXISTS pomodoro_sessions (
                            id TEXT PRIMARY KEY,
                            session_type TEXT NOT NULL,
                            duration_seconds INTEGER NOT NULL,
                            completed INTEGER NOT NULL DEFAULT 0,
                            task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
                            started_at TEXT NOT NULL,
                            ended_at TEXT,
                            created_at TEXT NOT NULL
                        )"
                    ).execute(&pool).await.expect("Failed to create pomodoro_sessions table");

                    sqlx::query(
                        "CREATE TABLE IF NOT EXISTS pomodoro_settings (
                            id INTEGER PRIMARY KEY DEFAULT 1,
                            focus_duration INTEGER NOT NULL DEFAULT 25,
                            short_break_duration INTEGER NOT NULL DEFAULT 5,
                            long_break_duration INTEGER NOT NULL DEFAULT 15,
                            pomos_until_long_break INTEGER NOT NULL DEFAULT 4,
                            auto_start_breaks INTEGER NOT NULL DEFAULT 0,
                            auto_start_focus INTEGER NOT NULL DEFAULT 0,
                            sound_notifications INTEGER NOT NULL DEFAULT 1
                        )"
                    ).execute(&pool).await.expect("Failed to create pomodoro_settings table");

                    sqlx::query(
                        "INSERT OR IGNORE INTO pomodoro_settings (id) VALUES (1)"
                    ).execute(&pool).await.expect("Failed to insert default pomodoro settings");

                    sqlx::query(
                        "CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_started_at \
                         ON pomodoro_sessions(started_at)"
                    ).execute(&pool).await.expect("Failed to create pomodoro index");

                    // Habits
                    sqlx::query(
                        "CREATE TABLE IF NOT EXISTS habits (
                            id TEXT PRIMARY KEY,
                            name TEXT NOT NULL,
                            color TEXT NOT NULL DEFAULT '#6366f1',
                            icon TEXT,
                            frequency TEXT NOT NULL DEFAULT 'daily',
                            frequency_days TEXT,
                            active INTEGER NOT NULL DEFAULT 1,
                            sort_order INTEGER DEFAULT 0,
                            created_at TEXT NOT NULL,
                            updated_at TEXT NOT NULL
                        )"
                    ).execute(&pool).await.expect("Failed to create habits table");

                    sqlx::query(
                        "CREATE TABLE IF NOT EXISTS habit_logs (
                            id TEXT PRIMARY KEY,
                            habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
                            completed_date TEXT NOT NULL,
                            completed_at TEXT NOT NULL,
                            UNIQUE(habit_id, completed_date)
                        )"
                    ).execute(&pool).await.expect("Failed to create habit_logs table");

                    sqlx::query(
                        "CREATE INDEX IF NOT EXISTS idx_habits_active_sort \
                         ON habits(active, sort_order)"
                    ).execute(&pool).await.expect("Failed to create habits index");

                    sqlx::query(
                        "CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_date \
                         ON habit_logs(habit_id, completed_date)"
                    ).execute(&pool).await.expect("Failed to create habit_logs index");

                    sqlx::query(
                        "CREATE INDEX IF NOT EXISTS idx_habit_logs_date \
                         ON habit_logs(completed_date)"
                    ).execute(&pool).await.expect("Failed to create habit_logs date index");

                    // Notes
                    sqlx::query(
                        "CREATE TABLE IF NOT EXISTS notes (
                            id TEXT PRIMARY KEY,
                            content TEXT NOT NULL,
                            created_at TEXT NOT NULL,
                            updated_at TEXT NOT NULL,
                            word_count INTEGER NOT NULL DEFAULT 0
                        )"
                    ).execute(&pool).await.expect("Failed to create notes table");

                    sqlx::query(
                        "CREATE INDEX IF NOT EXISTS idx_notes_updated_at \
                         ON notes(updated_at)"
                    ).execute(&pool).await.expect("Failed to create notes updated_at index");

                    // Migration: rename 'type' column to 'session_type' in old databases
                    // This is a no-op if the column already has the right name.
                    let has_type_col: bool = sqlx::query_scalar::<_, i64>(
                        "SELECT COUNT(*) FROM pragma_table_info('pomodoro_sessions') \
                         WHERE name = 'type'"
                    )
                    .fetch_one(&pool)
                    .await
                    .unwrap_or(0) > 0;

                    if has_type_col {
                        log::info!("Migrating pomodoro_sessions: renaming 'type' -> 'session_type'");
                        sqlx::query(
                            "CREATE TABLE IF NOT EXISTS pomodoro_sessions_v2 (
                                id TEXT PRIMARY KEY,
                                session_type TEXT NOT NULL,
                                duration_seconds INTEGER NOT NULL,
                                completed INTEGER NOT NULL DEFAULT 0,
                                task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
                                started_at TEXT NOT NULL,
                                ended_at TEXT,
                                created_at TEXT NOT NULL
                            )"
                        ).execute(&pool).await.expect("Failed to create pomodoro_sessions_v2");

                        sqlx::query(
                            "INSERT OR IGNORE INTO pomodoro_sessions_v2
                             SELECT id, type, duration_seconds, completed, task_id, started_at, ended_at, created_at
                             FROM pomodoro_sessions"
                        ).execute(&pool).await.expect("Failed to migrate pomodoro_sessions data");

                        sqlx::query("DROP TABLE pomodoro_sessions")
                            .execute(&pool).await.expect("Failed to drop old pomodoro_sessions");

                        sqlx::query("ALTER TABLE pomodoro_sessions_v2 RENAME TO pomodoro_sessions")
                            .execute(&pool).await.expect("Failed to rename pomodoro_sessions_v2");

                        sqlx::query(
                            "CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_started_at \
                             ON pomodoro_sessions(started_at)"
                        ).execute(&pool).await.expect("Failed to recreate pomodoro index");

                        log::info!("Pomodoro sessions migration complete");
                    }
                });

                app.manage(pool);
                log::info!("SQLite pool initialized and managed");
            }

            // Set up global shortcut plugin (without any shortcuts - we register them separately)
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::Builder;

                app.handle().plugin(Builder::new().build())?;
            }

            // Load saved preferences and register the quick pane shortcut
            #[cfg(desktop)]
            {
                let saved_shortcut = commands::preferences::load_quick_pane_shortcut(app.handle());
                let shortcut_to_register = saved_shortcut
                    .as_deref()
                    .unwrap_or(DEFAULT_QUICK_PANE_SHORTCUT);

                log::info!("Registering quick pane shortcut: {shortcut_to_register}");
                commands::quick_pane::register_quick_pane_shortcut(
                    app.handle(),
                    shortcut_to_register,
                )?;
            }

            // Create the quick pane window (hidden) - must be done on main thread
            if let Err(e) = commands::quick_pane::init_quick_pane(app.handle()) {
                log::error!("Failed to create quick pane: {e}");
                // Non-fatal: app can still run without quick pane
            }

            // NOTE: Application menu is built from JavaScript for i18n support
            // See src/lib/menu.ts for the menu implementation

            Ok(())
        })
        .invoke_handler(builder.invoke_handler())
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| match &event {
            // macOS: Hide the main window instead of quitting so the dock icon can reopen it
            // and the quick-pane shortcut works independently of the main window.
            // On other platforms, the close proceeds normally and the app exits.
            RunEvent::WindowEvent {
                label,
                event: WindowEvent::CloseRequested { api, .. },
                ..
            } if label == "main" => {
                #[cfg(target_os = "macos")]
                {
                    api.prevent_close();

                    // Save window state before hiding
                    use tauri_plugin_window_state::{AppHandleExt, StateFlags};
                    if let Err(e) = app_handle.save_window_state(StateFlags::all()) {
                        log::warn!("Failed to save window state: {e}");
                    }

                    // Hide the window, not the app. app_handle.hide() calls NSApplication.hide()
                    // which sets system-level hidden state — showing an NSPanel while hidden
                    // causes macOS to unhide the entire app, including the main window.
                    if let Some(window) = app_handle.get_webview_window("main") {
                        let _ = window.hide();
                        log::info!("Main window hidden");
                    }
                }
            }

            // macOS: Dock icon clicked — reopen the main window if it was hidden
            #[cfg(target_os = "macos")]
            RunEvent::Reopen { .. } => {
                if let Some(window) = app_handle.get_webview_window("main") {
                    if !window.is_visible().unwrap_or(true) {
                        let _ = window.show();

                        // The window-state plugin only auto-restores on app startup, not after
                        // a hide/show cycle. Without this the window can appear at stale coords.
                        use tauri_plugin_window_state::{StateFlags, WindowExt};
                        let _ = window.restore_state(StateFlags::all());

                        let _ = window.set_focus();
                        log::info!("Main window reopened from dock");
                    }
                }
            }

            // Cleanup on actual exit (Cmd+Q, menu Quit, or window close on non-macOS).
            // RunEvent::Exit fires reliably before the process exits, unlike ExitRequested
            // which doesn't fire for Cmd+Q on macOS (tauri-apps/tauri#9198).
            RunEvent::Exit => {
                log::info!("Application exiting — performing cleanup");

                // Hide the quick-pane panel to prevent crashes during teardown
                #[cfg(target_os = "macos")]
                {
                    use tauri_nspanel::ManagerExt;
                    if let Ok(panel) = app_handle.get_webview_panel("quick-pane") {
                        panel.hide();
                    }
                }

                // Unregister global shortcuts
                #[cfg(desktop)]
                {
                    use tauri_plugin_global_shortcut::GlobalShortcutExt;
                    if let Err(e) = app_handle.global_shortcut().unregister_all() {
                        log::warn!("Failed to unregister global shortcuts: {e}");
                    }
                }

                log::info!("Cleanup complete");
            }

            _ => {}
        });
}

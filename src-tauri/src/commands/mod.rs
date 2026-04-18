//! Tauri command handlers organized by domain.
//!
//! Each submodule contains related commands and their helper functions.
//! Import specific commands via their submodule (e.g., `commands::preferences::greet`).

pub mod analytics;
pub mod calendar;
pub mod habits;
pub mod kanban;
pub mod notes;
pub mod notifications;
pub mod pomodoro;
pub mod preferences;
pub mod quick_pane;
pub mod recovery;
pub mod tasks;

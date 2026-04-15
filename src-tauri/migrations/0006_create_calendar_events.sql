-- Calendar events table
CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    start_date TEXT NOT NULL,  -- YYYY-MM-DD for all-day, RFC3339 for timed
    end_date TEXT NOT NULL,    -- YYYY-MM-DD for all-day (exclusive), RFC3339 for timed
    all_day INTEGER NOT NULL DEFAULT 1,
    color TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(start_date, end_date);
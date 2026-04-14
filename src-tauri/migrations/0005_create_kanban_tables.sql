CREATE TABLE IF NOT EXISTS kanban_boards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kanban_columns (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES kanban_boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kanban_cards (
  id TEXT PRIMARY KEY,
  column_id TEXT NOT NULL REFERENCES kanban_columns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kanban_subtasks (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kanban_boards_active_sort
  ON kanban_boards(is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_kanban_columns_board_sort
  ON kanban_columns(board_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_kanban_cards_column_sort
  ON kanban_cards(column_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_kanban_subtasks_card_sort
  ON kanban_subtasks(card_id, sort_order);
